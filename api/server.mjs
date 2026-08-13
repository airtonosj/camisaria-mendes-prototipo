import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyNewPassword,
  createPasswordResetToken,
  createSession,
  deleteSession,
  findActiveUserByEmail,
  minimumPasswordLength,
  normalizeEmail,
  resolvePasswordResetToken,
  resolveSession,
  verifyPassword,
} from "./auth.mjs";
import { config, productionConfigurationErrors } from "./config.mjs";
import { pool, withTransaction } from "./database.mjs";
import { mailerConfigured, sendMail } from "./mailer.mjs";
import { startOrderEmailNotificationWorker } from "./order-email-notifications.mjs";
import {
  createCheckoutForOrder,
  enqueueInfinitePayEvent,
  PaymentIntegrationError,
  startInfinitePayReconciliationWorker,
} from "./infinitepay-payments.mjs";

const campaignPhases = ["receiving_orders", "orders_closed", "production", "ready_for_delivery", "completed"];
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendDirectory = path.join(projectDirectory, "dist");
const uploadsDirectory = config.uploadsDirectory;
const migrationsDirectory = path.join(projectDirectory, "database", "migrations");
const uploadExtensions = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const uploadContentTypes = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["webp", "image/webp"],
]);
const frontendContentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);
const maxUploadBytes = 2 * 1024 * 1024;

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

/**
 * O processo estar conectado ao MySQL não significa que o schema está pronto. A lista
 * esperada vem dos próprios arquivos versionados de migração, evitando atualizar uma
 * constante manual sempre que uma migração nova for adicionada.
 */
async function databaseReadiness() {
  await pool.query("SELECT 1");
  const expected = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .map((file) => file.replace(/\.sql$/, ""))
    .sort((left, right) => left.localeCompare(right));
  if (expected.length === 0) {
    throw new ApiError(503, "DATABASE_SCHEMA_UNDEFINED", "Nenhuma migração de banco foi encontrada no servidor.");
  }

  let appliedRows;
  try {
    [appliedRows] = await pool.query("SELECT version FROM schema_migrations");
  } catch {
    throw new ApiError(503, "DATABASE_MIGRATION_REQUIRED", "O banco ainda não foi preparado com as migrações da aplicação.");
  }
  const applied = new Set(appliedRows.map((row) => row.version));
  const missing = expected.filter((version) => !applied.has(version));
  if (missing.length > 0) {
    throw new ApiError(
      503,
      "DATABASE_MIGRATION_REQUIRED",
      "O banco possui migrações pendentes.",
      { missing },
    );
  }
  return { database: "connected", schema: { ready: true, current: expected.at(-1) } };
}

async function storageReadiness() {
  try {
    await fs.mkdir(uploadsDirectory, { recursive: true });
    await fs.access(uploadsDirectory, fsConstants.R_OK | fsConstants.W_OK);
    return { storage: { ready: true } };
  } catch {
    throw new ApiError(503, "STORAGE_UNAVAILABLE", "O armazenamento de artes não está disponível para leitura e gravação.");
  }
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (origin && config.corsOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Admin-Token");
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

async function readBinary(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new ApiError(413, "FILE_TOO_LARGE", `O arquivo excede ${Math.round(limit / 1024 / 1024)} MB.`);
    chunks.push(chunk);
  }
  if (size === 0) throw new ApiError(422, "EMPTY_FILE", "Nenhum arquivo foi recebido.");
  return Buffer.concat(chunks);
}

function requireText(value, field, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength) {
    throw new ApiError(422, "VALIDATION_ERROR", `O campo ${field} é obrigatório e deve ter até ${maxLength} caracteres.`);
  }
  return text;
}

function normalizeHexColor(value, field) {
  const hex = requireText(value, field, 7).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) {
    throw new ApiError(422, "VALIDATION_ERROR", `O campo ${field} precisa usar o formato #RRGGBB.`);
  }
  return hex;
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

function hasValidAdminToken(request) {
  if (!config.adminApiTokenEnabled || !config.adminApiToken) return false;
  const received = String(request.headers["x-admin-token"] ?? "");
  if (!received) return false;
  const expectedHash = createHash("sha256").update(config.adminApiToken).digest();
  const receivedHash = createHash("sha256").update(received).digest();
  return timingSafeEqual(expectedHash, receivedHash);
}

function bearerToken(request) {
  const header = String(request.headers.authorization ?? "");
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}

/**
 * Aceita duas credenciais: a sessão do navegador, criada no login, e o
 * ADMIN_API_TOKEN, que fica só no servidor para scripts e manutenção. O navegador
 * nunca recebe o token estático — vazá-lo daria acesso total e sem prazo.
 */
async function requireStaff(request) {
  const session = await resolveSession(bearerToken(request));
  if (session) {
    if (session.user.role !== "camisaria") {
      throw new ApiError(403, "STAFF_ROLE_NOT_ALLOWED", "Esta conta não possui acesso ao painel da camisaria.");
    }
    // A senha provisória do cadastro inicial não abre o painel: enquanto ela valer, a
    // única rota liberada é a da própria conta. A trava é aqui, e não só na tela, para
    // não depender do navegador ter carregado a sessão.
    if (session.user.mustChangePassword) {
      throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "Troque a senha provisória para liberar o painel.");
    }
    return session.user;
  }
  if (hasValidAdminToken(request)) return { id: null, name: "Chave administrativa", email: null, role: "camisaria" };
  throw new ApiError(401, "UNAUTHORIZED", "Faça login para acessar o painel.");
}

/** Mexer na própria conta exige sessão de login: a chave de manutenção não tem dono. */
async function requireSessionUser(request) {
  const session = await resolveSession(bearerToken(request));
  if (!session) throw new ApiError(401, "UNAUTHORIZED", "Entre novamente para alterar a conta.");
  return session.user;
}

const rateLimitEntries = new Map();
const maxRateLimitEntries = 10_000;
const loginWindowMs = 10 * 60 * 1000;
const maxLoginAttempts = 8;
const orderWindowMs = 10 * 60 * 1000;
const maxOrderAttempts = 20;

