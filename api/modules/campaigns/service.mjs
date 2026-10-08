import { validDeliveryDate } from '../../../shared/delivery.mjs';

import * as queries from './repository.mjs';
import fs from "node:fs/promises";
import path from "node:path";

import { pool, withTransaction } from "../../database.mjs";
import { campaignPhases, campaignSizeCodesByModel, uploadsDirectory, maxVideoUploadBytes } from "../../runtime/constants.mjs";
import { ApiError } from "../../http/response.mjs";
import { requireText, normalizeHexColor, optionalText, normalizeWhatsapp, parsePositiveInteger } from "../../http/validation.mjs";
import { normalizeCampaignCode, suggestedCampaignCode, parseDeadline } from "./validation.mjs";
import { couponDiscounts, couponPayload, activeCampaignCoupon, validateActiveCoupon, ensureCouponFitsCampaignPrices, applyCampaignCoupon } from "../coupons/service.mjs";
import { assertCampaignReceiverChangeAllowed, defaultInfinitePayHandle, resolveCampaignReceiver } from "../receivers/service.mjs";
import { findReceiverQuery } from "../receivers/repository.mjs";

function parseDeliveryDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!validDeliveryDate(value)) throw new ApiError(422, 'VALIDATION_ERROR', 'Informe uma data de entrega válida no formato AAAA-MM-DD.');
  return value;
}

/** Resumo do recebedor para o painel. A página pública nunca recebe a conta de destino. */
function campaignReceiverSummary(row) {
  if (!row) return null;
  return { id: Number(row.id), name: row.name, infinitepayHandle: row.infinitepay_handle, active: Boolean(row.active) };
}

export function parseArtRenderMode(value) {
  if (value === "overlay" || value === "variant_mockup" || value === "legacy_mockup") return value;
  throw new ApiError(422, "VALIDATION_ERROR", "O modo de exibição da arte é inválido.");
}

export function parsePresentationConfig(value, fallback = { mockupEnabled: true, realPhotosEnabled: false }) {
  if (value === undefined) return fallback;
  if (!value || typeof value !== "object") {
    throw new ApiError(422, "VALIDATION_ERROR", "Configure como as imagens da campanha serão exibidas.");
  }
  const presentation = {
    mockupEnabled: Boolean(value.mockupEnabled),
    realPhotosEnabled: Boolean(value.realPhotosEnabled),
  };
  if (!presentation.mockupEnabled && !presentation.realPhotosEnabled) {
    throw new ApiError(422, "CAMPAIGN_VISUAL_REQUIRED", "Ative o mockup, as fotos reais ou ambos.");
  }
  return presentation;
}

export const defaultArtworkTransform = Object.freeze({ x: 0, y: 0, scale: 1, rotation: 0 });

export function parseArtworkNumber(value, field, minimum, maximum, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiError(422, "VALIDATION_ERROR", `O ajuste ${field} está fora do intervalo permitido.`);
  }
  return parsed;
}

export function parseArtworkTransform(value, field, fallback = defaultArtworkTransform) {
  const transform = value && typeof value === "object" ? value : {};
  return {
    x: parseArtworkNumber(transform.x, `${field}.x`, -100, 100, fallback.x),
    y: parseArtworkNumber(transform.y, `${field}.y`, -100, 100, fallback.y),
    scale: parseArtworkNumber(transform.scale, `${field}.scale`, 0.1, 3, fallback.scale),
    rotation: parseArtworkNumber(transform.rotation, `${field}.rotation`, -180, 180, fallback.rotation),
  };
}

export function transformFromRow(row, prefix) {
  return {
    x: Number(row?.[`${prefix}_x`] ?? 0),
    y: Number(row?.[`${prefix}_y`] ?? 0),
    scale: Number(row?.[`${prefix}_scale`] ?? 1),
    rotation: Number(row?.[`${prefix}_rotation`] ?? 0),
  };
}

export function parseArtworkSide(value, field, mode, side, baseAvailable) {
  const input = value && typeof value === "object" ? value : {};
  const source = String(input.source ?? (mode === "overlay" ? "inherit" : "none"));
  const allowed = mode === "overlay" ? ["inherit", "custom", "none"] : ["custom", "none"];
  if (!allowed.includes(source) || (mode === "overlay" && side === "front" && source === "none")) {
    throw new ApiError(422, "VALIDATION_ERROR", `A origem de ${field} é inválida.`);
  }
  if (source === "inherit" && !baseAvailable && side === "front") {
    throw new ApiError(422, "VALIDATION_ERROR", "A frente precisa herdar uma arte-base existente ou usar uma arte personalizada.");
  }
  const url = source === "custom" ? requireText(input.url, `${field}.url`, 2048) : null;
  return { source, url, transform: parseArtworkTransform(input.transform, `${field}.transform`) };
}

export function campaignBaseArtwork(campaign) {
  return {
    front: campaign.art_front_url ? { url: campaign.art_front_url, transform: transformFromRow(campaign, "art_front") } : null,
    back: campaign.art_back_url ? { url: campaign.art_back_url, transform: transformFromRow(campaign, "art_back") } : null,
  };
}

export function resolveVariantArtwork(campaign, variant) {
  const base = campaignBaseArtwork(campaign);
  if (campaign.art_render_mode === "legacy_mockup") return { front: base.front, back: base.back };
  const hasConfig = Boolean(variant.artwork_mode);
  const resolve = (side) => {
    const source = hasConfig ? variant[`${side}_source`] : campaign.art_render_mode === "overlay" ? "inherit" : "none";
    if (source === "none") return null;
    const inherited = source === "inherit";
    const url = inherited ? base[side]?.url : variant[`${side}_url`];
    if (!url) return null;
    return {
      url,
      transform: campaign.art_render_mode === "overlay"
        ? (hasConfig && (!inherited || Boolean(variant[`${side}_transform_override`]))
          ? transformFromRow(variant, side)
          : base[side]?.transform ?? defaultArtworkTransform)
        : defaultArtworkTransform,
    };
  };
  return { front: resolve("front"), back: resolve("back") };
}

