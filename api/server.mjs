import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { config } from "./config.mjs";
import { pool, withTransaction } from "./database.mjs";

const campaignPhases = ["receiving_orders", "orders_closed", "production", "ready_for_delivery", "completed"];
const allowedSizes = new Set(["PP", "P", "M", "G", "GG", "XG"]);

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (origin && origin === config.corsOrigin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, X-Admin-Token");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256 * 1024) throw new ApiError(413, "BODY_TOO_LARGE", "O corpo da requisição excede 256 KB.");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "O corpo da requisição não contém JSON válido.");
  }
}

function requireText(value, field, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength) {
    throw new ApiError(422, "VALIDATION_ERROR", `O campo ${field} é obrigatório e deve ter até ${maxLength} caracteres.`);
  }
  return text;
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (text.length > maxLength) throw new ApiError(422, "VALIDATION_ERROR", `Um campo opcional excede ${maxLength} caracteres.`);
  return text || null;
}

function normalizeWhatsapp(value, field = "customer.whatsapp") {
  const digits = requireText(value, field, 30).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) throw new ApiError(422, "VALIDATION_ERROR", "Informe um WhatsApp válido com DDD.");
  return digits;
}

function requireAdmin(request) {
  if (!config.adminApiToken) throw new ApiError(503, "ADMIN_NOT_CONFIGURED", "Defina ADMIN_API_TOKEN antes de usar rotas administrativas.");
  const received = String(request.headers["x-admin-token"] ?? "");
  const expectedHash = createHash("sha256").update(config.adminApiToken).digest();
  const receivedHash = createHash("sha256").update(received).digest();
  if (!timingSafeEqual(expectedHash, receivedHash)) throw new ApiError(401, "UNAUTHORIZED", "Credencial administrativa inválida.");
}

function publicOrderNumber() {
  const year = new Date().getUTCFullYear();
  return `CM-${year}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function normalizeCampaignCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^MENDES-[A-Z0-9-]{2,32}$/.test(code)) {
    throw new ApiError(422, "INVALID_CAMPAIGN_CODE", "Use um código no formato MENDES-TURMA-26.");
  }
  return code;
}

function suggestedCampaignCode(title) {
  const stopWords = new Set(["A", "AS", "DA", "DAS", "DE", "DO", "DOS", "E", "O", "OS"]);
  const words = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !stopWords.has(word));
  const initials = words.slice(0, 4).map((word) => word[0]).join("") || "TURMA";
  return `MENDES-${initials}-${String(new Date().getUTCFullYear()).slice(-2)}`;
}

function parsePositiveInteger(value, field, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ApiError(422, "VALIDATION_ERROR", `O campo ${field} precisa ser um número inteiro válido.`);
  }
  return parsed;
}

function parseDeadline(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ApiError(422, "VALIDATION_ERROR", "Informe um prazo válido para a campanha.");
  return parsed;
}

async function getCampaign(code) {
  const [campaignRows] = await pool.execute(
    `SELECT id, code, title, subtitle, phase, deadline_at, pickup_instructions,
            representative_name, cover_image_url
       FROM campaigns WHERE code = ? LIMIT 1`,
    [code],
  );
  if (campaignRows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const campaign = campaignRows[0];
  const [variants] = await pool.execute(
    `SELECT cv.id, sm.code AS model_code, sm.name AS model_name, co.name AS color_name,
            co.hex_color, cv.unit_price_cents, cv.front_image_url, cv.back_image_url
       FROM campaign_variants cv
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
      WHERE cv.campaign_id = ? AND cv.active = TRUE AND sm.active = TRUE AND co.active = TRUE
      ORDER BY sm.sort_order, co.name`,
    [campaign.id],
  );
  return {
    id: campaign.id,
    code: campaign.code,
    title: campaign.title,
    subtitle: campaign.subtitle,
    phase: campaign.phase,
    deadlineAt: campaign.deadline_at,
    pickupInstructions: campaign.pickup_instructions,
    representativeName: campaign.representative_name,
    coverImageUrl: campaign.cover_image_url,
    variants: variants.map((variant) => ({
      id: variant.id,
      model: { code: variant.model_code, name: variant.model_name },
      color: { name: variant.color_name, hex: variant.hex_color },
      unitPriceCents: variant.unit_price_cents,
      frontImageUrl: variant.front_image_url,
      backImageUrl: variant.back_image_url,
    })),
  };
}

async function listCampaigns() {
  const [rows] = await pool.execute(
    `SELECT c.id, c.code, c.title, c.subtitle, c.phase, c.deadline_at, c.pickup_instructions,
            c.representative_name, c.representative_whatsapp, c.cover_image_url,
            COUNT(DISTINCT o.id) AS order_count,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_cents ELSE 0 END), 0) AS paid_total_cents
       FROM campaigns c
       LEFT JOIN orders o ON o.campaign_id = c.id AND o.status = 'active'
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    subtitle: row.subtitle,
    phase: row.phase,
    deadlineAt: row.deadline_at,
    pickupInstructions: row.pickup_instructions,
    representative: { name: row.representative_name, whatsapp: row.representative_whatsapp },
    coverImageUrl: row.cover_image_url,
    orderCount: Number(row.order_count),
    paidTotalCents: Number(row.paid_total_cents),
  }));
}