function clientAddress(request) {
  const socketAddress = String(request.socket.remoteAddress ?? "desconhecido").slice(0, 64);
  if (!config.trustProxy) return socketAddress;

  // O proxy confiável acrescenta o endereço real ao fim de X-Forwarded-For. Usar o
  // último valor impede o cliente de escapar do limite adicionando valores à esquerda.
  const forwarded = String(request.headers["x-forwarded-for"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const proxyAddress = forwarded.at(-1) || String(request.headers["x-real-ip"] ?? "").trim();
  return (proxyAddress || socketAddress).slice(0, 64);
}

function pruneRateLimits(now) {
  if (rateLimitEntries.size < maxRateLimitEntries) return;
  for (const [key, entry] of rateLimitEntries) {
    if (entry.resetAt <= now) rateLimitEntries.delete(key);
  }
  if (rateLimitEntries.size >= maxRateLimitEntries) {
    const oldestKey = rateLimitEntries.keys().next().value;
    if (oldestKey !== undefined) rateLimitEntries.delete(oldestKey);
  }
}

function rateLimitEntry(key, windowMs) {
  const now = Date.now();
  let entry = rateLimitEntries.get(key);
  if (!entry || entry.resetAt <= now) {
    pruneRateLimits(now);
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitEntries.set(key, entry);
  }
  return entry;
}

function registerRateLimitedAttempt(key, windowMs) {
  rateLimitEntry(key, windowMs).count += 1;
}

function assertRateLimitAllowed(key, limit, windowMs, message) {
  if (rateLimitEntry(key, windowMs).count >= limit) {
    throw new ApiError(429, "TOO_MANY_ATTEMPTS", message);
  }
}

async function login(request) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = requireText(body.password, "password", 200);
  const attemptKey = `login:${clientAddress(request)}:${email}`;
  assertRateLimitAllowed(attemptKey, maxLoginAttempts, loginWindowMs, "Muitas tentativas de acesso. Aguarde alguns minutos.");

  const user = email ? await findActiveUserByEmail(email) : null;
  if (!user || !verifyPassword(password, user.password_hash)) {
    registerRateLimitedAttempt(attemptKey, loginWindowMs);
    throw new ApiError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
  }
  if (user.role !== "camisaria") {
    registerRateLimitedAttempt(attemptKey, loginWindowMs);
    throw new ApiError(403, "STAFF_ROLE_NOT_ALLOWED", "Esta conta não possui acesso ao painel da camisaria.");
  }
  rateLimitEntries.delete(attemptKey);
  const session = await createSession(user.id);
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: Boolean(user.must_change_password),
    },
  };
}

function assertStrongEnoughPassword(password) {
  if (password.length < minimumPasswordLength) {
    throw new ApiError(422, "WEAK_PASSWORD", `A senha precisa ter ao menos ${minimumPasswordLength} caracteres.`);
  }
}

/**
 * Conta da equipe. O e-mail e a senha do cadastro inicial são provisórios; esta rota
 * é o caminho para trocá-los sem passar por linha de comando. A senha atual é exigida
 * mesmo já havendo sessão: sessão aberta em máquina alheia não deve virar troca de dono.
 */
async function updateAccount(request) {
  const current = await requireSessionUser(request);
  const body = await readJson(request);
  const currentPassword = requireText(body.currentPassword, "currentPassword", 200);
  const newPassword = body.newPassword ? String(body.newPassword) : "";
  if (newPassword) assertStrongEnoughPassword(newPassword);

  return withTransaction(async (connection) => {
    const [users] = await connection.execute(
      `SELECT id, name, email, password_hash, role, must_change_password
         FROM users WHERE id = ? AND active = TRUE LIMIT 1 FOR UPDATE`,
      [current.id],
    );
    const user = users[0];
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "A senha atual está incorreta.");
    }
    const name = body.name === undefined ? user.name : requireText(body.name, "name", 160);
    const email = body.email === undefined ? user.email : normalizeEmail(body.email);
    if (!email) throw new ApiError(422, "INVALID_EMAIL", "Informe um e-mail válido.");
    if (email !== user.email) {
      const [taken] = await connection.execute("SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1", [email, user.id]);
      if (taken.length > 0) throw new ApiError(409, "EMAIL_IN_USE", "Já existe uma conta com esse e-mail.");
    }
    await connection.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", [name, email, user.id]);
    if (newPassword) {
      // A sessão de quem está trocando continua válida; as demais caem no mesmo commit.
      await applyNewPassword(user.id, newPassword, {
        keepSessionToken: bearerToken(request),
        connection,
      });
    }
    return {
      user: { name, email, role: user.role, mustChangePassword: newPassword ? false : Boolean(user.must_change_password) },
      passwordChanged: Boolean(newPassword),
    };
  });
}

function resetLink(token) {
  return `${config.publicAppUrl}/?rota=redefinir-senha&token=${encodeURIComponent(token)}`;
}

/**
 * Recuperação de senha. A resposta é sempre a mesma para e-mail existente ou não —
 * dizer "esse e-mail não está cadastrado" entregaria quem tem acesso ao painel.
 * Sem SMTP configurado a API diz isso abertamente, em vez de fingir que enviou.
 */