export function rawVariantArtworkConfig(row) {
  if (!row) return null;
  return {
    front: {
      source: row.front_source,
      url: row.front_url,
      transformOverride: Boolean(row.front_transform_override),
      transform: transformFromRow(row, "front"),
    },
    back: {
      source: row.back_source,
      url: row.back_url,
      transformOverride: Boolean(row.back_transform_override),
      transform: transformFromRow(row, "back"),
    },
  };
}

export async function getCampaign(code, { includeCoupon = false, includeReceiver = false } = {}) {
  const [campaignRows] = await queries.getCampaignQuery1(pool, [code]);
  if (campaignRows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const campaign = campaignRows[0];
  const [variants] = await queries.getCampaignQuery2(pool, [campaign.art_render_mode, campaign.id]);
  const [sizes] = await queries.getCampaignQuery3(pool, [campaign.id]);
  const [allArtworkRows] = await queries.getCampaignQuery4(pool, [campaign.id]);
  const [realPhotoRows] = await queries.getCampaignQuery5(pool, [campaign.id]);
  const [realVideoRows] = await queries.getCampaignQuery6(pool, [campaign.id]);
  const activeCoupon = includeCoupon ? await activeCampaignCoupon(pool, campaign.id) : undefined;
  const receiver = includeReceiver && campaign.receiver_id
    ? campaignReceiverSummary((await findReceiverQuery(pool, [campaign.receiver_id]))[0][0])
    : null;
  const realPhotosByColorId = new Map();
  for (const row of realPhotoRows) {
    const photos = realPhotosByColorId.get(Number(row.color_id)) ?? [];
    photos.push(row.photo_url);
    realPhotosByColorId.set(Number(row.color_id), photos);
  }
  const artworkConfigsByVariant = new Map();
  for (const row of allArtworkRows) {
    const current = artworkConfigsByVariant.get(Number(row.campaign_variant_id)) ?? {};
    current[row.artwork_mode] = rawVariantArtworkConfig(row);
    artworkConfigsByVariant.set(Number(row.campaign_variant_id), current);
  }
  return {
    id: campaign.id,
    code: campaign.code,
    title: campaign.title,
    subtitle: campaign.subtitle,
    phase: campaign.phase,
    deadlineAt: campaign.deadline_at,
    deliveryExpectedOn: campaign.delivery_expected_on,
    deliveryNote: campaign.delivery_note,
    pickupInstructions: campaign.pickup_instructions,
    representativeName: campaign.representative_name,
    // Contato do representante para dúvidas e retirada do pedido.
    representativeWhatsapp: campaign.representative_whatsapp,
    artFrontUrl: campaign.art_front_url,
    artBackUrl: campaign.art_back_url,
    artRenderMode: campaign.art_render_mode,
    presentationConfig: {
      mockupEnabled: Boolean(campaign.mockup_enabled),
      realPhotosEnabled: Boolean(campaign.real_photos_enabled),
    },
    artworkConfig: {
      mode: campaign.art_render_mode,
      base: campaignBaseArtwork(campaign),
    },
    variants: variants.map((variant) => ({
      id: variant.id,
      model: { code: variant.model_code, name: variant.model_name },
      color: { name: variant.color_name, hex: variant.hex_color },
      unitPriceCents: variant.unit_price_cents,
      artwork: resolveVariantArtwork(campaign, variant),
      artworkConfig: rawVariantArtworkConfig(variant.artwork_mode ? variant : null),
      artworkConfigs: artworkConfigsByVariant.get(Number(variant.id)) ?? {},
      realPhotoUrls: realPhotosByColorId.get(Number(variant.color_id)) ?? [],
    })),
    realPhotos: [...new Map(realPhotoRows.map((row) => [row.color_name, {
      colorName: row.color_name,
      urls: realPhotosByColorId.get(Number(row.color_id)) ?? [],
    }])).values()],
    realVideos: realVideoRows.map((row) => ({
      colorName: row.color_name,
      url: row.video_url,
      posterUrl: row.poster_url,
      durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
      bytes: Number(row.bytes),
    })),
    ...(includeCoupon ? { activeCoupon } : {}),
    ...(includeReceiver ? { receiver } : {}),
    sizes: sizes.map((size) => ({
      model: { code: size.model_code, name: size.model_name },
      code: size.code,
      name: size.name,
      group: size.size_group,
    })),
  };
}

export async function getPublicCampaignCoupon(campaignCode, rawCouponCode) {
  const [campaignRows] = await queries.getPublicCampaignCouponQuery1(pool, [campaignCode]);
  if (campaignRows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const coupon = await validateActiveCoupon(pool, campaignRows[0].id, rawCouponCode);
  await ensureCouponFitsCampaignPrices(pool, campaignRows[0].id, coupon.discounts);
  return {
    code: coupon.code,
    discounts: coupon.discounts,
    expiresAt: coupon.expires_at,
    minimumQuantity: Number(coupon.minimum_quantity ?? 1),
    maximumDiscountQuantity: coupon.maximum_discount_quantity === null ? null : Number(coupon.maximum_discount_quantity),
  };
}

export async function listCampaigns() {
  const [rows] = await queries.listCampaignsQuery1(pool, []);
  const [couponRows] = await queries.listCampaignsQuery2(pool, []);
  const [priceRows] = await queries.listCampaignPrices(pool);
  const pricesByCampaign = new Map();
  for (const price of priceRows) {
    const id = Number(price.campaign_id);
    const prices = pricesByCampaign.get(id) ?? [];
    prices.push({ modelName: price.model_name, minPriceCents: Number(price.min_price_cents), maxPriceCents: Number(price.max_price_cents) });
    pricesByCampaign.set(id, prices);
  }
  const couponsByCampaign = new Map();
  const couponHistoryByCampaign = new Map();
  for (const row of couponRows) {
    const campaignId = Number(row.campaign_id);
    const history = couponHistoryByCampaign.get(campaignId) ?? [];
    history.push({
      id: Number(row.id), code: row.code, active: Boolean(row.active),
      usedCount: Number(row.used_count), paidCount: Number(row.paid_count),
      pendingCount: Number(row.pending_count), cancelledCount: Number(row.cancelled_count),
      refundedCount: Number(row.refunded_count), failedCount: Number(row.failed_count),
      usageLimit: row.usage_limit === null ? null : Number(row.usage_limit),
    });
    couponHistoryByCampaign.set(campaignId, history);
    if (row.active) couponsByCampaign.set(
      Number(row.campaign_id),
      couponPayload(row, Number(row.used_count), await couponDiscounts(pool, row.id)),
    );
  }
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    subtitle: row.subtitle,
    phase: row.phase,
    deadlineAt: row.deadline_at,
    deliveryExpectedOn: row.delivery_expected_on,
    deliveryNote: row.delivery_note,
    createdAt: row.created_at,
    pickupInstructions: row.pickup_instructions,
    representative: { name: row.representative_name, whatsapp: row.representative_whatsapp },
    artFrontUrl: row.cover_art_url,
    artBackUrl: row.art_back_url,
    artRenderMode: row.art_render_mode,
    orderCount: Number(row.order_count),
    paidTotalCents: Number(row.paid_total_cents),
    basePrices: pricesByCampaign.get(Number(row.id)) ?? [],
    canDelete: Boolean(row.can_delete),
    activeCoupon: couponsByCampaign.get(Number(row.id)) ?? null,
    couponHistory: couponHistoryByCampaign.get(Number(row.id)) ?? [],
    receiver: row.receiver_id ? campaignReceiverSummary({
      id: row.receiver_id, name: row.receiver_name, infinitepay_handle: row.receiver_handle, active: row.receiver_active,
    }) : null,
  }));
}