async function createCampaign(request) {
  requireAdmin(request);
  const body = await readJson(request);
  const title = requireText(body.title, "title", 180);
  const code = body.code ? normalizeCampaignCode(body.code) : suggestedCampaignCode(title);
  const subtitle = optionalText(body.subtitle, 255);
  const deadlineAt = parseDeadline(body.deadlineAt);
  const pickupInstructions = requireText(body.pickupInstructions, "pickupInstructions", 255);
  const representative = body.representative ?? {};
  const representativeName = requireText(representative.name, "representative.name", 160);
  const representativeWhatsapp = normalizeWhatsapp(representative.whatsapp, "representative.whatsapp");
  const coverImageUrl = optionalText(body.coverImageUrl, 2048);
  if (!Array.isArray(body.models) || body.models.length !== 3) {
    throw new ApiError(422, "VALIDATION_ERROR", "A campanha precisa configurar os três modelos disponíveis.");
  }

  const models = body.models.map((model) => {
    if (!model || typeof model !== "object") throw new ApiError(422, "VALIDATION_ERROR", "Modelo de campanha inválido.");
    const modelCode = requireText(model.modelCode, "models.modelCode", 32);
    const unitPriceCents = parsePositiveInteger(model.unitPriceCents, "models.unitPriceCents", 10_000_000);
    const frontImageUrl = optionalText(model.frontImageUrl, 2048);
    const backImageUrl = optionalText(model.backImageUrl, 2048);
    if (!Array.isArray(model.colors) || model.colors.length < 1 || model.colors.length > 12) {
      throw new ApiError(422, "VALIDATION_ERROR", `Selecione ao menos uma cor para ${modelCode}.`);
    }
    const colors = model.colors.map((color) => requireText(color, "models.colors", 80));
    if (new Set(colors).size !== colors.length) throw new ApiError(422, "VALIDATION_ERROR", `Há cores repetidas em ${modelCode}.`);
    return { modelCode, unitPriceCents, frontImageUrl, backImageUrl, colors };
  });
  if (new Set(models.map((model) => model.modelCode)).size !== models.length) {
    throw new ApiError(422, "VALIDATION_ERROR", "Há modelos repetidos na campanha.");
  }

  await withTransaction(async (connection) => {
    const [existing] = await connection.execute("SELECT id FROM campaigns WHERE code = ? LIMIT 1", [code]);
    if (existing.length > 0) throw new ApiError(409, "CAMPAIGN_CODE_EXISTS", "Já existe uma campanha com esse código.");

    const modelCodes = models.map((model) => model.modelCode);
    const modelPlaceholders = modelCodes.map(() => "?").join(", ");
    const [modelRows] = await connection.execute(
      `SELECT id, code FROM shirt_models WHERE active = TRUE AND code IN (${modelPlaceholders})`,
      modelCodes,
    );
    if (modelRows.length !== modelCodes.length) throw new ApiError(422, "INVALID_MODEL", "Um dos modelos selecionados não está cadastrado.");
    const modelIds = new Map(modelRows.map((row) => [row.code, row.id]));

    const colorNames = [...new Set(models.flatMap((model) => model.colors))];
    const colorPlaceholders = colorNames.map(() => "?").join(", ");
    const [colorRows] = await connection.execute(
      `SELECT id, name FROM colors WHERE active = TRUE AND name IN (${colorPlaceholders})`,
      colorNames,
    );
    if (colorRows.length !== colorNames.length) throw new ApiError(422, "INVALID_COLOR", "Uma das cores selecionadas não está cadastrada.");
    const colorIds = new Map(colorRows.map((row) => [row.name, row.id]));

    const [campaignResult] = await connection.execute(
      `INSERT INTO campaigns
        (code, title, subtitle, deadline_at, pickup_instructions, representative_name,
         representative_whatsapp, cover_image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, title, subtitle, deadlineAt, pickupInstructions, representativeName, representativeWhatsapp, coverImageUrl],
    );
    for (const model of models) {
      for (const color of model.colors) {
        await connection.execute(
          `INSERT INTO campaign_variants
            (campaign_id, shirt_model_id, color_id, unit_price_cents, front_image_url, back_image_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [campaignResult.insertId, modelIds.get(model.modelCode), colorIds.get(color), model.unitPriceCents, model.frontImageUrl, model.backImageUrl],
        );
      }
    }
  });
  return getCampaign(code);
}