async function requestPasswordReset(request) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const requestAddress = clientAddress(request);
  const attemptKey = `reset:${requestAddress}`;
  assertRateLimitAllowed(attemptKey, maxLoginAttempts, loginWindowMs, "Muitas tentativas de recuperação. Aguarde alguns minutos.");
  registerRateLimitedAttempt(attemptKey, loginWindowMs);

  const configured = mailerConfigured();
  const user = email ? await findActiveUserByEmail(email) : null;
  if (!user) return { delivery: configured ? "email" : "unavailable" };

  const { token, expiresInMinutes } = await createPasswordResetToken(user.id, requestAddress);
  const link = resetLink(token);
  if (!configured) {
    console.warn(`Recuperação de senha solicitada por ${user.email}, mas o SMTP não está configurado.`);
    if (!config.isProduction) console.warn(`Link de redefinição (apenas em desenvolvimento): ${link}`);
    return { delivery: "unavailable" };
  }

  try {
    await sendMail({
      to: user.email,
      subject: "Redefinir a senha do painel da Camisaria Mendes",
      text: [
        `Olá, ${user.name}.`,
        "",
        "Recebemos um pedido para redefinir a senha do painel da Camisaria Mendes.",
        `Abra o link abaixo em até ${expiresInMinutes} minutos para escolher uma nova senha:`,
        "",
        link,
        "",
        "Se não foi você que pediu, ignore esta mensagem: a senha atual continua valendo.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("Falha ao enviar o e-mail de redefinição:", error);
    throw new ApiError(502, "EMAIL_NOT_SENT", "Não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde.");
  }
  return { delivery: "email" };
}

async function confirmPasswordReset(request) {
  const body = await readJson(request);
  const token = requireText(body.token, "token", 200);
  const password = requireText(body.password, "password", 200);
  assertStrongEnoughPassword(password);
  const reset = await resolvePasswordResetToken(token);
  if (!reset) throw new ApiError(410, "RESET_TOKEN_INVALID", "Este link de redefinição expirou ou já foi usado.");
  const applied = await applyNewPassword(reset.user_id, password, { tokenId: reset.id });
  if (!applied) throw new ApiError(410, "RESET_TOKEN_INVALID", "Este link de redefinição expirou ou já foi usado.");
  return { email: reset.email };
}

/** Estado público do checkout. Nenhuma credencial ou identificador da conta é exposto. */
function publicSettings() {
  return {
    payment: {
      provider: config.payments.provider,
      checkoutEnabled: config.payments.infinitePay.checkoutEnabled,
      methods: ["pix", "credit_card"],
    },
  };
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

function parseArtRenderMode(value) {
  if (value === "overlay" || value === "legacy_mockup") return value;
  throw new ApiError(422, "VALIDATION_ERROR", "O modo de exibição da arte é inválido.");
}

async function getCampaign(code) {
  const [campaignRows] = await pool.execute(
    `SELECT id, code, title, subtitle, phase, deadline_at, pickup_instructions,
            representative_name, representative_whatsapp, art_front_url, art_back_url, art_render_mode
       FROM campaigns WHERE code = ? LIMIT 1`,
    [code],
  );
  if (campaignRows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const campaign = campaignRows[0];
  const [variants] = await pool.execute(
    `SELECT cv.id, sm.code AS model_code, sm.name AS model_name, co.name AS color_name,
            co.hex_color, cv.unit_price_cents
       FROM campaign_variants cv
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
      WHERE cv.campaign_id = ? AND cv.active = TRUE AND sm.active = TRUE AND co.active = TRUE
      ORDER BY sm.sort_order, co.name`,
    [campaign.id],
  );
  const [sizes] = await pool.execute(
    `SELECT sm.code AS model_code, sm.name AS model_name, sz.code, sz.name, sz.size_group
       FROM campaign_model_sizes cms
       JOIN shirt_models sm ON sm.id = cms.shirt_model_id
       JOIN sizes sz ON sz.id = cms.size_id
      WHERE cms.campaign_id = ? AND sm.active = TRUE AND sz.active = TRUE
      ORDER BY sm.sort_order, sz.sort_order`,
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
    // Contato do representante para dúvidas e retirada do pedido.
    representativeWhatsapp: campaign.representative_whatsapp,
    artFrontUrl: campaign.art_front_url,
    artBackUrl: campaign.art_back_url,
    artRenderMode: campaign.art_render_mode,
    variants: variants.map((variant) => ({
      id: variant.id,
      model: { code: variant.model_code, name: variant.model_name },
      color: { name: variant.color_name, hex: variant.hex_color },
      unitPriceCents: variant.unit_price_cents,
    })),
    sizes: sizes.map((size) => ({
      model: { code: size.model_code, name: size.model_name },
      code: size.code,
      name: size.name,
      group: size.size_group,
    })),
  };
}

async function listCampaigns() {
  const [rows] = await pool.execute(
    `SELECT c.id, c.code, c.title, c.subtitle, c.phase, c.deadline_at, c.pickup_instructions,
            c.representative_name, c.representative_whatsapp, c.art_front_url, c.art_back_url, c.art_render_mode,
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
    artFrontUrl: row.art_front_url,
    artBackUrl: row.art_back_url,
    artRenderMode: row.art_render_mode,
    orderCount: Number(row.order_count),
    paidTotalCents: Number(row.paid_total_cents),
  }));
}

/** Valida a configuração de cortes que a campanha recebe ao ser criada ou editada. */
function parseCampaignModels(value) {
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
    return { modelCode, unitPriceCents, colors, sizes };
  });
  if (new Set(models.map((model) => model.modelCode)).size !== models.length) {
    throw new ApiError(422, "VALIDATION_ERROR", "Há cortes repetidos na campanha.");
  }
  return models;
}

/** Traduz códigos do catálogo em identificadores, recusando qualquer um desconhecido. */
async function resolveCatalogIds(connection, models) {
  const modelCodes = [...new Set(models.map((model) => model.modelCode))];
  const [modelRows] = await connection.execute(
    `SELECT id, code FROM shirt_models WHERE active = TRUE AND code IN (${modelCodes.map(() => "?").join(", ")})`,
    modelCodes,
  );
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
  const [colorRows] = await connection.execute(
    `SELECT id, name, hex_color, active FROM colors WHERE name IN (${colorNames.map(() => "?").join(", ")})`,
    colorNames,
  );
  const storedColors = new Map(colorRows.map((row) => [row.name.toLocaleLowerCase("pt-BR"), row]));
  const colorIdsByKey = new Map();
  for (const [key, color] of colorDefinitions) {
    const stored = storedColors.get(key);
    if (stored) {
      if (color.hex && stored.hex_color.toUpperCase() !== color.hex) {
        throw new ApiError(409, "COLOR_NAME_CONFLICT", `A cor ${color.name} já existe com o código ${stored.hex_color}. Use outro nome para cadastrar ${color.hex}.`);
      }
      if (!stored.active) await connection.execute("UPDATE colors SET active = TRUE WHERE id = ?", [stored.id]);
      colorIdsByKey.set(key, stored.id);
      continue;
    }
    if (!color.hex) throw new ApiError(422, "INVALID_COLOR", `A cor ${color.name} não está cadastrada e precisa informar o código HEX.`);
    const [created] = await connection.execute(
      "INSERT INTO colors (name, hex_color, active) VALUES (?, ?, TRUE)",
      [color.name, color.hex],
    );
    colorIdsByKey.set(key, created.insertId);
  }
  const colorIds = new Map(models.flatMap((model) => model.colors.map((color) => [color.name, colorIdsByKey.get(color.name.toLocaleLowerCase("pt-BR"))])));

  const sizeCodes = [...new Set(models.flatMap((model) => model.sizes))];
  const [sizeRows] = await connection.execute(
    `SELECT id, code FROM sizes WHERE active = TRUE AND code IN (${sizeCodes.map(() => "?").join(", ")})`,
    sizeCodes,
  );
  if (sizeRows.length !== sizeCodes.length) throw new ApiError(422, "INVALID_SIZE", "Um dos tamanhos selecionados não está cadastrado.");

  return {
    modelIds: new Map(modelRows.map((row) => [row.code, row.id])),
    colorIds,
    sizeIds: new Map(sizeRows.map((row) => [row.code, row.id])),
  };
}

async function createCampaign(request) {
  const staff = await requireStaff(request);
  const body = await readJson(request);
  const title = requireText(body.title, "title", 180);
  const code = body.code ? normalizeCampaignCode(body.code) : suggestedCampaignCode(title);
  const subtitle = optionalText(body.subtitle, 255);
  const deadlineAt = parseDeadline(body.deadlineAt);
  const pickupInstructions = requireText(body.pickupInstructions, "pickupInstructions", 255);
  const representative = body.representative ?? {};
  const representativeName = requireText(representative.name, "representative.name", 160);
  const representativeWhatsapp = normalizeWhatsapp(representative.whatsapp, "representative.whatsapp");
  const artFrontUrl = requireText(body.artFrontUrl, "artFrontUrl", 2048);
  const artBackUrl = optionalText(body.artBackUrl, 2048);
  const artRenderMode = body.artRenderMode === undefined ? "legacy_mockup" : parseArtRenderMode(body.artRenderMode);
  const models = parseCampaignModels(body.models);

  await withTransaction(async (connection) => {
    const [existing] = await connection.execute("SELECT id FROM campaigns WHERE code = ? LIMIT 1", [code]);
    if (existing.length > 0) throw new ApiError(409, "CAMPAIGN_CODE_EXISTS", "Já existe uma campanha com esse código.");
    const { modelIds, colorIds, sizeIds } = await resolveCatalogIds(connection, models);

    const [campaignResult] = await connection.execute(
      `INSERT INTO campaigns
        (code, title, subtitle, deadline_at, pickup_instructions, representative_name,
         representative_whatsapp, art_front_url, art_back_url, art_render_mode, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, title, subtitle, deadlineAt, pickupInstructions, representativeName, representativeWhatsapp, artFrontUrl, artBackUrl, artRenderMode, staff.id],
    );
    for (const model of models) {
      for (const color of model.colors) {
        await connection.execute(
          `INSERT INTO campaign_variants
            (campaign_id, shirt_model_id, color_id, unit_price_cents)
           VALUES (?, ?, ?, ?)`,
          [campaignResult.insertId, modelIds.get(model.modelCode), colorIds.get(color.name), model.unitPriceCents],
        );
      }
      for (const size of model.sizes) {
        await connection.execute(
          `INSERT INTO campaign_model_sizes (campaign_id, shirt_model_id, size_id)
           VALUES (?, ?, ?)`,
          [campaignResult.insertId, modelIds.get(model.modelCode), sizeIds.get(size)],
        );
      }
    }
  });
  return getCampaign(code);
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
async function updateCampaign(request, code) {
  await requireStaff(request);
  const body = await readJson(request);

  const changed = await withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      "SELECT id, phase, art_front_url, art_back_url, art_render_mode FROM campaigns WHERE code = ? LIMIT 1 FOR UPDATE",
      [code],
    );
    if (rows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    const campaign = rows[0];

    const assignments = [];
    const parameters = [];
    const set = (column, value) => { assignments.push(`${column} = ?`); parameters.push(value); };

    if (body.title !== undefined) set("title", requireText(body.title, "title", 180));
    if (body.subtitle !== undefined) set("subtitle", optionalText(body.subtitle, 255));
    if (body.deadlineAt !== undefined) set("deadline_at", parseDeadline(body.deadlineAt));
    if (body.pickupInstructions !== undefined) set("pickup_instructions", requireText(body.pickupInstructions, "pickupInstructions", 255));
    if (body.representative !== undefined) {
      const representative = body.representative ?? {};
      set("representative_name", requireText(representative.name, "representative.name", 160));
      set("representative_whatsapp", normalizeWhatsapp(representative.whatsapp, "representative.whatsapp"));
    }
    if (body.artFrontUrl !== undefined) set("art_front_url", requireText(body.artFrontUrl, "artFrontUrl", 2048));
    if (body.artBackUrl !== undefined) set("art_back_url", optionalText(body.artBackUrl, 2048));
    if (body.artRenderMode !== undefined) set("art_render_mode", parseArtRenderMode(body.artRenderMode));
    if (assignments.length > 0) {
      await connection.execute(`UPDATE campaigns SET ${assignments.join(", ")} WHERE id = ?`, [...parameters, campaign.id]);
    }

    if (body.models !== undefined) {
      if (campaign.phase !== "receiving_orders") {
        throw new ApiError(409, "CAMPAIGN_NOT_RECEIVING", "Preço, cores e tamanhos só podem mudar enquanto a campanha está recebendo pedidos.");
      }
      await applyCampaignModels(connection, campaign.id, parseCampaignModels(body.models));
    }

    return { artFrontUrl: campaign.art_front_url, artBackUrl: campaign.art_back_url };
  });

  // Fora da transação: apagar arquivo é irreversível e não pode acontecer antes do commit.
  if (body.artFrontUrl !== undefined) await removeOrphanUpload(changed.artFrontUrl);
  if (body.artBackUrl !== undefined) await removeOrphanUpload(changed.artBackUrl);
  return getCampaign(code);
}

/** Atualiza o que segue à venda, mantendo no banco o histórico necessário aos pedidos antigos. */
async function applyCampaignModels(connection, campaignId, models) {
  const { modelIds, colorIds, sizeIds } = await resolveCatalogIds(connection, models);
  const wantedModelIds = new Set(modelIds.values());
  const wantedVariants = new Set();
  const wantedSizes = new Set();
  for (const model of models) {
    const modelId = modelIds.get(model.modelCode);
    for (const color of model.colors) wantedVariants.add(`${modelId}:${colorIds.get(color.name)}`);
    for (const size of model.sizes) wantedSizes.add(`${modelId}:${sizeIds.get(size)}`);
  }

  const [currentVariants] = await connection.execute(
    `SELECT cv.id, cv.shirt_model_id, cv.color_id, sm.name AS model_name, co.name AS color_name
       FROM campaign_variants cv
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
      WHERE cv.campaign_id = ? AND cv.active = TRUE`,
    [campaignId],
  );
  for (const variant of currentVariants) {
    if (wantedVariants.has(`${variant.shirt_model_id}:${variant.color_id}`)) continue;
    // Retirar um corte inteiro encerra somente novas vendas. A variante permanece no
    // banco, inativa, para que pedidos anteriores continuem em relatórios e produção.
    if (!wantedModelIds.has(variant.shirt_model_id)) {
      await connection.execute("UPDATE campaign_variants SET active = FALSE WHERE id = ?", [variant.id]);
      continue;
    }
    const [used] = await connection.execute(
      `SELECT o.order_number FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.status = 'active'
        WHERE oi.campaign_variant_id = ? LIMIT 1`,
      [variant.id],
    );
    if (used.length > 0) {
      throw new ApiError(
        409,
        "VARIANT_IN_USE",
        `A cor ${variant.color_name} do corte ${variant.model_name} não pode sair: o pedido ${used[0].order_number} já a escolheu.`,
        { orderNumber: used[0].order_number, model: variant.model_name, color: variant.color_name },
      );
    }
    // Desativada, e não apagada: os pedidos antigos continuam apontando para ela.
    await connection.execute("UPDATE campaign_variants SET active = FALSE WHERE id = ?", [variant.id]);
  }

  const [currentSizes] = await connection.execute(
    `SELECT cms.id, cms.shirt_model_id, cms.size_id, sm.name AS model_name, sz.code AS size_code
       FROM campaign_model_sizes cms
       JOIN shirt_models sm ON sm.id = cms.shirt_model_id
       JOIN sizes sz ON sz.id = cms.size_id
      WHERE cms.campaign_id = ?`,
    [campaignId],
  );
  for (const size of currentSizes) {
    if (wantedSizes.has(`${size.shirt_model_id}:${size.size_id}`)) continue;
    // Os tamanhos do corte retirado ficam como histórico. Sem variante ativa, eles não
    // aparecem no checkout nem podem ser usados para criar um novo pedido.
    if (!wantedModelIds.has(size.shirt_model_id)) continue;
    const [used] = await connection.execute(
      `SELECT o.order_number FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.status = 'active'
         JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
        WHERE cv.campaign_id = ? AND cv.shirt_model_id = ? AND oi.size_id = ? LIMIT 1`,
      [campaignId, size.shirt_model_id, size.size_id],
    );
    if (used.length > 0) {
      throw new ApiError(
        409,
        "SIZE_IN_USE",
        `O tamanho ${size.size_code} do corte ${size.model_name} não pode sair: o pedido ${used[0].order_number} já o escolheu.`,
        { orderNumber: used[0].order_number, model: size.model_name, size: size.size_code },
      );
    }
    await connection.execute("DELETE FROM campaign_model_sizes WHERE id = ?", [size.id]);
  }

  for (const model of models) {
    const modelId = modelIds.get(model.modelCode);
    for (const color of model.colors) {
      // Reativa a variante quando a cor volta, em vez de esbarrar na chave única.
      await connection.execute(
        `INSERT INTO campaign_variants (campaign_id, shirt_model_id, color_id, unit_price_cents)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE unit_price_cents = VALUES(unit_price_cents), active = TRUE`,
        [campaignId, modelId, colorIds.get(color.name), model.unitPriceCents],
      );
    }
    for (const size of model.sizes) {
      await connection.execute(
        `INSERT INTO campaign_model_sizes (campaign_id, shirt_model_id, size_id) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE size_id = VALUES(size_id)`,
        [campaignId, modelId, sizeIds.get(size)],
      );
    }
  }
}

/**
 * Apaga a arte substituída. A conferência de uso evita levar junto a imagem de outra
 * campanha — duas campanhas podem apontar para o mesmo arquivo se a arte for reenviada.
 */
async function removeOrphanUpload(url) {
  if (!url || !/^\/uploads\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(url)) return;
  const [rows] = await pool.execute(
    "SELECT 1 FROM campaigns WHERE art_front_url = ? OR art_back_url = ? LIMIT 1",
    [url, url],
  );
  if (rows.length > 0) return;
  try {
    await fs.unlink(path.join(uploadsDirectory, url.slice("/uploads/".length)));
  } catch {
    // O arquivo já não estava lá; nada a fazer.
  }
}

async function createOrder(request) {
  const idempotencyKey = requireText(request.headers["idempotency-key"], "Idempotency-Key", 128);
  const body = await readJson(request);
  const campaignCode = requireText(body.campaignCode, "campaignCode", 40).toUpperCase();
  const customer = body.customer ?? {};
  const customerName = requireText(customer.name, "customer.name", 160);
  const customerWhatsapp = normalizeWhatsapp(customer.whatsapp);
  const suppliedCustomerEmail = requireText(customer.email, "customer.email", 254);
  const customerEmail = normalizeEmail(suppliedCustomerEmail);
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
    const [existingRows] = await connection.execute(
      "SELECT order_number, total_cents, payment_status FROM orders WHERE idempotency_key = ? LIMIT 1",
      [idempotencyKey],
    );
    if (existingRows.length > 0) return { created: false, order: existingRows[0] };

    const [campaignRows] = await connection.execute(
      "SELECT id, phase FROM campaigns WHERE code = ? LIMIT 1 FOR UPDATE",
      [campaignCode],
    );
    if (campaignRows.length === 0) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    const campaign = campaignRows[0];
    // A fase operacional é a autoridade de abertura. Se a equipe retornar uma
    // campanha para `receiving_orders`, a ação deliberada reabre os pedidos mesmo
    // quando o prazo originalmente divulgado já passou.
    if (campaign.phase !== "receiving_orders") throw new ApiError(409, "CAMPAIGN_NOT_RECEIVING", "Esta campanha não está recebendo pedidos.");

    const variantIds = [...new Set(requestedItems.map((item) => item.variantId))];
    const placeholders = variantIds.map(() => "?").join(", ");
    const [variantRows] = await connection.execute(
      `SELECT id, shirt_model_id, unit_price_cents FROM campaign_variants
        WHERE campaign_id = ? AND active = TRUE AND id IN (${placeholders}) FOR UPDATE`,
      [campaign.id, ...variantIds],
    );
    if (variantRows.length !== variantIds.length) throw new ApiError(422, "INVALID_VARIANT", "Uma ou mais opções não pertencem a esta campanha.");
    const prices = new Map(variantRows.map((row) => [Number(row.id), Number(row.unit_price_cents)]));
    const variantModels = new Map(variantRows.map((row) => [Number(row.id), Number(row.shirt_model_id)]));

    const [allowedSizeRows] = await connection.execute(
      `SELECT cms.shirt_model_id, cms.size_id, sz.code
         FROM campaign_model_sizes cms
         JOIN sizes sz ON sz.id = cms.size_id
        WHERE cms.campaign_id = ? AND sz.active = TRUE`,
      [campaign.id],
    );
    const sizeIdByModelAndCode = new Map(
      allowedSizeRows.map((row) => [`${Number(row.shirt_model_id)}:${row.code}`, Number(row.size_id)]),
    );
    const items = requestedItems.map((item) => {
      const sizeId = sizeIdByModelAndCode.get(`${variantModels.get(item.variantId)}:${item.size}`);
      if (!sizeId) throw new ApiError(422, "INVALID_SIZE", `O tamanho ${item.size} não está disponível nesta campanha.`);
      return { ...item, sizeId };
    });

    const totalCents = items.reduce((total, item) => total + prices.get(item.variantId) * item.quantity, 0);
    const orderNumber = publicOrderNumber();

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
        (order_number, idempotency_key, campaign_id, customer_name, customer_whatsapp, customer_email, total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, idempotencyKey, campaign.id, customerName, customerWhatsapp, customerEmail, totalCents],
    );
    for (const item of items) {
      await connection.execute(
        `INSERT INTO order_items (order_id, campaign_variant_id, size_id, quantity, unit_price_cents)
         VALUES (?, ?, ?, ?, ?)`,
        [orderResult.insertId, item.variantId, item.sizeId, item.quantity, prices.get(item.variantId)],
      );
    }
    return { created: true, order: { order_number: orderNumber, total_cents: totalCents, payment_status: "pending" } };
  });
}

