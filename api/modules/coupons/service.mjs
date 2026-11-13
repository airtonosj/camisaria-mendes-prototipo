import { normalizeCouponText } from "../../../shared/domain.mjs";
import * as queries from './repository.mjs';
import { ApiError } from "../../http/response.mjs";
import { requireText, parsePositiveInteger } from "../../http/validation.mjs";

export function normalizeCouponCode(value) {
  const code = normalizeCouponText(value);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    throw new ApiError(422, "INVALID_COUPON_CODE", "Use um cupom de 3 a 32 caracteres, com letras, números, hífen ou sublinhado.");
  }
  return code;
}

export function parseSingleOrderCoupon(body) {
  const value = body.couponCode;
  const hasMultipleValues = body.couponCodes !== undefined
    || Array.isArray(value)
    || (typeof value === "string" && /[,;+|]/.test(value));
  if (hasMultipleValues) {
    throw new ApiError(422, "MULTIPLE_COUPONS_NOT_ALLOWED", "Use somente um cupom por pedido.");
  }
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError(422, "INVALID_COUPON_CODE", "Informe um único código de cupom válido.");
  }
  return normalizeCouponCode(value);
}

export function parseCouponConfig(value) {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Configure o cupom ou envie null para removê-lo.");
  }
  const expiresAt = value.expiresAt ? new Date(value.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new ApiError(422, "VALIDATION_ERROR", "Informe uma data de validade válida para o cupom.");
  }
  const usageLimit = value.usageLimit === null || value.usageLimit === undefined || value.usageLimit === ""
    ? null
    : parsePositiveInteger(value.usageLimit, "coupon.usageLimit", 1_000_000);
  const minimumQuantity = value.minimumQuantity === null || value.minimumQuantity === undefined || value.minimumQuantity === ""
    ? 1
    : parsePositiveInteger(value.minimumQuantity, "coupon.minimumQuantity", 200);
  const maximumDiscountQuantity = value.maximumDiscountQuantity === null
    || value.maximumDiscountQuantity === undefined
    || value.maximumDiscountQuantity === ""
    ? null
    : parsePositiveInteger(value.maximumDiscountQuantity, "coupon.maximumDiscountQuantity", 200);
  if (maximumDiscountQuantity !== null && maximumDiscountQuantity < minimumQuantity) {
    throw new ApiError(422, "VALIDATION_ERROR", "A quantidade máxima com desconto não pode ser menor que a quantidade mínima do cupom.");
  }
  if (!Array.isArray(value.discounts) || value.discounts.length < 1 || value.discounts.length > 4) {
    throw new ApiError(422, "VALIDATION_ERROR", "Defina o desconto do cupom para cada corte ativo.");
  }
  const discounts = value.discounts.map((discount, index) => {
    if (!discount || typeof discount !== "object") {
      throw new ApiError(422, "VALIDATION_ERROR", `Desconto ${index + 1} do cupom inválido.`);
    }
    return {
      modelCode: requireText(discount.modelCode, `coupon.discounts[${index}].modelCode`, 32),
      discountCents: parsePositiveInteger(discount.discountCents, `coupon.discounts[${index}].discountCents`, 10_000_000),
    };
  });
  if (new Set(discounts.map((discount) => discount.modelCode)).size !== discounts.length) {
    throw new ApiError(422, "VALIDATION_ERROR", "Há cortes repetidos na configuração do cupom.");
  }
  return {
    code: normalizeCouponCode(value.code),
    discounts,
    expiresAt,
    usageLimit,
    minimumQuantity,
    maximumDiscountQuantity,
  };
}

export async function couponUsageCount(executor, couponId, lock = false) {
  const [rows] = await queries.couponUsageCountQuery1(executor, [couponId], lock);
  return Number(rows[0]?.used_count ?? 0);
}

export async function couponDiscounts(executor, couponId) {
  const [rows] = await queries.couponDiscountsQuery1(executor, [couponId]);
  return rows.map((row) => ({
    modelId: Number(row.shirt_model_id),
    modelCode: row.model_code,
    modelName: row.model_name,
    discountCents: Number(row.discount_cents),
  }));
}