async function createOrder(request) {
  const idempotencyKey = requireText(request.headers["idempotency-key"], "Idempotency-Key", 128);
  const body = await readJson(request);
  const campaignCode = requireText(body.campaignCode, "campaignCode", 40).toUpperCase();
  const customer = body.customer ?? {};
  const customerName = requireText(customer.name, "customer.name", 160);
  const customerWhatsapp = normalizeWhatsapp(customer.whatsapp);
  const customerEmail = optionalText(customer.email, 254);
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
    if (!Number.isSafeInteger(variantId) || variantId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 || !allowedSizes.has(size)) {
      throw new ApiError(422, "VALIDATION_ERROR", "Cada item precisa de variante, tamanho válido e quantidade entre 1 e 20.");
    }
    return { variantId, quantity, size };
  });
  if (new Set(requestedItems.map((item) => `${item.variantId}:${item.size}`)).size !== requestedItems.length) {
    throw new ApiError(422, "VALIDATION_ERROR", "Itens repetidos devem ser enviados como uma única linha com a quantidade total.");
  }

  return withTransaction(async (connection) => {
    const [existingRows] = await connection.execute(
      "SELECT order_number, total_cents, payment_status FROM orders WHERE idempotency_key = ? LIMIT 1",
      [idempotencyKey],
    );
    if (existingRows.length > 0) return { created: false, order: existingRows[0] };

    const [campaignRows] = await connection.execute(
      "SELECT id, phase, deadline_at FROM campaigns WHERE code = ? LIMIT 1 FOR UPDATE",
      [campaignCode],
    );
    if (campaignRows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    const campaign = campaignRows[0];
    if (campaign.phase !== "receiving_orders") throw new ApiError(409, "CAMPAIGN_NOT_RECEIVING", "Esta campanha não está recebendo pedidos.");
    if (new Date(campaign.deadline_at).getTime() < Date.now()) throw new ApiError(409, "CAMPAIGN_DEADLINE_REACHED", "O prazo desta campanha foi encerrado.");

    const variantIds = [...new Set(requestedItems.map((item) => item.variantId))];
    const placeholders = variantIds.map(() => "?").join(", ");
    const [variantRows] = await connection.execute(
      `SELECT id, unit_price_cents FROM campaign_variants
        WHERE campaign_id = ? AND active = TRUE AND id IN (${placeholders}) FOR UPDATE`,
      [campaign.id, ...variantIds],
    );
    if (variantRows.length !== variantIds.length) throw new ApiError(422, "INVALID_VARIANT", "Uma ou mais opções não pertencem a esta campanha.");
    const prices = new Map(variantRows.map((row) => [Number(row.id), Number(row.unit_price_cents)]));
    const totalCents = requestedItems.reduce((total, item) => total + prices.get(item.variantId) * item.quantity, 0);
    const orderNumber = publicOrderNumber();

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
        (order_number, idempotency_key, campaign_id, customer_name, customer_whatsapp, customer_email, total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, idempotencyKey, campaign.id, customerName, customerWhatsapp, customerEmail, totalCents],
    );
    for (const item of requestedItems) {
      await connection.execute(
        `INSERT INTO order_items (order_id, campaign_variant_id, size, quantity, unit_price_cents)
         VALUES (?, ?, ?, ?, ?)`,
        [orderResult.insertId, item.variantId, item.size, item.quantity, prices.get(item.variantId)],
      );
    }
    return { created: true, order: { order_number: orderNumber, total_cents: totalCents, payment_status: "pending" } };
  });
}

