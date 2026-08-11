import { config } from "./config.mjs";
import { pool, withTransaction } from "./database.mjs";
import {
  checkInfinitePayPayment,
  createInfinitePayLink,
  InfinitePayRequestError,
  normalizeInfinitePayEvent,
} from "./infinitepay.mjs";

const provider = "infinitepay";
const staleLockMinutes = 10;
const retryDelayMinutes = 2;

export class PaymentIntegrationError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function publicUrl(parameters = {}) {
  const url = new URL(config.publicAppUrl);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.toString();
}

function webhookUrl() {
  const url = new URL(config.publicAppUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/payments/infinitepay/webhook`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function integrationReady() {
  if (config.payments.provider !== provider || !config.payments.infinitePay.checkoutEnabled) {
    throw new PaymentIntegrationError(503, "PAYMENT_CHECKOUT_DISABLED", "O checkout ainda não foi liberado pela camisaria.");
  }
  if (!config.payments.infinitePay.handle) {
    throw new PaymentIntegrationError(503, "PAYMENT_ACCOUNT_UNCONFIGURED", "A conta InfinitePay ainda não foi configurada.");
  }
}

export async function createCheckoutForOrder(orderNumber, whatsapp) {
  integrationReady();
  const [orders] = await pool.execute(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_whatsapp, o.customer_email,
            o.status, o.payment_status, o.total_cents, c.title AS campaign_title
       FROM orders o
       JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.order_number = ? AND o.customer_whatsapp = ? LIMIT 1`,
    [orderNumber, whatsapp],
  );
  if (orders.length === 0) {
    throw new PaymentIntegrationError(404, "ORDER_NOT_FOUND", "Pedido não encontrado com os dados informados.");
  }
  const order = orders[0];
  if (order.status !== "active") {
    throw new PaymentIntegrationError(409, "ORDER_CANCELLED", "Este pedido foi cancelado e não pode receber um novo checkout.");
  }
  if (order.payment_status === "paid") {
    throw new PaymentIntegrationError(409, "ORDER_ALREADY_PAID", "Este pedido já está pago.");
  }
  if (["refunded", "partially_refunded"].includes(order.payment_status)) {
    throw new PaymentIntegrationError(409, "ORDER_PAYMENT_CLOSED", "Este pedido possui historico de reembolso e precisa de atendimento da camisaria.");
  }

  const [existingRows] = await pool.execute(
    "SELECT checkout_url, status FROM payment_checkouts WHERE order_id = ? AND provider = ? LIMIT 1",
    [order.id, provider],
  );
  if (existingRows[0]?.checkout_url && existingRows[0].status === "pending") {
    return { url: existingRows[0].checkout_url, reused: true };
  }

  const [items] = await pool.execute(
    `SELECT oi.quantity, oi.unit_price_cents, sm.name AS model_name, co.name AS color_name, sz.code AS size_code
       FROM order_items oi
       JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
       JOIN sizes sz ON sz.id = oi.size_id
      WHERE oi.order_id = ? ORDER BY oi.id`,
    [order.id],
  );
  const computedTotal = items.reduce(
    (total, item) => total + Number(item.quantity) * Number(item.unit_price_cents),
    0,
  );
  if (items.length === 0 || computedTotal !== Number(order.total_cents)) {
    throw new PaymentIntegrationError(409, "ORDER_TOTAL_INVALID", "O pedido não passou na conferência de valor antes do checkout.");
  }

  await pool.execute(
    `INSERT INTO payment_checkouts (order_id, provider, status, amount_cents)
     VALUES (?, ?, 'pending', ?)
     ON DUPLICATE KEY UPDATE amount_cents = VALUES(amount_cents)`,
    [order.id, provider, order.total_cents],
  );
  const [claim] = await pool.execute(
    `UPDATE payment_checkouts
        SET locked_at = CURRENT_TIMESTAMP(3), last_error = NULL
      WHERE order_id = ? AND provider = ? AND checkout_url IS NULL
        AND (locked_at IS NULL OR locked_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL ${staleLockMinutes} MINUTE))`,
    [order.id, provider],
  );
  if (claim.affectedRows !== 1) {
    throw new PaymentIntegrationError(409, "CHECKOUT_IN_PROGRESS", "O checkout deste pedido já está sendo preparado. Tente novamente em instantes.");
  }

  try {
    const checkout = await createInfinitePayLink({
      orderNumber: order.order_number,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: `+${order.customer_whatsapp}`,
      },
      items: items.map((item) => ({
        quantity: Number(item.quantity),
        unitPriceCents: Number(item.unit_price_cents),
        description: `${item.model_name} - ${item.color_name} - ${item.size_code}`.slice(0, 120),
      })),
      redirectUrl: publicUrl({ rota: "acompanhar-pedido", pedido: order.order_number }),
      webhookUrl: webhookUrl(),
    });
    await pool.execute(
      `UPDATE payment_checkouts
          SET checkout_url = ?, status = 'pending', raw_response = ?, locked_at = NULL, last_error = NULL
        WHERE order_id = ? AND provider = ?`,
      [checkout.url, JSON.stringify(checkout.response), order.id, provider],
    );
    return { url: checkout.url, reused: false };
  } catch (error) {
    await pool.execute(
      `UPDATE payment_checkouts SET locked_at = NULL, last_error = ? WHERE order_id = ? AND provider = ?`,
      [String(error?.message ?? error).slice(0, 500), order.id, provider],
    );
    if (error instanceof InfinitePayRequestError) {
      throw new PaymentIntegrationError(502, error.code, error.message, error.details);
    }
    throw error;
  }
}

