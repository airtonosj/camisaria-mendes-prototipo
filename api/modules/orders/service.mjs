import { allocateCouponDiscount } from '../../../shared/domain.mjs';
import * as queries from './repository.mjs';
import { pool, withTransaction } from "../../database.mjs";
import { whatsappLookupValues } from "../../phone.mjs";
import { normalizeCustomerEmail } from "../../../shared/contact.mjs";
import { ApiError } from "../../http/response.mjs";
import { requireText, optionalText, normalizeWhatsapp, parsePositiveInteger } from "../../http/validation.mjs";
import { publicOrderNumber } from "../../http/settings.mjs";
import { parseSingleOrderCoupon, validateActiveCoupon, ensureCouponFitsCampaignPrices } from "../coupons/service.mjs";
import { resolveVariantArtwork } from "../campaigns/service.mjs";

/** @param {{idempotencyKey:string, body:Omit<import("../../../shared/contracts").CreateOrderInput,"idempotencyKey">}} input Validated at the HTTP/service boundary. */
export async function createOrder({ idempotencyKey, body }) {
  const campaignCode = requireText(body.campaignCode, "campaignCode", 40).toUpperCase();
  const couponCode = parseSingleOrderCoupon(body);
  const customer = body.customer ?? {};
  const customerName = requireText(customer.name, "customer.name", 160);
  const customerWhatsapp = normalizeWhatsapp(customer.whatsapp);
  const suppliedCustomerEmail = requireText(customer.email, "customer.email", 254);
  const customerEmail = normalizeCustomerEmail(suppliedCustomerEmail);
  if (!customerEmail) {
    throw new ApiError(422, "VALIDATION_ERROR", "Informe um e-mail válido para receber a confirmação da compra.");
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 10) {
    throw new ApiError(422, "VALIDATION_ERROR", "O pedido deve conter entre 1 e 10 itens.");
  }

  const requestedItems = body.items.map((item) => {
    if (!item || typeof item !== "object") {
      throw new ApiError(422, "VALIDATION_ERROR", "Cada item do pedido precisa ser um objeto válido.");
    }
    const variantId = Number(item.variantId);
    const quantity = Number(item.quantity);
    const size = String(item.size ?? "").toUpperCase();
    if (!Number.isSafeInteger(variantId) || variantId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 || !/^[A-Z]{1,8}$/.test(size)) {
      throw new ApiError(422, "VALIDATION_ERROR", "Cada item precisa de variante, tamanho válido e quantidade entre 1 e 20.");
    }
    return { variantId, quantity, size };
  });
  if (new Set(requestedItems.map((item) => `${item.variantId}:${item.size}`)).size !== requestedItems.length) {
    throw new ApiError(422, "VALIDATION_ERROR", "Itens repetidos devem ser enviados como uma única linha com a quantidade total.");
  }

  return withTransaction(async (connection) => {
    const [existingRows] = await queries.createOrderQuery1(connection, [idempotencyKey]);
    if (existingRows.length > 0) return { created: false, order: existingRows[0] };

    const [campaignRows] = await queries.createOrderQuery2(connection, [campaignCode]);
    if (campaignRows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    const campaign = campaignRows[0];
    // A fase operacional é a autoridade de abertura. Se a equipe retornar uma
    // campanha para `receiving_orders`, a ação deliberada reabre os pedidos mesmo
    // quando o prazo originalmente divulgado já passou.
    if (campaign.phase !== "receiving_orders") throw new ApiError(409, "CAMPAIGN_NOT_RECEIVING", "Esta campanha não está recebendo pedidos.");

    const variantIds = [...new Set(requestedItems.map((item) => item.variantId))];
    const placeholders = variantIds.map(() => "?").join(", ");
    const [variantRows] = await queries.createOrderQuery3(connection, [campaign.id, ...variantIds], placeholders);
    if (variantRows.length !== variantIds.length) throw new ApiError(422, "INVALID_VARIANT", "Uma ou mais opções não pertencem a esta campanha.");
    const prices = new Map(variantRows.map((row) => [Number(row.id), Number(row.unit_price_cents)]));
    const variantModels = new Map(variantRows.map((row) => [Number(row.id), Number(row.shirt_model_id)]));

    const [allowedSizeRows] = await queries.createOrderQuery4(connection, [campaign.id]);
    const sizeIdByModelAndCode = new Map(
      allowedSizeRows.map((row) => [`${Number(row.shirt_model_id)}:${row.code}`, Number(row.size_id)]),
    );
    const items = requestedItems.map((item) => {
      const sizeId = sizeIdByModelAndCode.get(`${variantModels.get(item.variantId)}:${item.size}`);
      if (!sizeId) throw new ApiError(422, "INVALID_SIZE", `O tamanho ${item.size} não está disponível nesta campanha.`);
      return { ...item, sizeId };
    });

    const subtotalCents = items.reduce((total, item) => total + prices.get(item.variantId) * item.quantity, 0);
    const totalUnits = items.reduce((total, item) => total + item.quantity, 0);
    let coupon = null;
    let discountsByModelId = new Map();
    if (couponCode) {
      coupon = await validateActiveCoupon(connection, campaign.id, couponCode, { lock: true });
      if (totalUnits < Number(coupon.minimum_quantity ?? 1)) {
        throw new ApiError(
          409,
          "COUPON_MINIMUM_QUANTITY",
          `Este cupom é válido a partir de ${Number(coupon.minimum_quantity)} peças. Seu pedido tem ${totalUnits}.`,
        );
      }
      await ensureCouponFitsCampaignPrices(connection, campaign.id, coupon.discounts);
      discountsByModelId = new Map(coupon.discounts.map((discount) => [discount.modelId, discount.discountCents]));
      if (items.some((item) => (discountsByModelId.get(variantModels.get(item.variantId)) ?? 0) >= prices.get(item.variantId))) {
        throw new ApiError(409, "COUPON_UNAVAILABLE", "Este cupom não pode ser aplicado a uma das peças escolhidas.");
      }
    }
    const pricedItems = items.map((item, requestIndex) => ({
      ...item,
      requestIndex,
      unitDiscountCents: discountsByModelId.get(variantModels.get(item.variantId)) ?? 0,
      discountedQuantity: 0,
    }));
    const discountedQuantities = allocateCouponDiscount(pricedItems, coupon ? Number(coupon.maximum_discount_quantity ?? totalUnits) : 0);
    pricedItems.forEach((item,index)=>{item.discountedQuantity=discountedQuantities[index];});
    for (const item of pricedItems) {
      if (item.discountedQuantity === 0) item.unitDiscountCents = 0;
    }
    pricedItems.sort((left, right) => left.requestIndex - right.requestIndex);
    const discountCents = pricedItems.reduce(
      (total, item) => total + item.unitDiscountCents * item.discountedQuantity,
      0,
    );
    const totalCents = subtotalCents - discountCents;
    const orderNumber = publicOrderNumber();

    const [orderResult] = await queries.createOrderQuery5(connection, [orderNumber, idempotencyKey, campaign.id, customerName, customerWhatsapp, customerEmail,
        subtotalCents, discountCents, coupon?.code ?? null, totalCents]);
    for (const item of pricedItems) {
      await queries.createOrderQuery6(connection, [orderResult.insertId, item.variantId, item.sizeId, item.quantity, prices.get(item.variantId), item.unitDiscountCents, item.discountedQuantity]);
    }
    if (coupon) {
      await queries.createOrderQuery7(connection, [coupon.id, orderResult.insertId, coupon.code, discountCents]);
    }
    return { created: true, order: { order_number: orderNumber, total_cents: totalCents, payment_status: "pending" } };
  // MariaDB can reject a locking read after another checkout commits when an
  // earlier idempotency lookup established a REPEATABLE READ snapshot (1020).
  // READ COMMITTED sees that commit; campaign/coupon locks still serialize uses.
  }, { readCommitted: true });
}

export function effectiveOrderStatus(order) {
  if (order.status === "cancelled") return "cancelled";
  if (order.payment_status === "failed") return "failed";
  if (order.payment_status !== "paid") return "pending";
  if (order.delivery_status === "delivered") return "delivered";
  if (["ready_for_delivery", "completed"].includes(order.campaign_phase)) return "ready";
  if (order.campaign_phase === "production") return "production";
  return "confirmed";
}

export async function trackOrder(requestUrl, orderNumber) {
  const whatsapp = normalizeWhatsapp(requestUrl.searchParams.get("whatsapp"));
  const lookup = whatsappLookupValues(whatsapp);
  const [rows] = await queries.trackOrderQuery1(pool, [orderNumber, ...lookup], lookup.map(() => "?").join(", "));
  if (rows.length === 0) throw new ApiError(404, "ORDER_NOT_FOUND", "Pedido não encontrado com os dados informados.");
  const order = rows[0];
  const [items] = await queries.trackOrderQuery2(pool, [order.art_render_mode, order.id]);
  return {
    number: order.order_number,
    status: effectiveOrderStatus(order),
    cancellationReason: order.cancellation_reason,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    deliveryStatus: order.delivery_status,
    subtotalCents: order.subtotal_cents,
    discountCents: order.discount_cents,
    couponCode: order.coupon_code,
    totalCents: order.total_cents,
    createdAt: order.created_at,
    paidAt: order.paid_at,
    deliveredAt: order.delivered_at,
    customerName: order.customer_name,
    campaign: {
      code: order.campaign_code,
      title: order.campaign_title,
      phase: order.campaign_phase,
      representativeName: order.representative_name,
      pickupInstructions: order.pickup_instructions,
      artFrontUrl: order.art_front_url,
      artBackUrl: order.art_back_url,
      artRenderMode: order.art_render_mode,
    },
    items: items.map((item) => ({
      modelName: item.model_name,
      color: { name: item.color_name, hex: item.hex_color },
      size: item.size,
      sizeGroup: item.size_group,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      unitDiscountCents: item.unit_discount_cents,
      discountedQuantity: item.discounted_quantity,
      lineTotalCents: item.line_total_cents,
      artwork: resolveVariantArtwork(order, item),
    })),
  };
}

/**
 * Inclui os cancelados de propósito. Some da tela é pior do que aparecer riscado: a
 * camisaria precisa poder responder "esse pedido foi cancelado por tal motivo".
 */
export async function listCampaignOrders(code) {
  const [rows] = await queries.listCampaignOrdersQuery1(pool, [code]);
  const orders = new Map();
  for (const row of rows) {
    let order = orders.get(row.order_number);
    if (!order) {
      order = {
        number: row.order_number,
        customer: { name: row.customer_name, whatsapp: row.customer_whatsapp, email: row.customer_email },
        status: row.status,
        cancellationReason: row.cancellation_reason,
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        deliveryStatus: row.delivery_status,
        subtotalCents: row.subtotal_cents,
        discountCents: row.discount_cents,
        couponCode: row.coupon_code,
        totalCents: row.total_cents,
        createdAt: row.created_at,
        items: [],
      };
      orders.set(row.order_number, order);
    }
    order.items.push({
      modelName: row.model_name,
      color: { name: row.color_name, hex: row.hex_color },
      size: row.size,
      sizeGroup: row.size_group,
      quantity: Number(row.quantity),
      unitPriceCents: Number(row.unit_price_cents),
      unitDiscountCents: Number(row.unit_discount_cents),
      discountedQuantity: Number(row.discounted_quantity),
      lineTotalCents: Number(row.quantity) * Number(row.unit_price_cents)
        - Number(row.discounted_quantity) * Number(row.unit_discount_cents),
    });
  }
  return [...orders.values()];
}

export async function changeDeliveryStatus({ staff, body }, orderNumber) {
  const nextStatus = requireText(body.status, "status", 32);
  const note = optionalText(body.note, 500);
  if (!["ready", "delivered", "issue"].includes(nextStatus)) {
    throw new ApiError(422, "INVALID_DELIVERY_STATUS", "Situação de entrega inválida.");
  }

  return withTransaction(async (connection) => {
    const [rows] = await queries.changeDeliveryStatusQuery1(connection, [orderNumber]);
    if (rows.length === 0) throw new ApiError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    const order = rows[0];
    if (order.payment_status !== "paid") throw new ApiError(409, "ORDER_NOT_PAID", "Somente pedidos pagos podem entrar no fluxo de entrega.");
    if (nextStatus === "delivered" && !["ready_for_delivery", "completed"].includes(order.campaign_phase)) {
      throw new ApiError(409, "CAMPAIGN_NOT_READY", "A campanha ainda não está pronta para entrega.");
    }
    if (nextStatus === order.delivery_status) {
      return { number: orderNumber, deliveryStatus: nextStatus, unchanged: true };
    }
    await queries.changeDeliveryStatusQuery2(connection, [nextStatus, nextStatus === "delivered" ? 1 : 0, order.id]);
    await queries.changeDeliveryStatusQuery3(connection, [order.id, order.delivery_status, nextStatus, note, staff.id]);
    return { number: orderNumber, previousStatus: order.delivery_status, deliveryStatus: nextStatus, unchanged: false };
  });
}

/**
 * Cancelamento. O pedido não é apagado: sai dos relatórios e da produção, mas continua
 * no banco com o motivo e o autor, porque "por que este pedido sumiu?" precisa ter
 * resposta. Pedido pago não é cancelado direto — o reembolso é registrado antes, senão o
 * dinheiro recebido some do histórico junto com o pedido.
 */
export async function closeOrderPaymentLifecycle(connection, orderId, reason) {
  const message = String(reason).slice(0, 500);
  await queries.closeOrderPaymentLifecycleQuery1(connection, [message, orderId]);
  await queries.closeOrderPaymentLifecycleQuery2(connection, [message, orderId]);
}

export async function cancelOrder({ staff, body }, orderNumber) {
  const reason = requireText(body.reason, "reason", 500);
  if (reason.length < 3) throw new ApiError(422, "CANCEL_REASON_REQUIRED", "Descreva o motivo do cancelamento.");

  return withTransaction(async (connection) => {
    const [rows] = await queries.cancelOrderQuery1(connection, [orderNumber]);
    if (rows.length === 0) throw new ApiError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    const order = rows[0];
    if (order.status === "cancelled") {
      await closeOrderPaymentLifecycle(connection, order.id, "Pedido cancelado; checkout e reconciliação encerrados.");
      return { number: orderNumber, status: "cancelled", unchanged: true };
    }
    if (["paid", "partially_refunded"].includes(order.payment_status)) {
      throw new ApiError(
        409,
        "ORDER_PAID_NOT_REFUNDED",
        "Este pedido está pago. Registre o reembolso antes de cancelar.",
      );
    }
    await queries.cancelOrderQuery2(connection, [reason, staff.id, order.id]);
    await closeOrderPaymentLifecycle(connection, order.id, "Pedido cancelado; checkout e reconciliação encerrados.");
    return { number: orderNumber, status: "cancelled", reason, unchanged: false };
  });
}

/**
 * Registra um estorno já concluído na conta InfinitePay. A API pública do Checkout
 * Integrado não documenta uma operação de reembolso, então esta rota nunca movimenta
 * dinheiro: ela exige a referência obtida no app/painel do provedor e cria a trilha
 * local antes de cancelar o pedido e retirá-lo dos relatórios.
 */
export async function registerOrderRefund({ staff, body }, orderNumber) {
  const providerRefundId = requireText(body.providerRefundId, "providerRefundId", 190);
  const reason = requireText(body.reason, "reason", 500);
  const amountCents = parsePositiveInteger(body.amountCents, "amountCents", 10_000_000);
  const refundedAt = body.refundedAt ? new Date(body.refundedAt) : new Date();
  if (reason.length < 3) throw new ApiError(422, "REFUND_REASON_REQUIRED", "Descreva o motivo do reembolso.");
  if (Number.isNaN(refundedAt.getTime()) || refundedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new ApiError(422, "INVALID_REFUND_DATE", "Data do reembolso inválida.");
  }
  let receiptUrl = null;
  if (body.receiptUrl) {
    try {
      const parsed = new URL(String(body.receiptUrl));
      if (parsed.protocol !== "https:") throw new Error("protocol");
      receiptUrl = parsed.toString();
    } catch {
      throw new ApiError(422, "INVALID_REFUND_RECEIPT", "O comprovante do reembolso precisa usar HTTPS.");
    }
  }

  return withTransaction(async (connection) => {
    const [rows] = await queries.registerOrderRefundQuery1(connection, [orderNumber]);
    if (rows.length === 0) throw new ApiError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    const order = rows[0];
    if (order.status === "cancelled" || order.payment_status === "refunded") {
      throw new ApiError(409, "ORDER_ALREADY_REFUNDED", "Este pedido já foi reembolsado e cancelado.");
    }
    if (order.payment_status !== "paid") {
      throw new ApiError(409, "ORDER_NOT_PAID", "Somente um pedido pago pode receber registro de reembolso.");
    }
    if (amountCents !== Number(order.total_cents)) {
      throw new ApiError(
        422,
        "FULL_REFUND_REQUIRED",
        "Nesta etapa operacional, registre somente o reembolso integral do pedido.",
        { expectedAmountCents: Number(order.total_cents) },
      );
    }
    const [payments] = await queries.registerOrderRefundQuery2(connection, [order.id]);
    if (payments.length === 0) {
      throw new ApiError(409, "CONFIRMED_PAYMENT_NOT_FOUND", "O pagamento confirmado do pedido não foi encontrado.");
    }
    const payment = payments[0];
    try {
      await queries.registerOrderRefundQuery3(connection, [order.id, payment.id, payment.provider, providerRefundId, amountCents, reason, receiptUrl, refundedAt, staff.id]);
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw new ApiError(409, "REFUND_REFERENCE_ALREADY_USED", "Esta referência de reembolso já foi registrada.");
      }
      throw error;
    }
    await queries.registerOrderRefundQuery4(connection, [payment.id]);
    await queries.registerOrderRefundQuery5(connection, [`Reembolso integral: ${reason}`.slice(0, 500), staff.id, order.id]);
    await closeOrderPaymentLifecycle(connection, order.id, "Pedido reembolsado; checkout e reconciliação encerrados.");
    return {
      number: orderNumber,
      status: "cancelled",
      paymentStatus: "refunded",
      amountCents,
      providerRefundId,
    };
  });
}