function effectiveOrderStatus(order) {
  if (order.status === "cancelled") return "cancelled";
  if (order.payment_status === "failed") return "failed";
  if (order.payment_status !== "paid") return "pending";
  if (order.delivery_status === "delivered") return "delivered";
  if (["ready_for_delivery", "completed"].includes(order.campaign_phase)) return "ready";
  if (order.campaign_phase === "production") return "production";
  return "confirmed";
}

async function trackOrder(requestUrl, orderNumber) {
  const whatsapp = normalizeWhatsapp(requestUrl.searchParams.get("whatsapp"));
  const [rows] = await pool.execute(
    // Sem filtrar por status: um pedido cancelado precisa aparecer como cancelado para o
    // aluno, e não como "pedido não encontrado".
    `SELECT o.id, o.order_number, o.customer_name, o.status, o.cancellation_reason,
            o.payment_status, o.delivery_status,
            o.total_cents, o.created_at, o.paid_at, o.delivered_at,
            c.code AS campaign_code, c.title AS campaign_title, c.phase AS campaign_phase,
            c.representative_name, c.pickup_instructions, c.art_front_url, c.art_back_url
       FROM orders o
       JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.order_number = ? AND o.customer_whatsapp = ?
      LIMIT 1`,
    [orderNumber, whatsapp],
  );
  if (rows.length === 0) throw new ApiError(404, "ORDER_NOT_FOUND", "Pedido não encontrado com os dados informados.");
  const order = rows[0];
  const [items] = await pool.execute(
    `SELECT sm.name AS model_name, co.name AS color_name, co.hex_color, sz.code AS size,
            sz.size_group, oi.quantity, oi.unit_price_cents, oi.line_total_cents
       FROM order_items oi
       JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
       JOIN sizes sz ON sz.id = oi.size_id
      WHERE oi.order_id = ? ORDER BY oi.id`,
    [order.id],
  );
  return {
    number: order.order_number,
    status: effectiveOrderStatus(order),
    cancellationReason: order.cancellation_reason,
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
      artFrontUrl: order.art_front_url,
      artBackUrl: order.art_back_url,
    },
    items: items.map((item) => ({
      modelName: item.model_name,
      color: { name: item.color_name, hex: item.hex_color },
      size: item.size,
      sizeGroup: item.size_group,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
    })),
  };
}