export async function enqueueInfinitePayEvent(payload, source = "webhook") {
  integrationReady();
  let event;
  try {
    event = normalizeInfinitePayEvent(payload, source);
  } catch (error) {
    if (error instanceof InfinitePayRequestError) {
      throw new PaymentIntegrationError(400, error.code, error.message, error.details);
    }
    throw error;
  }
  const [orders] = await pool.execute("SELECT id FROM orders WHERE order_number = ? LIMIT 1", [event.orderNsu]);
  if (orders.length === 0) {
    throw new PaymentIntegrationError(400, "ORDER_NOT_FOUND", "Pedido informado pela InfinitePay não existe.");
  }
  const canonicalPayload = {
    ...event.raw,
    order_nsu: event.orderNsu,
    transaction_nsu: event.transactionNsu,
    invoice_slug: event.invoiceSlug,
    receipt_url: event.receiptUrl,
  };
  const [insert] = await pool.execute(
    `INSERT IGNORE INTO payment_events
      (provider, provider_event_id, event_type, signature_valid, payload, available_at)
     VALUES (?, ?, ?, FALSE, ?, CURRENT_TIMESTAMP(3))`,
    [provider, event.transactionNsu, source === "webhook" ? "payment_approved" : "browser_reconciliation", JSON.stringify(canonicalPayload)],
  );
  return { accepted: true, duplicate: insert.affectedRows === 0 };
}

function queueCondition() {
  return `processed_at IS NULL AND available_at <= CURRENT_TIMESTAMP(3)
    AND (locked_at IS NULL OR locked_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL ${staleLockMinutes} MINUTE))`;
}