/** Valida a configuração de cortes que a campanha recebe ao ser criada ou editada. */
export function parseCampaignModels(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    throw new ApiError(422, "VALIDATION_ERROR", "A campanha precisa configurar ao menos um corte.");
  }
  const models = value.map((model) => {
    if (!model || typeof model !== "object") throw new ApiError(422, "VALIDATION_ERROR", "Corte de campanha inválido.");
    const modelCode = requireText(model.modelCode, "models.modelCode", 32);
    const unitPriceCents = parsePositiveInteger(model.unitPriceCents, "models.unitPriceCents", 10_000_000);
    if (!Array.isArray(model.colors) || model.colors.length < 1 || model.colors.length > 12) {
      throw new ApiError(422, "VALIDATION_ERROR", `Selecione ao menos uma cor para ${modelCode}.`);
    }
    const colors = model.colors.map((color, colorIndex) => {
      // Aceita o formato antigo (somente o nome) para não quebrar clientes ainda abertos.
      if (typeof color === "string") return { name: requireText(color, `models.colors[${colorIndex}]`, 80), hex: null };
      if (!color || typeof color !== "object") throw new ApiError(422, "VALIDATION_ERROR", `Cor inválida em ${modelCode}.`);
      return {
        name: requireText(color.name, `models.colors[${colorIndex}].name`, 80),
        hex: normalizeHexColor(color.hex, `models.colors[${colorIndex}].hex`),
      };
    });
    const colorKeys = colors.map((color) => color.name.toLocaleLowerCase("pt-BR"));
    if (new Set(colorKeys).size !== colorKeys.length) throw new ApiError(422, "VALIDATION_ERROR", `Há cores repetidas em ${modelCode}.`);
    if (!Array.isArray(model.sizes) || model.sizes.length < 1 || model.sizes.length > 24) {
      throw new ApiError(422, "VALIDATION_ERROR", `Selecione ao menos um tamanho para ${modelCode}.`);
    }
    const sizes = model.sizes.map((size) => requireText(size, "models.sizes", 8).toUpperCase());
    if (new Set(sizes).size !== sizes.length) throw new ApiError(422, "VALIDATION_ERROR", `Há tamanhos repetidos em ${modelCode}.`);
    const allowedSizes = campaignSizeCodesByModel.get(modelCode);
    const unavailableSize = allowedSizes && sizes.find((size) => !allowedSizes.has(size));
    if (unavailableSize) {
      throw new ApiError(422, "INVALID_SIZE", `O tamanho ${unavailableSize} não está disponível para o corte ${modelCode}.`);
    }
    return { modelCode, unitPriceCents, colors, sizes };
  });
  if (new Set(models.map((model) => model.modelCode)).size !== models.length) {
    throw new ApiError(422, "VALIDATION_ERROR", "Há cortes repetidos na campanha.");
  }
  return models;
}

/** Traduz códigos do catálogo em identificadores, recusando qualquer um desconhecido. */
export async function resolveCatalogIds(connection, models) {
  const modelCodes = [...new Set(models.map((model) => model.modelCode))];
  const [modelRows] = await queries.resolveCatalogIdsQuery1(connection, modelCodes, modelCodes.map(() => "?").join(", "));
  if (modelRows.length !== modelCodes.length) throw new ApiError(422, "INVALID_MODEL", "Um dos modelos selecionados não está cadastrado.");

  const colorDefinitions = new Map();
  for (const color of models.flatMap((model) => model.colors)) {
    const key = color.name.toLocaleLowerCase("pt-BR");
    const current = colorDefinitions.get(key);
    if (current?.hex && color.hex && current.hex !== color.hex) {
      throw new ApiError(422, "VALIDATION_ERROR", `A cor ${color.name} foi enviada com códigos HEX diferentes.`);
    }
    colorDefinitions.set(key, { name: current?.name ?? color.name, hex: current?.hex ?? color.hex });
  }
  const colorNames = [...colorDefinitions.values()].map((color) => color.name);
  const [colorRows] = await queries.resolveCatalogIdsQuery2(connection, colorNames, colorNames.map(() => "?").join(", "));
  const storedColors = new Map(colorRows.map((row) => [row.name.toLocaleLowerCase("pt-BR"), row]));
  const colorIdsByKey = new Map();
  for (const [key, color] of colorDefinitions) {
    const stored = storedColors.get(key);
    if (stored) {
      if (color.hex && stored.hex_color.toUpperCase() !== color.hex) {
        throw new ApiError(409, "COLOR_NAME_CONFLICT", `A cor ${color.name} já existe com o código ${stored.hex_color}. Use outro nome para cadastrar ${color.hex}.`);
      }
      if (!stored.active) await queries.resolveCatalogIdsQuery3(connection, [stored.id]);
      colorIdsByKey.set(key, stored.id);
      continue;
    }
    if (!color.hex) throw new ApiError(422, "INVALID_COLOR", `A cor ${color.name} não está cadastrada e precisa informar o código HEX.`);
    const [created] = await queries.resolveCatalogIdsQuery4(connection, [color.name, color.hex]);
    colorIdsByKey.set(key, created.insertId);
  }
  const colorIds = new Map(models.flatMap((model) => model.colors.map((color) => [color.name, colorIdsByKey.get(color.name.toLocaleLowerCase("pt-BR"))])));

  const sizeCodes = [...new Set(models.flatMap((model) => model.sizes))];
  const [sizeRows] = await queries.resolveCatalogIdsQuery5(connection, sizeCodes, sizeCodes.map(() => "?").join(", "));
  if (sizeRows.length !== sizeCodes.length) throw new ApiError(422, "INVALID_SIZE", "Um dos tamanhos selecionados não está cadastrado.");

  return {
    modelIds: new Map(modelRows.map((row) => [row.code, row.id])),
    colorIds,
    sizeIds: new Map(sizeRows.map((row) => [row.code, row.id])),
  };
}