function effectiveOrderStatus(order) {
  if (order.payment_status === "failed") return "failed";
  if (order.payment_status !== "paid") return "pending";
  if (order.delivery_status === "delivered") return "delivered";
  if (["ready_for_delivery", "completed"].includes(order.campaign_phase)) return "ready";
  return "confirmed";
}

async function trackOrder(requestUrl, orderNumber) {
  const whatsapp = normalizeWhatsapp(requestUrl.searchParams.get("whatsapp"));
  const [rows] = await pool.execute(
    `SELECT o.id, o.order_number, o.customer_name, o.payment_status, o.delivery_status,
            o.total_cents, o.created_at, o.paid_at, o.delivered_at,
            c.code AS campaign_code, c.title AS campaign_title, c.phase AS campaign_phase,
            c.representative_name, c.pickup_instructions
       FROM orders o
       JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.order_number = ? AND o.customer_whatsapp = ? AND o.status = 'active'
      LIMIT 1`,
    [orderNumber, whatsapp],
  );
  if (rows.length === 0) throw new ApiError(404, "ORDER_NOT_FOUND", "Pedido não encontrado com os dados informados.");
  const order = rows[0];
  const [items] = await pool.execute(
    `SELECT sm.name AS model_name, co.name AS color_name, co.hex_color, oi.size,
            oi.quantity, oi.unit_price_cents, oi.line_total_cents
       FROM order_items oi
       JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
      WHERE oi.order_id = ? ORDER BY oi.id`,
    [order.id],
  );
  return {
    number: order.order_number,
    status: effectiveOrderStatus(order),
    paymentStatus: order.payment_status,
    deliveryStatus: order.delivery_status,
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
    },
    items: items.map((item) => ({
      modelName: item.model_name,
      color: { name: item.color_name, hex: item.hex_color },
      size: item.size,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
    })),
  };
}

async function listCampaignOrders(code) {
  const [rows] = await pool.execute(
    `SELECT o.order_number, o.customer_name, o.customer_whatsapp, o.customer_email,
            o.payment_status, o.delivery_status, o.total_cents, o.created_at,
            sm.name AS model_name, co.name AS color_name, co.hex_color,
            oi.size, oi.quantity, oi.unit_price_cents
       FROM campaigns c
       JOIN orders o ON o.campaign_id = c.id AND o.status = 'active'
       JOIN order_items oi ON oi.order_id = o.id
       JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
      WHERE c.code = ?
      ORDER BY o.created_at DESC, oi.id`,
    [code],
  );
  return rows.map((row) => ({
    number: row.order_number,
    customer: { name: row.customer_name, whatsapp: row.customer_whatsapp, email: row.customer_email },
    paymentStatus: row.payment_status,
    deliveryStatus: row.delivery_status,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    item: {
      modelName: row.model_name,
      color: { name: row.color_name, hex: row.hex_color },
      size: row.size,
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
    },
  }));
}