export function couponPayload(row, usedCount, discounts) {
  if (!row) return null;
  return {
    code: row.code,
    discounts,
    expiresAt: row.expires_at,
    usageLimit: row.usage_limit === null ? null : Number(row.usage_limit),
    minimumQuantity: Number(row.minimum_quantity ?? 1),
    maximumDiscountQuantity: row.maximum_discount_quantity === null ? null : Number(row.maximum_discount_quantity),
    usedCount,
    remainingUses: row.usage_limit === null ? null : Math.max(0, Number(row.usage_limit) - usedCount),
  };
}

export async function activeCampaignCoupon(executor, campaignId) {
  const [rows] = await queries.activeCampaignCouponQuery1(executor, [campaignId]);
  if (rows.length === 0) return null;
  return couponPayload(
    rows[0],
    await couponUsageCount(executor, rows[0].id),
    await couponDiscounts(executor, rows[0].id),
  );
}

export async function validateActiveCoupon(executor, campaignId, rawCode, { lock = false } = {}) {
  const code = normalizeCouponCode(rawCode);
  const [rows] = await queries.validateActiveCouponQuery1(executor, [campaignId, code], lock ? " FOR UPDATE" : "");
  if (rows.length === 0) throw new ApiError(404, "COUPON_NOT_FOUND", "Este cupom não está disponível para a campanha.");
  const coupon = rows[0];
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    throw new ApiError(410, "COUPON_EXPIRED", "Este cupom já expirou.");
  }
  // A locking read sees committed uses after waiting for the coupon lock,
  // even if an earlier query established a REPEATABLE READ snapshot.
  const usedCount = await couponUsageCount(executor, coupon.id, lock);
  if (coupon.usage_limit !== null && usedCount >= Number(coupon.usage_limit)) {
    throw new ApiError(409, "COUPON_EXHAUSTED", "Este cupom atingiu o limite de utilizações.");
  }
  return { ...coupon, usedCount, discounts: await couponDiscounts(executor, coupon.id) };
}

export async function ensureCouponFitsCampaignPrices(connection, campaignId, discounts) {
  const [rows] = await queries.ensureCouponFitsCampaignPricesQuery1(connection, [campaignId]);
  const discountsByModel = new Map(discounts.map((discount) => [discount.modelCode, discount.discountCents]));
  if (rows.length !== discountsByModel.size || rows.some((row) => !discountsByModel.has(row.model_code))) {
    throw new ApiError(422, "COUPON_MODEL_MISMATCH", "Defina exatamente um desconto para cada corte ativo da campanha.");
  }
  for (const row of rows) {
    if (discountsByModel.get(row.model_code) >= Number(row.minimum_price)) {
      throw new ApiError(422, "COUPON_DISCOUNT_TOO_HIGH", `O desconto de ${row.model_name} precisa ser menor que o preço desse corte.`);
    }
  }
  return new Map(rows.map((row) => [row.model_code, Number(row.shirt_model_id)]));
}

export async function applyCampaignCoupon(connection, campaignId, value) {
  const coupon = parseCouponConfig(value);
  await queries.applyCampaignCouponQuery1(connection, [campaignId]);
  if (!coupon) return;
  const modelIds = await ensureCouponFitsCampaignPrices(connection, campaignId, coupon.discounts);
  const [existing] = await queries.applyCampaignCouponQuery2(connection, [campaignId, coupon.code]);
  let couponId;
  if (existing.length > 0) {
    couponId = existing[0].id;
    await queries.applyCampaignCouponQuery3(connection, [coupon.expiresAt, coupon.usageLimit, coupon.minimumQuantity, coupon.maximumDiscountQuantity, couponId]);
    await queries.applyCampaignCouponQuery4(connection, [couponId]);
  } else {
    const [created] = await queries.applyCampaignCouponQuery5(connection, [campaignId, coupon.code, coupon.expiresAt, coupon.usageLimit, coupon.minimumQuantity, coupon.maximumDiscountQuantity]);
    couponId = created.insertId;
  }
  for (const discount of coupon.discounts) {
    await queries.applyCampaignCouponQuery6(connection, [couponId, modelIds.get(discount.modelCode), discount.discountCents]);
  }
}