export function parseBaseArtworkSide(value, field, required) {
  if (value === undefined || value === null) {
    if (required) throw new ApiError(422, "VALIDATION_ERROR", "A arte-base de frente é obrigatória no modo automático.");
    return null;
  }
  if (!value || typeof value !== "object") throw new ApiError(422, "VALIDATION_ERROR", `A configuração ${field} é inválida.`);
  return {
    url: requireText(value.url, `${field}.url`, 2048),
    transform: parseArtworkTransform(value.transform, `${field}.transform`),
  };
}

/** Persiste arte sem depender do id da variante no cliente, que ainda não existe na criação. */
export async function applyArtworkConfig(connection, campaignId, value) {
  if (!value || typeof value !== "object") throw new ApiError(422, "VALIDATION_ERROR", "Configure as artes da campanha.");
  const mode = parseArtRenderMode(value.mode);
  if (mode === "legacy_mockup") throw new ApiError(422, "VALIDATION_ERROR", "O modo legado é reservado para campanhas antigas.");
  const base = mode === "overlay" ? {
    front: parseBaseArtworkSide(value.base?.front, "artworkConfig.base.front", true),
    back: parseBaseArtworkSide(value.base?.back, "artworkConfig.base.back", false),
  } : { front: null, back: null };

  const [campaignRows] = await queries.applyArtworkConfigQuery1(connection, [campaignId]);
  const oldUrls = [campaignRows[0]?.art_front_url, campaignRows[0]?.art_back_url];
  if (mode === "overlay") {
    await queries.applyArtworkConfigQuery2(connection, [
        mode, base.front.url, base.back?.url ?? null,
        base.front.transform.x, base.front.transform.y, base.front.transform.scale, base.front.transform.rotation,
        base.back?.transform.x ?? 0, base.back?.transform.y ?? 0, base.back?.transform.scale ?? 1, base.back?.transform.rotation ?? 0,
        campaignId,
      ]);
  } else {
    // A arte-base do modo automático fica guardada para uma futura volta de modo.
    await queries.applyArtworkConfigQuery3(connection, [mode, campaignId]);
  }

  const [variants] = await queries.applyArtworkConfigQuery4(connection, [campaignId]);
  const supplied = Array.isArray(value.variants) ? value.variants : [];
  const configs = new Map();
  for (const [index, item] of supplied.entries()) {
    if (!item || typeof item !== "object") throw new ApiError(422, "VALIDATION_ERROR", `A arte da combinação ${index + 1} é inválida.`);
    const modelCode = requireText(item.modelCode, `artworkConfig.variants[${index}].modelCode`, 32);
    const colorName = requireText(item.colorName, `artworkConfig.variants[${index}].colorName`, 80);
    const key = `${modelCode}:${colorName.toLocaleLowerCase("pt-BR")}`;
    if (configs.has(key)) throw new ApiError(422, "VALIDATION_ERROR", "Há configurações de arte repetidas.");
    configs.set(key, item);
  }

  for (const variant of variants) {
    const key = `${variant.model_code}:${variant.color_name.toLocaleLowerCase("pt-BR")}`;
    const configured = configs.get(key);
    if (mode === "variant_mockup" && !configured) {
      throw new ApiError(422, "VARIANT_ARTWORK_REQUIRED", `Envie ao menos uma imagem para ${variant.model_name} · ${variant.color_name}.`);
    }
    const front = parseArtworkSide(
      configured?.front,
      `artworkConfig.${variant.model_code}.${variant.color_name}.front`,
      mode,
      "front",
      Boolean(base.front),
    );
    const back = parseArtworkSide(
      configured?.back,
      `artworkConfig.${variant.model_code}.${variant.color_name}.back`,
      mode,
      "back",
      Boolean(base.back),
    );
    if (mode === "variant_mockup" && front.source !== "custom" && back.source !== "custom") {
      throw new ApiError(422, "VARIANT_ARTWORK_REQUIRED", `Envie frente ou costas para ${variant.model_name} · ${variant.color_name}.`);
    }
    const frontOverride = Boolean(configured?.front?.transformOverride);
    const backOverride = Boolean(configured?.back?.transformOverride);
    const [oldRows] = await queries.applyArtworkConfigQuery5(connection, [variant.id, mode]);
    if (oldRows[0]) oldUrls.push(oldRows[0].front_url, oldRows[0].back_url);
    await queries.applyArtworkConfigQuery6(connection, [
        variant.id, mode,
        front.source, front.url, frontOverride, front.transform.x, front.transform.y, front.transform.scale, front.transform.rotation,
        back.source, back.url, backOverride, back.transform.x, back.transform.y, back.transform.scale, back.transform.rotation,
      ]);
    configs.delete(key);
  }
  if (configs.size > 0) throw new ApiError(422, "INVALID_VARIANT", "Uma arte foi enviada para uma combinação que não está ativa na campanha.");
  return [...new Set(oldUrls.filter(Boolean))];
}