/**
 * Inclui os cancelados de propósito. Some da tela é pior do que aparecer riscado: a
 * camisaria precisa poder responder "esse pedido foi cancelado por tal motivo".
 */
async function listCampaignOrders(code) {
  const [rows] = await pool.execute(
    `SELECT o.order_number, o.customer_name, o.customer_whatsapp, o.customer_email,
            o.status, o.cancellation_reason, o.payment_status, o.delivery_status,
            o.total_cents, o.created_at,
            sm.name AS model_name, co.name AS color_name, co.hex_color,
            sz.code AS size, sz.size_group, oi.quantity, oi.unit_price_cents
       FROM campaigns c
       JOIN orders o ON o.campaign_id = c.id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
       JOIN sizes sz ON sz.id = oi.size_id
      WHERE c.code = ?
      ORDER BY o.created_at DESC, oi.id`,
    [code],
  );
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
        deliveryStatus: row.delivery_status,
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
      lineTotalCents: Number(row.quantity) * Number(row.unit_price_cents),
    });
  }
  return [...orders.values()];
}

async function changeDeliveryStatus(request, orderNumber) {
  const staff = await requireStaff(request);
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
      `INSERT INTO delivery_history (order_id, previous_status, next_status, note, changed_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [order.id, order.delivery_status, nextStatus, note, staff.id],
    );
    return { number: orderNumber, previousStatus: order.delivery_status, deliveryStatus: nextStatus, unchanged: false };
  });
}

/**
 * Cancelamento. O pedido não é apagado: sai dos relatórios e da produção, mas continua
 * no banco com o motivo e o autor, porque "por que este pedido sumiu?" precisa ter
 * resposta. Pedido pago não é cancelado direto — o reembolso é registrado antes, senão o
 * dinheiro recebido some do histórico junto com o pedido.
 */
async function cancelOrder(request, orderNumber) {
  const staff = await requireStaff(request);
  const body = await readJson(request);
  const reason = requireText(body.reason, "reason", 500);
  if (reason.length < 3) throw new ApiError(422, "CANCEL_REASON_REQUIRED", "Descreva o motivo do cancelamento.");

  return withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      "SELECT id, status, payment_status FROM orders WHERE order_number = ? LIMIT 1 FOR UPDATE",
      [orderNumber],
    );
    if (rows.length === 0) throw new ApiError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    const order = rows[0];
    if (order.status === "cancelled") return { number: orderNumber, status: "cancelled", unchanged: true };
    if (["paid", "partially_refunded"].includes(order.payment_status)) {
      throw new ApiError(
        409,
        "ORDER_PAID_NOT_REFUNDED",
        "Este pedido está pago. Registre o reembolso antes de cancelar.",
      );
    }
    await connection.execute(
      `UPDATE orders SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP(3),
         cancellation_reason = ?, cancelled_by_user_id = ? WHERE id = ?`,
      [reason, staff.id, order.id],
    );
    return { number: orderNumber, status: "cancelled", reason, unchanged: false };
  });
}

/**
 * Registra um estorno já concluído na conta InfinitePay. A API pública do Checkout
 * Integrado não documenta uma operação de reembolso, então esta rota nunca movimenta
 * dinheiro: ela exige a referência obtida no app/painel do provedor e cria a trilha
 * local antes de cancelar o pedido e retirá-lo dos relatórios.
 */
async function registerOrderRefund(request, orderNumber) {
  const staff = await requireStaff(request);
  const body = await readJson(request);
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
    const [rows] = await connection.execute(
      "SELECT id, status, payment_status, total_cents FROM orders WHERE order_number = ? LIMIT 1 FOR UPDATE",
      [orderNumber],
    );
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
    const [payments] = await connection.execute(
      `SELECT id, provider FROM payments
        WHERE order_id = ? AND status = 'paid'
        ORDER BY confirmed_at DESC, id DESC LIMIT 1 FOR UPDATE`,
      [order.id],
    );
    if (payments.length === 0) {
      throw new ApiError(409, "CONFIRMED_PAYMENT_NOT_FOUND", "O pagamento confirmado do pedido não foi encontrado.");
    }
    const payment = payments[0];
    try {
      await connection.execute(
        `INSERT INTO order_refunds
          (order_id, payment_id, provider, provider_refund_id, amount_cents, reason, receipt_url, refunded_at, recorded_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [order.id, payment.id, payment.provider, providerRefundId, amountCents, reason, receiptUrl, refundedAt, staff.id],
      );
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw new ApiError(409, "REFUND_REFERENCE_ALREADY_USED", "Esta referência de reembolso já foi registrada.");
      }
      throw error;
    }
    await connection.execute("UPDATE payments SET status = 'refunded' WHERE id = ?", [payment.id]);
    await connection.execute(
      `UPDATE orders SET payment_status = 'refunded', status = 'cancelled',
         cancelled_at = CURRENT_TIMESTAMP(3), cancellation_reason = ?, cancelled_by_user_id = ?
       WHERE id = ?`,
      [`Reembolso integral: ${reason}`.slice(0, 500), staff.id, order.id],
    );
    return {
      number: orderNumber,
      status: "cancelled",
      paymentStatus: "refunded",
      amountCents,
      providerRefundId,
    };
  });
}