export async function processInfinitePayEvents({ limit = 10 } = {}) {
  const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(limit), 10) || 10));
  const [candidates] = await pool.execute(
    `SELECT id FROM payment_events WHERE provider = ? AND ${queueCondition()} ORDER BY available_at, id LIMIT ${safeLimit}`,
    [provider],
  );
  const result = { processed: 0, paid: 0, failed: 0 };

  for (const candidate of candidates) {
    const [claim] = await pool.execute(
      `UPDATE payment_events
          SET locked_at = CURRENT_TIMESTAMP(3), attempts = attempts + 1, processing_error = NULL
        WHERE id = ? AND provider = ? AND ${queueCondition()}`,
      [candidate.id, provider],
    );
    if (claim.affectedRows !== 1) continue;
    result.processed += 1;

    try {
      const [rows] = await pool.execute("SELECT payload FROM payment_events WHERE id = ? LIMIT 1", [candidate.id]);
      if (rows.length !== 1) throw new Error("Evento InfinitePay não encontrado.");
      const payload = typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload;
      const event = normalizeInfinitePayEvent(payload, "queue");
      const checked = await checkInfinitePayPayment({
        orderNsu: event.orderNsu,
        transactionNsu: event.transactionNsu,
        invoiceSlug: event.invoiceSlug,
      });
      if (checked?.success !== true || checked?.paid !== true) {
        throw new Error("payment_check ainda não confirmou o pagamento.");
      }
      const checkedAmount = Number(checked.amount);
      if (!Number.isSafeInteger(checkedAmount) || checkedAmount < 1) {
        throw new Error("payment_check devolveu um valor inválido.");
      }

      await withTransaction(async (connection) => {
        const [orders] = await connection.execute(
          "SELECT id, status, payment_status, total_cents FROM orders WHERE order_number = ? LIMIT 1 FOR UPDATE",
          [event.orderNsu],
        );
        if (orders.length !== 1) throw new Error("Pedido do pagamento não existe.");
        const order = orders[0];
        if (Number(order.total_cents) !== checkedAmount) {
          throw new Error(`Valor divergente: pedido=${order.total_cents}, InfinitePay=${checkedAmount}.`);
        }
        const [transactions] = await connection.execute(
          "SELECT order_id FROM payments WHERE provider = ? AND provider_transaction_id = ? LIMIT 1 FOR UPDATE",
          [provider, event.transactionNsu],
        );
        if (transactions.length > 0 && Number(transactions[0].order_id) !== Number(order.id)) {
          throw new Error("A transação InfinitePay já pertence a outro pedido.");
        }
        const rawResponse = JSON.stringify({ event: payload, payment_check: checked });
        await connection.execute(
          `INSERT INTO payments
            (order_id, provider, provider_order_id, provider_transaction_id, status, amount_cents, raw_response, confirmed_at)
           VALUES (?, ?, ?, ?, 'paid', ?, ?, CURRENT_TIMESTAMP(3))
           ON DUPLICATE KEY UPDATE status = 'paid', amount_cents = VALUES(amount_cents),
             raw_response = VALUES(raw_response), confirmed_at = COALESCE(confirmed_at, CURRENT_TIMESTAMP(3))`,
          [order.id, provider, event.invoiceSlug, event.transactionNsu, checkedAmount, rawResponse],
        );
        await connection.execute(
          `UPDATE orders SET payment_status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP(3))
            WHERE id = ? AND payment_status IN ('pending', 'failed')`,
          [order.id],
        );
        await connection.execute(
          `UPDATE payment_checkouts SET status = 'paid', locked_at = NULL, last_error = NULL
            WHERE order_id = ? AND provider = ?`,
          [order.id, provider],
        );
        await connection.execute(
          `UPDATE payment_events SET signature_valid = TRUE, processed_at = CURRENT_TIMESTAMP(3),
             processing_error = NULL, locked_at = NULL WHERE id = ?`,
          [candidate.id],
        );
      });
      result.paid += 1;
    } catch (error) {
      await pool.execute(
        `UPDATE payment_events
            SET locked_at = NULL, processing_error = ?,
                available_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${retryDelayMinutes} MINUTE)
          WHERE id = ? AND processed_at IS NULL`,
        [String(error?.message ?? error).slice(0, 500), candidate.id],
      );
      result.failed += 1;
      console.error(`Falha ao reconciliar evento InfinitePay ${candidate.id}:`, error);
    }
  }
  return result;
}

export function startInfinitePayReconciliationWorker() {
  if (config.payments.provider !== provider || !config.payments.infinitePay.checkoutEnabled) return () => {};
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processInfinitePayEvents();
    } catch (error) {
      console.error("Falha ao processar a fila InfinitePay:", error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, config.payments.infinitePay.reconciliationIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