export function parseRealPhotoConfig(value) {
  if (!Array.isArray(value) || value.length > 32) {
    throw new ApiError(422, "VALIDATION_ERROR", "As fotos reais precisam ser organizadas por cor.");
  }
  const configs = new Map();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") {
      throw new ApiError(422, "VALIDATION_ERROR", `A galeria ${index + 1} é inválida.`);
    }
    const colorName = requireText(item.colorName, `realPhotos[${index}].colorName`, 80);
    const key = colorName.toLocaleLowerCase("pt-BR");
    if (configs.has(key)) throw new ApiError(422, "VALIDATION_ERROR", `A cor ${colorName} foi repetida nas fotos reais.`);
    if (!Array.isArray(item.urls) || item.urls.length > 6) {
      throw new ApiError(422, "VALIDATION_ERROR", `Envie no máximo seis fotos reais para ${colorName}.`);
    }
    const urls = item.urls.map((rawUrl, photoIndex) => {
      const url = requireText(rawUrl, `realPhotos[${index}].urls[${photoIndex}]`, 2048);
      if (!/^\/uploads\/[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(url)) {
        throw new ApiError(422, "INVALID_UPLOAD", `Uma foto real de ${colorName} não pertence aos uploads da campanha.`);
      }
      return url;
    });
    if (new Set(urls).size !== urls.length) {
      throw new ApiError(422, "VALIDATION_ERROR", `A galeria de ${colorName} possui fotos repetidas.`);
    }
    configs.set(key, { colorName, urls });
  }
  return configs;
}

/** Substitui apenas as galerias das cores ativas; cores desativadas permanecem preservadas. */
export async function applyRealPhotos(connection, campaignId, value) {
  const configs = parseRealPhotoConfig(value);
  const [activeColors] = await queries.applyRealPhotosQuery1(connection, [campaignId]);
  const activeByKey = new Map(activeColors.map((color) => [color.name.toLocaleLowerCase("pt-BR"), color]));
  for (const config of configs.values()) {
    if (!activeByKey.has(config.colorName.toLocaleLowerCase("pt-BR"))) {
      throw new ApiError(422, "INVALID_COLOR", `A cor ${config.colorName} não está ativa nesta campanha.`);
    }
  }

  const oldUrls = [];
  for (const color of activeColors) {
    const [oldRows] = await queries.applyRealPhotosQuery2(connection, [campaignId, color.id]);
    oldUrls.push(...oldRows.map((row) => row.photo_url));
    await queries.applyRealPhotosQuery3(connection, [campaignId, color.id]);
    const urls = configs.get(color.name.toLocaleLowerCase("pt-BR"))?.urls ?? [];
    for (const [sortOrder, url] of urls.entries()) {
      await queries.applyRealPhotosQuery4(connection, [campaignId, color.id, url, sortOrder]);
    }
  }
  return [...new Set(oldUrls.filter(Boolean))];
}

export function parseRealVideoConfig(value) {
  if (!Array.isArray(value) || value.length > 32) {
    throw new ApiError(422, "VALIDATION_ERROR", "Os videos precisam ser organizados por cor.");
  }
  const configs = new Map();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") {
      throw new ApiError(422, "VALIDATION_ERROR", `O video ${index + 1} e invalido.`);
    }
    const colorName = requireText(item.colorName, `realVideos[${index}].colorName`, 80);
    const key = colorName.toLocaleLowerCase("pt-BR");
    if (configs.has(key)) throw new ApiError(422, "VALIDATION_ERROR", `A cor ${colorName} possui mais de um video.`);
    const url = requireText(item.url, `realVideos[${index}].url`, 2048);
    if (!/^\/uploads\/[0-9a-f-]{36}\.mp4$/i.test(url)) {
      throw new ApiError(422, "INVALID_UPLOAD", `O video de ${colorName} nao pertence aos uploads da campanha.`);
    }
    const posterUrl = optionalText(item.posterUrl, 2048);
    if (posterUrl && !/^\/uploads\/[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(posterUrl)) {
      throw new ApiError(422, "INVALID_UPLOAD", `A capa do video de ${colorName} nao pertence aos uploads da campanha.`);
    }
    const durationSeconds = item.durationSeconds === null || item.durationSeconds === undefined
      ? null
      : Number(item.durationSeconds);
    if (durationSeconds !== null && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 15.05)) {
      throw new ApiError(422, "INVALID_VIDEO_DURATION", `O video de ${colorName} deve ter no maximo 15 segundos.`);
    }
    const bytes = Number(item.bytes);
    if (!Number.isInteger(bytes) || bytes <= 0 || bytes > maxVideoUploadBytes) {
      throw new ApiError(422, "INVALID_VIDEO_SIZE", `O video de ${colorName} deve ter no maximo 10 MB.`);
    }
    configs.set(key, { colorName, url, posterUrl, durationSeconds, bytes });
  }
  return configs;
}

/** Substitui videos apenas das cores ativas; midias de cores desativadas ficam preservadas. */
export async function applyRealVideos(connection, campaignId, value) {
  const configs = parseRealVideoConfig(value);
  const [activeColors] = await queries.applyRealVideosQuery1(connection, [campaignId]);
  const activeByKey = new Map(activeColors.map((color) => [color.name.toLocaleLowerCase("pt-BR"), color]));
  for (const config of configs.values()) {
    if (!activeByKey.has(config.colorName.toLocaleLowerCase("pt-BR"))) {
      throw new ApiError(422, "INVALID_COLOR", `A cor ${config.colorName} nao esta ativa nesta campanha.`);
    }
  }

  const oldUrls = [];
  for (const color of activeColors) {
    const [oldRows] = await queries.applyRealVideosQuery2(connection, [campaignId, color.id]);
    oldUrls.push(...oldRows.flatMap((row) => [row.video_url, row.poster_url]).filter(Boolean));
    const config = configs.get(color.name.toLocaleLowerCase("pt-BR"));
    if (!config) {
      await queries.applyRealVideosQuery3(connection, [campaignId, color.id]);
      continue;
    }
    await queries.applyRealVideosQuery4(connection, [campaignId, color.id, config.url, config.posterUrl, config.durationSeconds, config.bytes]);
  }
  return [...new Set(oldUrls)];
}