async function changeCampaignPhase(request, code) {
  const staff = await requireStaff(request);
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
        (campaign_id, previous_phase, next_phase, direction, reason, changed_by_user_id, changed_by_label)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [campaign.id, campaign.phase, targetPhase, direction, reason, staff.id, staff.name],
    );
    return { code, previousPhase: campaign.phase, phase: targetPhase, direction };
  });
}

async function listSizes() {
  const [rows] = await pool.execute(
    "SELECT code, name, size_group FROM sizes WHERE active = TRUE ORDER BY sort_order",
  );
  return rows.map((row) => ({ code: row.code, name: row.name, group: row.size_group }));
}

function looksLikeImage(buffer, extension) {
  if (extension === "png") return buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (extension === "jpg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  return buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP";
}

async function uploadArtwork(request) {
  await requireStaff(request);
  const contentType = String(request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  const extension = uploadExtensions.get(contentType);
  if (!extension) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Envie a arte em PNG, JPG ou WEBP.");
  }
  const file = await readBinary(request, maxUploadBytes);
  if (!looksLikeImage(file, extension)) {
    throw new ApiError(422, "INVALID_IMAGE", "O arquivo enviado não é uma imagem válida.");
  }
  const filename = `${randomUUID()}.${extension}`;
  await fs.mkdir(uploadsDirectory, { recursive: true });
  await fs.writeFile(path.join(uploadsDirectory, filename), file);
  return { url: `/uploads/${filename}`, bytes: file.length };
}

async function serveUpload(response, filename) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(filename)) {
    throw new ApiError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.");
  }
  let file;
  try {
    file = await fs.readFile(path.join(uploadsDirectory, filename));
  } catch {
    throw new ApiError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.");
  }
  response.writeHead(200, {
    "Content-Type": uploadContentTypes.get(filename.split(".").pop()),
    "Content-Length": file.length,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(file);
}

async function serveFrontend(request, response, requestPath) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const requestedFile = path.resolve(frontendDirectory, relativePath);
  const relativeToFrontend = path.relative(frontendDirectory, requestedFile);
  const staysInsideFrontend = relativeToFrontend
    && !relativeToFrontend.startsWith("..")
    && !path.isAbsolute(relativeToFrontend);

  let filePath = staysInsideFrontend ? requestedFile : path.join(frontendDirectory, "index.html");
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) filePath = path.join(frontendDirectory, "index.html");
  } catch {
    // Fallback do React para caminhos que nao correspondem a um arquivo compilado.
    filePath = path.join(frontendDirectory, "index.html");
  }

  let file;
  try {
    file = await fs.readFile(filePath);
  } catch {
    throw new ApiError(503, "FRONTEND_UNAVAILABLE", "O site ainda nao foi compilado neste servidor.");
  }

  const extension = path.extname(filePath).toLowerCase();
  const immutableAsset = relativeToFrontend.startsWith(`assets${path.sep}`);
  response.writeHead(200, {
    "Content-Type": frontendContentTypes.get(extension) || "application/octet-stream",
    "Content-Length": file.length,
    "Cache-Control": immutableAsset ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : file);
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
    `SELECT campaign_code, campaign_title, model_name, color_name, hex_color, size, size_group, size_sort_order, quantity
       FROM v_production_report${condition}
      ORDER BY campaign_title, model_name, color_name, size_sort_order`,
    parameters,
  );
  return rows.map((row) => ({
    campaignCode: row.campaign_code,
    campaignTitle: row.campaign_title,
    modelName: row.model_name,
    color: { name: row.color_name, hex: row.hex_color },
    size: row.size,
    sizeGroup: row.size_group,
    sizeSortOrder: Number(row.size_sort_order),
    quantity: Number(row.quantity),
  }));
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
      ORDER BY campaign_title, customer_name, order_number, size_sort_order`,
    parameters,
  );
  return rows.map((row) => ({
    campaignCode: row.campaign_code,
    campaignTitle: row.campaign_title,
    representativeName: row.representative_name,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerWhatsapp: row.customer_whatsapp,
    modelName: row.model_name,
    colorName: row.color_name,
    size: row.size,
    quantity: Number(row.quantity),
    deliveryStatus: row.effective_delivery_status,
  }));
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
    sendJson(response, 200, { ok: true, ...await databaseReadiness(), ...await storageReadiness() });
    return;
  }
  const uploadMatch = path.match(/^\/uploads\/([^/]+)$/);
  if (request.method === "GET" && uploadMatch) {
    await serveUpload(response, uploadMatch[1]);
    return;
  }
  if (request.method === "GET" && path === "/api/settings") {
    sendJson(response, 200, publicSettings());
    return;
  }
  if (request.method === "POST" && path === "/api/auth/login") {
    sendJson(response, 200, await login(request));
    return;
  }
  if (request.method === "POST" && path === "/api/auth/password/forgot") {
    sendJson(response, 202, await requestPasswordReset(request));
    return;
  }
  if (request.method === "GET" && path === "/api/auth/password/reset") {
    const reset = await resolvePasswordResetToken(requestUrl.searchParams.get("token") ?? "");
    if (!reset) throw new ApiError(410, "RESET_TOKEN_INVALID", "Este link de redefinição expirou ou já foi usado.");
    sendJson(response, 200, { email: reset.email, name: reset.name });
    return;
  }
  if (request.method === "POST" && path === "/api/auth/password/reset") {
    sendJson(response, 200, await confirmPasswordReset(request));
    return;
  }
  if (request.method === "PATCH" && path === "/api/admin/account") {
    sendJson(response, 200, await updateAccount(request));
    return;
  }
  if (request.method === "POST" && path === "/api/auth/logout") {
    await deleteSession(bearerToken(request));
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === "GET" && path === "/api/auth/session") {
    const session = await resolveSession(bearerToken(request));
    if (!session) throw new ApiError(401, "UNAUTHORIZED", "Sessão expirada. Entre novamente.");
    sendJson(response, 200, { user: session.user, expiresAt: session.expiresAt });
    return;
  }
  if (request.method === "GET" && path === "/api/sizes") {
    sendJson(response, 200, { sizes: await listSizes() });
    return;
  }
  if (request.method === "POST" && path === "/api/admin/uploads") {
    sendJson(response, 201, await uploadArtwork(request));
    return;
  }
  const publicCampaignMatch = path.match(/^\/api\/campaigns\/([^/]+)$/);
  if (request.method === "GET" && publicCampaignMatch) {
    sendJson(response, 200, { campaign: await getCampaign(publicCampaignMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "POST" && path === "/api/orders") {
    const attemptKey = `order:${clientAddress(request)}`;
    assertRateLimitAllowed(
      attemptKey,
      maxOrderAttempts,
      orderWindowMs,
      "Muitos pedidos enviados em pouco tempo. Aguarde alguns minutos.",
    );
    registerRateLimitedAttempt(attemptKey, orderWindowMs);
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
  const checkoutMatch = path.match(/^\/api\/orders\/([^/]+)\/checkout$/);
  if (request.method === "POST" && checkoutMatch) {
    const body = await readJson(request);
    const whatsapp = normalizeWhatsapp(body.whatsapp);
    sendJson(response, 200, {
      checkout: await createCheckoutForOrder(checkoutMatch[1].toUpperCase(), whatsapp),
    });
    return;
  }
  if (request.method === "POST" && path === "/api/payments/infinitepay/webhook") {
    const queued = await enqueueInfinitePayEvent(await readJson(request), "webhook");
    sendJson(response, 200, { success: true, message: null, ...queued });
    return;
  }
  if (request.method === "POST" && path === "/api/payments/infinitepay/reconcile") {
    const queued = await enqueueInfinitePayEvent(await readJson(request), "browser_return");
    sendJson(response, 202, queued);
    return;
  }
  const trackingMatch = path.match(/^\/api\/orders\/([^/]+)$/);
  if (request.method === "GET" && trackingMatch) {
    sendJson(response, 200, { order: await trackOrder(requestUrl, trackingMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/campaigns") {
    await requireStaff(request);
    sendJson(response, 200, { campaigns: await listCampaigns() });
    return;
  }
  if (request.method === "POST" && path === "/api/admin/campaigns") {
    sendJson(response, 201, { campaign: await createCampaign(request) });
    return;
  }
  const campaignMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)$/);
  if (request.method === "PATCH" && campaignMatch) {
    sendJson(response, 200, { campaign: await updateCampaign(request, campaignMatch[1].toUpperCase()) });
    return;
  }
  const phaseMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/phase$/);
  if (request.method === "PATCH" && phaseMatch) {
    sendJson(response, 200, { campaign: await changeCampaignPhase(request, phaseMatch[1].toUpperCase()) });
    return;
  }
  const campaignOrdersMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/orders$/);
  if (request.method === "GET" && campaignOrdersMatch) {
    await requireStaff(request);
    sendJson(response, 200, { orders: await listCampaignOrders(campaignOrdersMatch[1].toUpperCase()) });
    return;
  }
  const cancelMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/cancel$/);
  if (request.method === "PATCH" && cancelMatch) {
    sendJson(response, 200, { order: await cancelOrder(request, cancelMatch[1].toUpperCase()) });
    return;
  }
  const refundMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/refund$/);
  if (request.method === "POST" && refundMatch) {
    sendJson(response, 201, { refund: await registerOrderRefund(request, refundMatch[1].toUpperCase()) });
    return;
  }
  const deliveryMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/delivery$/);
  if (request.method === "PATCH" && deliveryMatch) {
    sendJson(response, 200, { order: await changeDeliveryStatus(request, deliveryMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/reports/production") {
    await requireStaff(request);
    sendJson(response, 200, { rows: await productionReport(requestUrl) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/reports/delivery") {
    await requireStaff(request);
    sendJson(response, 200, { rows: await deliveryReport(requestUrl) });
    return;
  }
  if ((request.method === "GET" || request.method === "HEAD") && !path.startsWith("/api/")) {
    await serveFrontend(request, response, path);
    return;
  }
  throw new ApiError(404, "ROUTE_NOT_FOUND", "Rota não encontrada.");
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    const knownError = error instanceof ApiError || error instanceof PaymentIntegrationError;
    const status = knownError ? error.status : 500;
    const code = knownError ? error.code : "INTERNAL_ERROR";
    if (!knownError) console.error(error);
    sendJson(response, status, {
      error: { code, message: knownError ? error.message : "Erro interno do servidor.", details: error.details },
    });
  });
});

/**
 * Conferências de inicialização. Nenhuma delas impede a API de subir: elas existem
 * para que um deploy com senha de fábrica, chave curta ou usuário de demonstração
 * apareça no log em vez de passar despercebido.
 */
async function reportStartupChecks() {
  const warnings = [];
  if (config.adminApiTokenEnabled && !config.adminApiToken) {
    warnings.push("ADMIN_API_TOKEN_ENABLED está ativo, mas a chave de manutenção não foi configurada.");
  } else if (config.adminApiTokenEnabled && config.adminApiToken.length < 32) {
    warnings.push("ADMIN_API_TOKEN tem menos de 32 caracteres. Desabilite a chave ou gere uma chave longa.");
  }
  if (!config.payments.infinitePay.handle) {
    warnings.push("INFINITEPAY_HANDLE não configurada: o checkout ainda não pode identificar a conta da camisaria.");
  }
  if (!config.payments.infinitePay.checkoutEnabled) {
    warnings.push("Checkout InfinitePay desabilitado até a homologação real de checkout, webhook e payment_check.");
  }
  if (config.isProduction && /^https?:\/\/(127\.0\.0\.1|localhost)/.test(config.publicAppUrl)) {
    warnings.push("PUBLIC_APP_URL aponta para o próprio servidor. O link de redefinição de senha não vai funcionar.");
  }
  if (!mailerConfigured()) {
    warnings.push("SMTP não configurado: recuperação de senha e confirmações de pagamento por e-mail ficam indisponíveis.");
  }

  try {
    await databaseReadiness();
    await storageReadiness();
  } catch (error) {
    warnings.push(error instanceof ApiError ? error.message : `Não foi possível conferir banco/armazenamento: ${error.message}`);
  }

  try {
    const [demoUsers] = await pool.execute(
      "SELECT email FROM users WHERE email IN ('admin@teste.com') AND active = TRUE",
    );
    for (const user of demoUsers) {
      warnings.push(`O usuário de demonstração ${user.email} ainda está ativo. Apague-o antes de publicar.`);
    }
    const [pending] = await pool.execute("SELECT email FROM users WHERE must_change_password = TRUE AND active = TRUE");
    for (const user of pending) {
      console.log(`Aviso: ${user.email} ainda usa a senha provisória e precisa trocá-la no primeiro acesso.`);
    }
  } catch (error) {
    console.warn("Não foi possível conferir os usuários no boot:", error.message);
  }

  for (const warning of warnings) console.warn(`Atenção: ${warning}`);
}

async function productionStartupErrors() {
  const errors = productionConfigurationErrors();
  if (!config.isProduction || errors.length > 0) return errors;
  try {
    await databaseReadiness();
    await storageReadiness();
    const [demoUsers] = await pool.execute(
      "SELECT email FROM users WHERE email = 'admin@teste.com' AND active = TRUE",
    );
    if (demoUsers.length > 0) errors.push("O usuário de demonstração admin@teste.com precisa ser desativado.");
    const [provisionalUsers] = await pool.execute(
      "SELECT email FROM users WHERE must_change_password = TRUE AND active = TRUE LIMIT 1",
    );
    if (provisionalUsers.length > 0) {
      errors.push(`A conta ${provisionalUsers[0].email} ainda usa senha provisória e precisa trocá-la antes da produção.`);
    }
  } catch (error) {
    errors.push(error instanceof ApiError ? error.message : `Pré-verificação operacional falhou: ${error.message}`);
  }
  return errors;
}

let stopOrderEmailWorker = () => {};
let stopInfinitePayWorker = () => {};
const startupErrors = await productionStartupErrors();
if (startupErrors.length > 0) {
  for (const error of startupErrors) console.error(`Configuração de produção recusada: ${error}`);
  await pool.end();
  process.exitCode = 1;
} else {
  server.listen(config.port, config.host, async () => {
    console.log(`API da Camisaria Mendes em http://${config.host}:${config.port} (${config.environment})`);
    await reportStartupChecks();
    stopOrderEmailWorker = startOrderEmailNotificationWorker();
    stopInfinitePayWorker = startInfinitePayReconciliationWorker();
  });
}

async function shutdown(signal) {
  console.log(`${signal}: encerrando API...`);
  stopOrderEmailWorker();
  stopInfinitePayWorker();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