async function changeDeliveryStatus(request, orderNumber) {
  requireAdmin(request);
  const body = await readJson(request);
  const nextStatus = requireText(body.status, "status", 32);
  const note = optionalText(body.note, 500);
  if (!["ready", "delivered", "issue"].includes(nextStatus)) {
    throw new ApiError(422, "INVALID_DELIVERY_STATUS", "Situação de entrega inválida.");
  }

  return withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT o.id, o.delivery_status, o.payment_status, c.phase AS campaign_phase
         FROM orders o JOIN campaigns c ON c.id = o.campaign_id
        WHERE o.order_number = ? AND o.status = 'active' LIMIT 1 FOR UPDATE`,
      [orderNumber],
    );
    if (rows.length === 0) throw new ApiError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    const order = rows[0];
    if (order.payment_status !== "paid") throw new ApiError(409, "ORDER_NOT_PAID", "Somente pedidos pagos podem entrar no fluxo de entrega.");
    if (nextStatus === "delivered" && !["ready_for_delivery", "completed"].includes(order.campaign_phase)) {
      throw new ApiError(409, "CAMPAIGN_NOT_READY", "A campanha ainda não está pronta para entrega.");
    }
    if (nextStatus === order.delivery_status) {
      return { number: orderNumber, deliveryStatus: nextStatus, unchanged: true };
    }
    await connection.execute(
      "UPDATE orders SET delivery_status = ?, delivered_at = CASE WHEN ? = 'delivered' THEN CURRENT_TIMESTAMP(3) ELSE delivered_at END WHERE id = ?",
      [nextStatus, nextStatus, order.id],
    );
    await connection.execute(
      `INSERT INTO delivery_history (order_id, previous_status, next_status, note)
       VALUES (?, ?, ?, ?)`,
      [order.id, order.delivery_status, nextStatus, note],
    );
    return { number: orderNumber, previousStatus: order.delivery_status, deliveryStatus: nextStatus, unchanged: false };
  });
}

async function changeCampaignPhase(request, code) {
  requireAdmin(request);
  const body = await readJson(request);
  const targetPhase = requireText(body.targetPhase, "targetPhase", 32);
  const reason = optionalText(body.reason, 500);
  if (!campaignPhases.includes(targetPhase)) throw new ApiError(422, "INVALID_PHASE", "Fase de campanha inválida.");

  return withTransaction(async (connection) => {
    const [rows] = await connection.execute("SELECT id, phase FROM campaigns WHERE code = ? LIMIT 1 FOR UPDATE", [code]);
    if (rows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    const campaign = rows[0];
    const currentIndex = campaignPhases.indexOf(campaign.phase);
    const targetIndex = campaignPhases.indexOf(targetPhase);
    if (Math.abs(targetIndex - currentIndex) !== 1) {
      throw new ApiError(409, "NON_ADJACENT_PHASE", "A campanha só pode avançar ou retornar uma etapa por vez.");
    }
    const direction = targetIndex > currentIndex ? "forward" : "backward";
    if (direction === "backward" && !reason) throw new ApiError(422, "RETURN_REASON_REQUIRED", "Informe o motivo para retornar a campanha.");

    await connection.execute("UPDATE campaigns SET phase = ? WHERE id = ?", [targetPhase, campaign.id]);
    await connection.execute(
      `INSERT INTO campaign_phase_history
        (campaign_id, previous_phase, next_phase, direction, reason, changed_by_label)
       VALUES (?, ?, ?, ?, ?, 'Chave administrativa MVP')`,
      [campaign.id, campaign.phase, targetPhase, direction, reason],
    );
    return { code, previousPhase: campaign.phase, phase: targetPhase, direction };
  });
}

async function productionReport(requestUrl) {
  const campaign = requestUrl.searchParams.get("campaign");
  const parameters = [];
  let condition = "";
  if (campaign) {
    condition = " WHERE campaign_code = ?";
    parameters.push(campaign.toUpperCase());
  }
  const [rows] = await pool.execute(
    `SELECT campaign_code, campaign_title, model_name, color_name, hex_color, size, quantity
       FROM v_production_report${condition}
      ORDER BY campaign_title, model_name, color_name, FIELD(size, 'PP', 'P', 'M', 'G', 'GG', 'XG')`,
    parameters,
  );
  return rows;
}

async function deliveryReport(requestUrl) {
  const campaign = requestUrl.searchParams.get("campaign");
  const parameters = [];
  let condition = "";
  if (campaign) {
    condition = " WHERE campaign_code = ?";
    parameters.push(campaign.toUpperCase());
  }
  const [rows] = await pool.execute(
    `SELECT campaign_code, campaign_title, representative_name, order_number, customer_name,
            customer_whatsapp, model_name, color_name, size, quantity, effective_delivery_status
       FROM v_delivery_report${condition}
      ORDER BY campaign_title, customer_name, order_number`,
    parameters,
  );
  return rows;
}

async function route(request, response) {
  applyCors(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const path = decodeURIComponent(requestUrl.pathname).replace(/\/+$/, "") || "/";

  if (request.method === "GET" && path === "/api/health") {
    await pool.query("SELECT 1");
    sendJson(response, 200, { ok: true, database: "connected" });
    return;
  }
  const publicCampaignMatch = path.match(/^\/api\/campaigns\/([^/]+)$/);
  if (request.method === "GET" && publicCampaignMatch) {
    sendJson(response, 200, { campaign: await getCampaign(publicCampaignMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "POST" && path === "/api/orders") {
    const result = await createOrder(request);
    sendJson(response, result.created ? 201 : 200, {
      order: {
        number: result.order.order_number,
        totalCents: result.order.total_cents,
        paymentStatus: result.order.payment_status,
      },
      idempotentReplay: !result.created,
    });
    return;
  }
  const trackingMatch = path.match(/^\/api\/orders\/([^/]+)$/);
  if (request.method === "GET" && trackingMatch) {
    sendJson(response, 200, { order: await trackOrder(requestUrl, trackingMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/campaigns") {
    requireAdmin(request);
    sendJson(response, 200, { campaigns: await listCampaigns() });
    return;
  }
  if (request.method === "POST" && path === "/api/admin/campaigns") {
    sendJson(response, 201, { campaign: await createCampaign(request) });
    return;
  }
  const phaseMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/phase$/);
  if (request.method === "PATCH" && phaseMatch) {
    sendJson(response, 200, { campaign: await changeCampaignPhase(request, phaseMatch[1].toUpperCase()) });
    return;
  }
  const campaignOrdersMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/orders$/);
  if (request.method === "GET" && campaignOrdersMatch) {
    requireAdmin(request);
    sendJson(response, 200, { orders: await listCampaignOrders(campaignOrdersMatch[1].toUpperCase()) });
    return;
  }
  const deliveryMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/delivery$/);
  if (request.method === "PATCH" && deliveryMatch) {
    sendJson(response, 200, { order: await changeDeliveryStatus(request, deliveryMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/reports/production") {
    requireAdmin(request);
    sendJson(response, 200, { rows: await productionReport(requestUrl) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/reports/delivery") {
    requireAdmin(request);
    sendJson(response, 200, { rows: await deliveryReport(requestUrl) });
    return;
  }
  throw new ApiError(404, "ROUTE_NOT_FOUND", "Rota não encontrada.");
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    const status = error instanceof ApiError ? error.status : 500;
    const code = error instanceof ApiError ? error.code : "INTERNAL_ERROR";
    if (!(error instanceof ApiError)) console.error(error);
    sendJson(response, status, {
      error: { code, message: error instanceof ApiError ? error.message : "Erro interno do servidor.", details: error.details },
    });
  });
});

server.listen(config.port, config.host, () => {
  console.log(`API da Camisaria Mendes em http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal}: encerrando API...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