export async function validateRealPhotoCoverage(connection, campaignId) {
  const [missing] = await queries.validateRealPhotoCoverageQuery1(connection, [campaignId, campaignId]);
  if (missing.length > 0) {
    throw new ApiError(422, "REAL_PHOTO_REQUIRED", `Envie pelo menos uma foto real para a cor ${missing[0].name}.`);
  }
}

export async function validateMockupCoverage(connection, campaignId) {
  const [campaignRows] = await queries.validateMockupCoverageQuery1(connection, [campaignId]);
  const campaign = campaignRows[0];
  if (!campaign) return;
  if (campaign.art_render_mode === "overlay" && !campaign.art_front_url) {
    throw new ApiError(422, "MOCKUP_REQUIRED", "Envie a arte-base de frente para habilitar o mockup.");
  }
  if (campaign.art_render_mode === "legacy_mockup" && !campaign.art_front_url && !campaign.art_back_url) {
    throw new ApiError(422, "MOCKUP_REQUIRED", "Envie uma imagem para habilitar o mockup.");
  }
  if (campaign.art_render_mode === "variant_mockup") {
    const [missing] = await queries.validateMockupCoverageQuery2(connection, [campaignId]);
    if (missing.length > 0) {
      throw new ApiError(422, "MOCKUP_REQUIRED", `Envie frente ou costas para ${missing[0].model_name} · ${missing[0].color_name}.`);
    }
  }
}

/** @param {{staff:{id:number}, body:import("../../../shared/contracts").CreateCampaignPayload}} input Validated at the HTTP/service boundary. */
export async function createCampaign({ staff, body }) {
  const title = requireText(body.title, "title", 180);
  const code = body.code ? normalizeCampaignCode(body.code) : suggestedCampaignCode(title);
  const subtitle = optionalText(body.subtitle, 255);
  const deadlineAt = parseDeadline(body.deadlineAt);
  const pickupInstructions = requireText(body.pickupInstructions, "pickupInstructions", 255);
  const representative = body.representative ?? {};
  const representativeName = requireText(representative.name, "representative.name", 160);
  const representativeWhatsapp = normalizeWhatsapp(representative.whatsapp, "representative.whatsapp");
  const artworkConfig = body.artworkConfig;
  const presentation = parsePresentationConfig(body.presentationConfig, {
    mockupEnabled: Boolean(artworkConfig || body.artFrontUrl),
    realPhotosEnabled: false,
  });
  const artFrontUrl = artworkConfig || !presentation.mockupEnabled ? optionalText(body.artFrontUrl, 2048) : requireText(body.artFrontUrl, "artFrontUrl", 2048);
  const artBackUrl = optionalText(body.artBackUrl, 2048);
  const artRenderMode = artworkConfig ? parseArtRenderMode(artworkConfig.mode) : body.artRenderMode === undefined ? "legacy_mockup" : parseArtRenderMode(body.artRenderMode);
  const models = parseCampaignModels(body.models);

  await withTransaction(async (connection) => {
    const [existing] = await queries.createCampaignQuery1(connection, [code]);
    if (existing.length > 0) throw new ApiError(409, "CAMPAIGN_CODE_EXISTS", "Já existe uma campanha com esse código.");
    const { modelIds, colorIds, sizeIds } = await resolveCatalogIds(connection, models);
    const receiver = body.receiverId === undefined ? null : await resolveCampaignReceiver(connection, body.receiverId);

    const [campaignResult] = await queries.createCampaignQuery2(connection, [code, title, subtitle, deadlineAt, pickupInstructions, representativeName, representativeWhatsapp, artFrontUrl, artBackUrl, artRenderMode, presentation.mockupEnabled, presentation.realPhotosEnabled, staff.id, receiver?.id ?? null, parseDeliveryDate(body.deliveryExpectedOn), optionalText(body.deliveryNote, 255)]);
    for (const model of models) {
      for (const color of model.colors) {
        await queries.createCampaignQuery3(connection, [campaignResult.insertId, modelIds.get(model.modelCode), colorIds.get(color.name), model.unitPriceCents]);
      }
      for (const size of model.sizes) {
        await queries.createCampaignQuery4(connection, [campaignResult.insertId, modelIds.get(model.modelCode), sizeIds.get(size)]);
      }
    }
    if (artworkConfig) await applyArtworkConfig(connection, campaignResult.insertId, artworkConfig);
    if (body.realPhotos !== undefined) await applyRealPhotos(connection, campaignResult.insertId, body.realPhotos);
    if (body.realVideos !== undefined) await applyRealVideos(connection, campaignResult.insertId, body.realVideos);
    if (body.coupon !== undefined) await applyCampaignCoupon(connection, campaignResult.insertId, body.coupon);
    if (presentation.mockupEnabled) await validateMockupCoverage(connection, campaignResult.insertId);
    if (presentation.realPhotosEnabled) await validateRealPhotoCoverage(connection, campaignResult.insertId);
  });
  return getCampaign(code, { includeCoupon: true, includeReceiver: true });
}

/**
 * Edição de campanha. Corrigir um preço errado ou uma data trocada não pode exigir criar
 * outra campanha, que invalidaria o link já entregue à turma.
 *
 * O que é sempre editável — título, subtítulo, prazo, retirada, representante e arte —
 * não altera o que já foi comprado. Preço, cores e tamanhos só mudam enquanto a campanha
 * está recebendo pedidos: mexer neles com pedido pago no meio desalinha produção e
 * cobrança. E nenhuma cor ou tamanho já pedido pode sair, mesmo nessa fase: a recusa diz
 * qual pedido trava, para a camisaria saber o que negociar.
 */
/** @param {{body:import("../../../shared/contracts").UpdateCampaignPayload}} input Validated at the HTTP/service boundary. */
export async function updateCampaign({ body }, code) {

  const changed = await withTransaction(async (connection) => {
    const [rows] = await queries.updateCampaignQuery1(connection, [code]);
    if (rows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    const campaign = rows[0];
    const presentation = parsePresentationConfig(body.presentationConfig, {
      mockupEnabled: Boolean(campaign.mockup_enabled),
      realPhotosEnabled: Boolean(campaign.real_photos_enabled),
    });
    const orphanCandidates = [];

    const assignments = [];
    const parameters = [];
    const set = (column, value) => { assignments.push(`${column} = ?`); parameters.push(value); };

    if (body.title !== undefined) set("title", requireText(body.title, "title", 180));
    if (body.subtitle !== undefined) set("subtitle", optionalText(body.subtitle, 255));
    if (body.deadlineAt !== undefined) set("deadline_at", parseDeadline(body.deadlineAt));
    if (body.deliveryExpectedOn !== undefined) set("delivery_expected_on", parseDeliveryDate(body.deliveryExpectedOn));
    if (body.deliveryNote !== undefined) set("delivery_note", optionalText(body.deliveryNote, 255));
    if (body.pickupInstructions !== undefined) set("pickup_instructions", requireText(body.pickupInstructions, "pickupInstructions", 255));
    if (body.representative !== undefined) {
      const representative = body.representative ?? {};
      set("representative_name", requireText(representative.name, "representative.name", 160));
      set("representative_whatsapp", normalizeWhatsapp(representative.whatsapp, "representative.whatsapp"));
    }
    if (body.artFrontUrl !== undefined) set("art_front_url", requireText(body.artFrontUrl, "artFrontUrl", 2048));
    if (body.artBackUrl !== undefined) set("art_back_url", optionalText(body.artBackUrl, 2048));
    if (body.artRenderMode !== undefined) set("art_render_mode", parseArtRenderMode(body.artRenderMode));
    if (body.presentationConfig !== undefined) {
      set("mockup_enabled", presentation.mockupEnabled);
      set("real_photos_enabled", presentation.realPhotosEnabled);
    }
    if (body.receiverId !== undefined) {
      const receiver = await resolveCampaignReceiver(connection, body.receiverId, campaign.receiver_id);
      const nextReceiverId = receiver?.id ?? null;
      if (Number(nextReceiverId ?? 0) !== Number(campaign.receiver_id ?? 0)) {
        await assertCampaignReceiverChangeAllowed(connection, campaign.id, receiver?.infinitepay_handle ?? defaultInfinitePayHandle());
        set("receiver_id", nextReceiverId);
      }
    }
    if (assignments.length > 0) {
      await queries.updateCampaignQuery2(connection, [...parameters, campaign.id], assignments.join(", "));
    }

    if (body.models !== undefined) {
      if (campaign.phase !== "receiving_orders") {
        throw new ApiError(409, "CAMPAIGN_NOT_RECEIVING", "Preço, cores e tamanhos só podem mudar enquanto a campanha está recebendo pedidos.");
      }
      await applyCampaignModels(connection, campaign.id, parseCampaignModels(body.models));
      if (body.coupon === undefined) {
        const [couponRows] = await queries.updateCampaignQuery3(connection, [campaign.id]);
        if (couponRows.length > 0) {
          await ensureCouponFitsCampaignPrices(connection, campaign.id, await couponDiscounts(connection, couponRows[0].id));
        }
      }
    }

    if (body.coupon !== undefined) await applyCampaignCoupon(connection, campaign.id, body.coupon);

    if (body.artworkConfig !== undefined) {
      orphanCandidates.push(...await applyArtworkConfig(connection, campaign.id, body.artworkConfig));
    }
    if (body.realPhotos !== undefined) {
      orphanCandidates.push(...await applyRealPhotos(connection, campaign.id, body.realPhotos));
    }
    if (body.realVideos !== undefined) {
      orphanCandidates.push(...await applyRealVideos(connection, campaign.id, body.realVideos));
    }
    if (presentation.mockupEnabled) await validateMockupCoverage(connection, campaign.id);
    if (presentation.realPhotosEnabled) await validateRealPhotoCoverage(connection, campaign.id);

    return { artFrontUrl: campaign.art_front_url, artBackUrl: campaign.art_back_url, orphanCandidates };
  });

  // Fora da transação: apagar arquivo é irreversível e não pode acontecer antes do commit.
  if (body.artFrontUrl !== undefined) await removeOrphanUpload(changed.artFrontUrl);
  if (body.artBackUrl !== undefined) await removeOrphanUpload(changed.artBackUrl);
  if (body.artworkConfig !== undefined || body.realPhotos !== undefined || body.realVideos !== undefined) {
    for (const url of changed.orphanCandidates) await removeOrphanUpload(url);
  }
  return getCampaign(code, { includeCoupon: true, includeReceiver: true });
}

/**
 * Exclui somente campanhas que nunca receberam pedidos. Variantes, tamanhos e
 * histórico de fase são dependências de configuração e saem pelo ON DELETE CASCADE;
 * pedidos, inclusive cancelados, preservam a campanha e bloqueiam esta operação.
 */
export async function deleteCampaign(code) {
  const deleted = await withTransaction(async (connection) => {
    const [rows] = await queries.deleteCampaignQuery1(connection, [code]);
    if (rows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    const campaign = rows[0];
    const [orders] = await queries.deleteCampaignQuery2(connection, [campaign.id]);
    if (orders.length > 0) {
      throw new ApiError(
        409,
        "CAMPAIGN_HAS_ORDERS",
        "Esta campanha não pode ser excluída porque possui pedidos. O histórico precisa ser preservado.",
        { orderNumber: orders[0].order_number },
      );
    }
    const [artworkRows] = await queries.deleteCampaignQuery3(connection, [campaign.id]);
    const [photoRows] = await queries.deleteCampaignQuery4(connection, [campaign.id]);
    const [videoRows] = await queries.deleteCampaignQuery5(connection, [campaign.id]);
    await queries.deleteCampaignQuery6(connection, [campaign.id]);
    return {
      code,
      artFrontUrl: campaign.art_front_url,
      artBackUrl: campaign.art_back_url,
      variantArtworkUrls: artworkRows.flatMap((row) => [row.front_url, row.back_url]).filter(Boolean),
      realPhotoUrls: photoRows.map((row) => row.photo_url),
      realVideoUrls: videoRows.flatMap((row) => [row.video_url, row.poster_url]).filter(Boolean),
    };
  });

  // A exclusão do arquivo só ocorre depois do commit e respeita o compartilhamento entre campanhas.
  await removeOrphanUpload(deleted.artFrontUrl);
  await removeOrphanUpload(deleted.artBackUrl);
  for (const url of deleted.variantArtworkUrls) await removeOrphanUpload(url);
  for (const url of deleted.realPhotoUrls) await removeOrphanUpload(url);
  for (const url of deleted.realVideoUrls) await removeOrphanUpload(url);
  return { code: deleted.code, deleted: true };
}

/** Atualiza o que segue à venda, mantendo no banco o histórico necessário aos pedidos antigos. */
export async function applyCampaignModels(connection, campaignId, models) {
  const { modelIds, colorIds, sizeIds } = await resolveCatalogIds(connection, models);
  const wantedModelIds = new Set(modelIds.values());
  const wantedVariants = new Set();
  const wantedSizes = new Set();
  for (const model of models) {
    const modelId = modelIds.get(model.modelCode);
    for (const color of model.colors) wantedVariants.add(`${modelId}:${colorIds.get(color.name)}`);
    for (const size of model.sizes) wantedSizes.add(`${modelId}:${sizeIds.get(size)}`);
  }

  const [currentVariants] = await queries.applyCampaignModelsQuery1(connection, [campaignId]);
  for (const variant of currentVariants) {
    if (wantedVariants.has(`${variant.shirt_model_id}:${variant.color_id}`)) continue;
    // Retirar um corte inteiro encerra somente novas vendas. A variante permanece no
    // banco, inativa, para que pedidos anteriores continuem em relatórios e produção.
    if (!wantedModelIds.has(variant.shirt_model_id)) {
      await queries.applyCampaignModelsQuery2(connection, [variant.id]);
      continue;
    }
    const [used] = await queries.applyCampaignModelsQuery3(connection, [variant.id]);
    if (used.length > 0) {
      throw new ApiError(
        409,
        "VARIANT_IN_USE",
        `A cor ${variant.color_name} do corte ${variant.model_name} não pode sair: o pedido ${used[0].order_number} já a escolheu.`,
        { orderNumber: used[0].order_number, model: variant.model_name, color: variant.color_name },
      );
    }
    // Desativada, e não apagada: os pedidos antigos continuam apontando para ela.
    await queries.applyCampaignModelsQuery4(connection, [variant.id]);
  }

  const [currentSizes] = await queries.applyCampaignModelsQuery5(connection, [campaignId]);
  for (const size of currentSizes) {
    if (wantedSizes.has(`${size.shirt_model_id}:${size.size_id}`)) continue;
    // Os tamanhos do corte retirado ficam como histórico. Sem variante ativa, eles não
    // aparecem no checkout nem podem ser usados para criar um novo pedido.
    if (!wantedModelIds.has(size.shirt_model_id)) continue;
    const [used] = await queries.applyCampaignModelsQuery6(connection, [campaignId, size.shirt_model_id, size.size_id]);
    if (used.length > 0) {
      throw new ApiError(
        409,
        "SIZE_IN_USE",
        `O tamanho ${size.size_code} do corte ${size.model_name} não pode sair: o pedido ${used[0].order_number} já o escolheu.`,
        { orderNumber: used[0].order_number, model: size.model_name, size: size.size_code },
      );
    }
    await queries.applyCampaignModelsQuery7(connection, [size.id]);
  }

  for (const model of models) {
    const modelId = modelIds.get(model.modelCode);
    for (const color of model.colors) {
      // Reativa a variante quando a cor volta, em vez de esbarrar na chave única.
      await queries.applyCampaignModelsQuery8(connection, [campaignId, modelId, colorIds.get(color.name), model.unitPriceCents]);
    }
    for (const size of model.sizes) {
      await queries.applyCampaignModelsQuery9(connection, [campaignId, modelId, sizeIds.get(size)]);
    }
  }
}

/**
 * Apaga a arte substituída. A conferência de uso evita levar junto a imagem de outra
 * campanha — duas campanhas podem apontar para o mesmo arquivo se a arte for reenviada.
 */
export async function removeOrphanUpload(url) {
  if (!url || !/^\/uploads\/[0-9a-f-]{36}\.(png|jpg|webp|mp4)$/.test(url)) return;
  const [rows] = await queries.removeOrphanUploadQuery1(pool, [url, url, url, url, url, url, url]);
  if (rows.length > 0) return;
  try {
    await fs.unlink(path.join(uploadsDirectory, url.slice("/uploads/".length)));
  } catch {
    // O arquivo já não estava lá; nada a fazer.
  }
}

export async function changeCampaignPhase({ staff, body }, code) {
  const targetPhase = requireText(body.targetPhase, "targetPhase", 32);
  const reason = optionalText(body.reason, 500);
  if (!campaignPhases.includes(targetPhase)) throw new ApiError(422, "INVALID_PHASE", "Fase de campanha inválida.");

  return withTransaction(async (connection) => {
    const [rows] = await queries.changeCampaignPhaseQuery1(connection, [code]);
    if (rows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    const campaign = rows[0];
    const currentIndex = campaignPhases.indexOf(campaign.phase);
    const targetIndex = campaignPhases.indexOf(targetPhase);
    if (Math.abs(targetIndex - currentIndex) !== 1) {
      throw new ApiError(409, "NON_ADJACENT_PHASE", "A campanha só pode avançar ou retornar uma etapa por vez.");
    }
    const direction = targetIndex > currentIndex ? "forward" : "backward";
    if (direction === "backward" && !reason) throw new ApiError(422, "RETURN_REASON_REQUIRED", "Informe o motivo para retornar a campanha.");

    await queries.changeCampaignPhaseQuery2(connection, [targetPhase, campaign.id]);
    await queries.changeCampaignPhaseQuery3(connection, [campaign.id, campaign.phase, targetPhase, direction, reason, staff.id, staff.name]);
    return { code, previousPhase: campaign.phase, phase: targetPhase, direction };
  });
}
