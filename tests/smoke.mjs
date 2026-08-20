import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import mysql from "mysql2/promise";
import { resetTestDatabase } from "./reset-test-database.mjs";
import { projectDirectory, testEnvironment } from "./test-environment.mjs";
import { createLicenseCommand } from "../api/license-token.mjs";

const environment = testEnvironment();
const { privateKey: licensePrivateKeyObject, publicKey: licensePublicKeyObject } = generateKeyPairSync("ed25519");
const licensePrivateKey = licensePrivateKeyObject.export({ format: "pem", type: "pkcs8" });
environment.LICENSE_CONTROL_ENABLED = "true";
environment.LICENSE_INSTALLATION_ID = "cliente-smoke-001";
environment.LICENSE_PUBLIC_KEY_BASE64 = licensePublicKeyObject.export({ format: "der", type: "spki" }).toString("base64");
const baseUrl = `http://${environment.API_HOST}:${environment.API_PORT}`;

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectDirectory,
    env: environment,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error([
      `Falha ao executar ${script}.`,
      result.stdout?.trim(),
      result.stderr?.trim(),
    ].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

function assertInvalidProductionIsRejected() {
  const result = spawnSync(process.execPath, ["api/server.mjs"], {
    cwd: projectDirectory,
    env: {
      ...environment,
      APP_ENV: "production",
      PUBLIC_APP_URL: "http://127.0.0.1:4175",
      CORS_ORIGIN: "http://127.0.0.1:4175",
      TRUST_PROXY: "false",
      ADMIN_INITIAL_PASSWORD: "senha-provisoria-a-remover",
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
      SMTP_FROM: "",
      DB_USER: "root",
      UPLOADS_DIR: projectDirectory,
      PAYMENT_PROVIDER: "manual",
      INFINITEPAY_HANDLE: "",
      INFINITEPAY_CHECKOUT_ENABLED: "false",
    },
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(result.status, 1, "A API aceitou uma configuração de produção insegura.");
  const output = `${result.stdout}\n${result.stderr}`;
  for (const expected of ["PUBLIC_APP_URL", "TRUST_PROXY", "ADMIN_INITIAL_PASSWORD", "SMTP_HOST", "DB_USER", "UPLOADS_DIR", "PAYMENT_PROVIDER"]) {
    assert.match(output, new RegExp(expected), `A recusa de produção não mencionou ${expected}.`);
  }
}

function assertAdminBootstrapHidesPassword() {
  const password = "senha-bootstrap-smoke-2026";
  const result = spawnSync(process.execPath, ["api/create-admin.mjs"], {
    cwd: projectDirectory,
    env: {
      ...environment,
      ADMIN_INITIAL_NAME: "Bootstrap Smoke",
      ADMIN_INITIAL_EMAIL: "bootstrap@smoke.test",
      ADMIN_INITIAL_PASSWORD: password,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.doesNotMatch(output, new RegExp(password), "O bootstrap expôs a senha provisória no log.");
  assert.match(output, /omitida dos logs/i);

  const missing = spawnSync(process.execPath, ["api/create-admin.mjs"], {
    cwd: projectDirectory,
    env: {
      ...environment,
      ADMIN_INITIAL_EMAIL: "sem-senha@smoke.test",
      ADMIN_INITIAL_PASSWORD: "",
    },
    encoding: "utf8",
  });
  assert.equal(missing.status, 1, "O bootstrap aceitou senha inicial ausente.");
  assert.match(`${missing.stdout}\n${missing.stderr}`, /informada explicitamente/i);
}

const fakeInfinitePay = { links: [], checks: new Map(), checkRequests: [] };

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function startFakeInfinitePay() {
  const server = http.createServer(async (request, response) => {
    const body = await readRequestJson(request);
    response.setHeader("Content-Type", "application/json");
    if (request.method === "POST" && request.url === "/links") {
      // O provedor real recusa telefone fora do formato internacional com
      // 422 "not a valid phone number". O fake precisa recusar igual: foi a ausencia
      // desta validacao que deixou passar um checkout enviando +DDD sem o codigo do pais.
      if (!/^[+]55[0-9]{10,11}$/.test(String(body.customer?.phone_number ?? ""))) {
        response.statusCode = 422;
        response.end(JSON.stringify({
          success: false,
          message: "Invalid checkout link params",
          errors: { customer: { phone_number: ["not a valid phone number"] } },
        }));
        return;
      }
      fakeInfinitePay.links.push(body);
      response.end(JSON.stringify({
        url: `https://checkout.infinitepay.io/smoke-infinitepay?lenc=${encodeURIComponent(body.order_nsu)}`,
      }));
      return;
    }
    if (request.method === "POST" && request.url === "/payment_check") {
      fakeInfinitePay.checkRequests.push(body);
      response.end(JSON.stringify(fakeInfinitePay.checks.get(body.transaction_nsu) ?? {
        success: true,
        paid: false,
        amount: 0,
      }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not_found" }));
  });
  const port = Number.parseInt(new URL(environment.INFINITEPAY_API_BASE_URL).port, 10);
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return server;
}

async function deliverQueuedPaymentEmailForTest(orderNumber) {
  Object.assign(process.env, environment);
  const { processPaymentConfirmationEmails } = await import("../api/order-email-notifications.mjs");
  const connection = await mysql.createConnection({
    host: environment.DB_HOST,
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    database: environment.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
  });
  const messages = [];
  try {
    const first = await processPaymentConfirmationEmails({
      database: connection,
      send: async (message) => { messages.push(message); },
    });
    assert.deepEqual(first, { processed: 1, sent: 1, failed: 0 });
    assert.equal(messages.length, 1);

    const second = await processPaymentConfirmationEmails({
      database: connection,
      send: async (message) => { messages.push(message); },
    });
    assert.deepEqual(second, { processed: 0, sent: 0, failed: 0 });

    await connection.execute(
      "UPDATE orders SET payment_status = 'paid' WHERE order_number = ?",
      [orderNumber],
    );
    const [notifications] = await connection.execute(
      `SELECT status, attempts, sent_at FROM order_email_notifications
        WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)`,
      [orderNumber],
    );
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].status, "sent");
    assert.equal(Number(notifications[0].attempts), 1);
    assert.ok(notifications[0].sent_at);
    return messages[0];
  } finally {
    await connection.end();
  }
}

async function expireCampaignDeadlineForTest(code) {
  const connection = await mysql.createConnection({
    host: environment.DB_HOST,
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    database: environment.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    await connection.execute("UPDATE campaigns SET deadline_at = '2020-01-01 00:00:00' WHERE code = ?", [code]);
  } finally {
    await connection.end();
  }
}

async function paymentEventsForTest(orderNumber) {
  const connection = await mysql.createConnection({
    host: environment.DB_HOST,
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    database: environment.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    const [rows] = await connection.execute(
      `SELECT pe.order_id, pe.provider_event_id, pe.payload, pe.attempts,
              pe.processed_at, pe.dead_lettered_at
         FROM payment_events pe
         JOIN orders o ON o.id = pe.order_id
        WHERE o.order_number = ?
        ORDER BY pe.id`,
      [orderNumber],
    );
    return rows;
  } finally {
    await connection.end();
  }
}

async function forcePaymentEventDueForTest(transactionNsu) {
  const connection = await mysql.createConnection({
    host: environment.DB_HOST,
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    database: environment.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    await connection.execute(
      `UPDATE payment_events SET available_at = CURRENT_TIMESTAMP(3), locked_at = NULL
        WHERE provider = 'infinitepay' AND provider_event_id = ?`,
      [transactionNsu],
    );
  } finally {
    await connection.end();
  }
}

async function insertFuturePaymentEventForTest(orderNumber, transactionNsu, invoiceSlug, amountCents) {
  const connection = await mysql.createConnection({
    host: environment.DB_HOST,
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    database: environment.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    await connection.execute(
      `INSERT INTO payment_events
        (provider, order_id, provider_event_id, event_type, signature_valid, payload, available_at)
       SELECT 'infinitepay', id, ?, 'payment_approved', FALSE, ?,
              DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 1 DAY)
         FROM orders WHERE order_number = ?`,
      [
        transactionNsu,
        JSON.stringify({ order_nsu: orderNumber, transaction_nsu: transactionNsu, invoice_slug: invoiceSlug, amount: amountCents }),
        orderNumber,
      ],
    );
  } finally {
    await connection.end();
  }
}

async function paymentLifecycleForTest(orderNumber) {
  const connection = await mysql.createConnection({
    host: environment.DB_HOST,
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    database: environment.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    const [rows] = await connection.execute(
      `SELECT o.status, o.payment_status, pc.status AS checkout_status,
              SUM(p.status = 'paid') AS paid_payment_count
         FROM orders o
         LEFT JOIN payment_checkouts pc ON pc.order_id = o.id AND pc.provider = 'infinitepay'
         LEFT JOIN payments p ON p.order_id = o.id
        WHERE o.order_number = ?
        GROUP BY o.id, o.status, o.payment_status, pc.status`,
      [orderNumber],
    );
    return rows[0];
  } finally {
    await connection.end();
  }
}

async function backdateSessionForTest(token) {
  const connection = await mysql.createConnection({
    host: environment.DB_HOST,
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    database: environment.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    await connection.execute(
      `UPDATE staff_sessions
          SET created_at = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 8 DAY),
              expires_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 12 HOUR)
        WHERE token_hash = ?`,
      [createHash("sha256").update(token).digest("hex")],
    );
  } finally {
    await connection.end();
  }
}

async function placeSessionNearAbsoluteLimitForTest(token) {
  const connection = await mysql.createConnection({
    host: environment.DB_HOST,
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    database: environment.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    await connection.execute(
      `UPDATE staff_sessions
          SET created_at = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 167 HOUR),
              expires_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 1 HOUR)
        WHERE token_hash = ?`,
      [createHash("sha256").update(token).digest("hex")],
    );
  } finally {
    await connection.end();
  }
}

async function forceFinalPaymentAttemptForTest(transactionNsu) {
  const connection = await mysql.createConnection({
    host: environment.DB_HOST,
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    database: environment.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    await connection.execute(
      `UPDATE payment_events
          SET attempts = 5, available_at = CURRENT_TIMESTAMP(3), locked_at = NULL
        WHERE provider = 'infinitepay' AND provider_event_id = ?`,
      [transactionNsu],
    );
  } finally {
    await connection.end();
  }
}

async function waitForDeadLetterForTest(orderNumber, transactionNsu) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rows = await paymentEventsForTest(orderNumber);
    const event = rows.find((row) => row.provider_event_id === transactionNsu);
    if (event?.dead_lettered_at) return event;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Evento ${transactionNsu} não foi encerrado após a tentativa final.`);
}

async function waitForPaymentEventSettlementForTest(orderNumber, transactionNsu) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const rows = await paymentEventsForTest(orderNumber);
    const event = rows.find((row) => row.provider_event_id === transactionNsu);
    if (event?.processed_at || event?.dead_lettered_at) return event;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Evento ${transactionNsu} não alcançou estado terminal.`);
}

async function request(path, { method = "GET", token, headers = {}, body, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => ({}));
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: esperado ${expected}, recebido ${response.status} ${JSON.stringify(payload)}`,
  );
  return payload;
}

async function binaryRequest(path, { method = "POST", token, headers = {}, body, expected = 201 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body,
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.status, expected, `${method} ${path}: esperado ${expected}, recebido ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

const validMp4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from("ftypisom", "ascii"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("isommp42", "ascii"),
]);

async function waitForApi(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error("A API encerrou antes do smoke test.");
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response.json();
    } catch {
      // A API ainda está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("A API de teste não ficou pronta no prazo esperado.");
}

async function waitForOrderStatus(orderNumber, whatsapp, expectedStatus) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const payload = await request(`/api/orders/${orderNumber}?whatsapp=${whatsapp}`);
    if (payload.order.status === expectedStatus) return payload.order;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Pedido ${orderNumber} não alcançou o status ${expectedStatus}.`);
}

function startApi() {
  const child = spawn(process.execPath, ["api/server.mjs"], {
    cwd: projectDirectory,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function stopApi(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function step(name) {
  console.log(`✓ ${name}`);
}

assertInvalidProductionIsRejected();
step("produção recusa configuração insegura antes de abrir a porta");
await resetTestDatabase(environment);
step(`isolamento confirmado em ${environment.DB_NAME}`);
runNode("api/migrate.mjs");
runNode("api/seed.mjs");
step("banco recriado, migrado e sem dados do ambiente principal");
assertAdminBootstrapHidesPassword();
step("bootstrap exige senha explícita e nunca a imprime nos logs");

const providerApi = await startFakeInfinitePay();
const api = startApi();
try {
  const health = await waitForApi(api.child);
  assert.equal(health.schema.ready, true);
  assert.equal(health.schema.current, "023_license_control");
  assert.equal(health.storage.ready, true);
  assert.equal(health.license.status, "active");
  step("health check valida conexão e versão do schema");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@teste.com", password: "123456" },
  });
  assert.ok(login.token);
  const token = login.token;
  const session = await request("/api/auth/session", { token });
  assert.equal(session.user.email, "admin@teste.com");
  await request("/api/admin/campaigns", {
    expected: 401,
    headers: { "X-Admin-Token": environment.ADMIN_API_TOKEN || "token-local" },
  });
  await request("/api/admin/campaigns", {
    expected: 401,
    token: environment.ADMIN_API_TOKEN,
  });
  step("variáveis legadas e X-Admin-Token não concedem acesso administrativo");
  step("login e sessão da camisaria");

  await binaryRequest("/api/admin/video-uploads", {
    headers: { "Content-Type": "video/mp4" },
    body: validMp4,
    expected: 401,
  });
  await binaryRequest("/api/admin/video-uploads", {
    token,
    headers: { "Content-Type": "video/mp4" },
    body: Buffer.from("arquivo renomeado sem assinatura"),
    expected: 422,
  });
  await binaryRequest("/api/admin/video-uploads", {
    token,
    headers: { "Content-Type": "video/mp4" },
    body: Buffer.alloc(10 * 1024 * 1024 + 1),
    expected: 413,
  });
  const uploadedVideo = await binaryRequest("/api/admin/video-uploads", {
    token,
    headers: { "Content-Type": "video/mp4" },
    body: validMp4,
  });
  const uploadedVideoForInactiveColor = await binaryRequest("/api/admin/video-uploads", {
    token,
    headers: { "Content-Type": "video/mp4" },
    body: validMp4,
  });
  assert.match(uploadedVideo.url, /^\/uploads\/[0-9a-f-]{36}\.mp4$/);
  assert.equal(uploadedVideo.bytes, validMp4.length);

  const headVideo = await fetch(`${baseUrl}${uploadedVideo.url}`, { method: "HEAD" });
  assert.equal(headVideo.status, 200);
  assert.equal(headVideo.headers.get("accept-ranges"), "bytes");
  assert.equal(Number(headVideo.headers.get("content-length")), validMp4.length);
  const rangedVideo = await fetch(`${baseUrl}${uploadedVideo.url}`, { headers: { Range: "bytes=4-7" } });
  assert.equal(rangedVideo.status, 206);
  assert.equal(rangedVideo.headers.get("content-range"), `bytes 4-7/${validMp4.length}`);
  assert.equal(Buffer.from(await rangedVideo.arrayBuffer()).toString("ascii"), "ftyp");
  const invalidRange = await fetch(`${baseUrl}${uploadedVideo.url}`, { headers: { Range: "bytes=999-1000" } });
  assert.equal(invalidRange.status, 416);
  assert.equal(invalidRange.headers.get("content-range"), `bytes */${validMp4.length}`);

  await new Promise((resolve) => {
    const interrupted = http.request(`${baseUrl}/api/admin/video-uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4", "Content-Length": 1024 },
    });
    interrupted.on("error", resolve);
    interrupted.write(validMp4.subarray(0, 12));
    setTimeout(() => { interrupted.destroy(); resolve(); }, 10);
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const temporaryVideoFiles = await fs.readdir(`${environment.UPLOADS_DIR}/.tmp`).catch(() => []);
  assert.equal(temporaryVideoFiles.some((name) => name.endsWith(".part")), false);
  step("upload MP4 valida autenticação, assinatura, limite, cancelamento e streaming Range/HEAD");

  const customCampaignPayload = {
    code: "MENDES-CORES-26",
    title: "Campanha com cor personalizada",
    subtitle: "Validação da paleta por HEX",
    deadlineAt: "2027-12-31T23:59:59.000Z",
    pickupInstructions: "Retirada com a representante",
    representative: { name: "Representante das Cores", whatsapp: "5598999992000" },
    artFrontUrl: "/uploads/smoke-custom-color.png",
    artRenderMode: "overlay",
    presentationConfig: { mockupEnabled: true, realPhotosEnabled: true },
    realPhotos: [
      { colorName: "Lilás lavanda", urls: ["/uploads/11111111-1111-4111-8111-111111111111.jpg", "/uploads/22222222-2222-4222-8222-222222222222.webp"] },
      { colorName: "Preto", urls: ["/uploads/33333333-3333-4333-8333-333333333333.png"] },
    ],
    realVideos: [
      { colorName: "Lilás lavanda", url: uploadedVideo.url, posterUrl: null, durationSeconds: 12, bytes: uploadedVideo.bytes },
      { colorName: "Preto", url: uploadedVideoForInactiveColor.url, posterUrl: null, durationSeconds: 8, bytes: uploadedVideoForInactiveColor.bytes },
    ],
    coupon: {
      code: "CORES-10",
      discounts: [
        { modelCode: "common", discountCents: 1000 },
        { modelCode: "oversized", discountCents: 1500 },
      ],
      expiresAt: "2027-12-20T23:59:59.000Z",
      usageLimit: 1,
      minimumQuantity: 3,
      maximumDiscountQuantity: 4,
    },
    models: [
      { modelCode: "common", unitPriceCents: 5990, colors: [{ name: "Lilás lavanda", hex: "#8B5CF6" }], sizes: ["P", "M", "EXGG"] },
      { modelCode: "oversized", unitPriceCents: 6990, colors: [{ name: "Preto", hex: "#111315" }], sizes: ["M", "G"] },
    ],
  };
  await request("/api/admin/campaigns", { method: "POST", expected: 201, token, body: customCampaignPayload });
  const customCampaign = (await request("/api/campaigns/MENDES-CORES-26")).campaign;
  assert.equal(customCampaign.artRenderMode, "overlay");
  assert.deepEqual(customCampaign.presentationConfig, customCampaignPayload.presentationConfig);
  const customVariant = customCampaign.variants.find((candidate) => candidate.color.name === "Lilás lavanda");
  assert.ok(customVariant);
  assert.equal(customVariant.color.hex, "#8B5CF6");
  assert.deepEqual(customVariant.realPhotoUrls, customCampaignPayload.realPhotos[0].urls);
  assert.deepEqual(customCampaign.realPhotos.find((gallery) => gallery.colorName === "Preto").urls, customCampaignPayload.realPhotos[1].urls);
  assert.equal(customCampaign.realVideos.find((video) => video.colorName === "Lilás lavanda").url, uploadedVideo.url);
  assert.ok(customCampaign.sizes.some((size) => size.model.code === "common" && size.code === "EXGG"));
  assert.equal(Object.hasOwn(customCampaign, "activeCoupon"), false);
  step("campanha aceita e publica cor personalizada com nome e código HEX");

  const adminCustomCampaign = (await request(`/api/admin/campaigns/${customCampaign.code}`, { token })).campaign;
  assert.equal(adminCustomCampaign.activeCoupon.code, customCampaignPayload.coupon.code);
  assert.equal(adminCustomCampaign.activeCoupon.minimumQuantity, 3);
  assert.equal(adminCustomCampaign.activeCoupon.maximumDiscountQuantity, 4);
  assert.deepEqual(
    adminCustomCampaign.activeCoupon.discounts.map((discount) => [discount.modelCode, discount.discountCents]),
    [["common", 1000], ["oversized", 1500]],
  );
  const validatedCoupon = (await request(`/api/campaigns/${customCampaign.code}/coupon?code=cores-10`)).coupon;
  assert.equal(validatedCoupon.minimumQuantity, 3);
  assert.equal(validatedCoupon.maximumDiscountQuantity, 4);
  assert.deepEqual(
    validatedCoupon.discounts.map((discount) => [discount.modelCode, discount.discountCents]),
    [["common", 1000], ["oversized", 1500]],
  );
  const couponCommonVariant = customCampaign.variants.find((candidate) => candidate.model.code === "common");
  const couponOversizedVariant = customCampaign.variants.find((candidate) => candidate.model.code === "oversized");
  const couponCommonSize = customCampaign.sizes.find((candidate) => candidate.model.code === "common");
  const couponOversizedSize = customCampaign.sizes.find((candidate) => candidate.model.code === "oversized");
  const couponOrderBody = {
    campaignCode: customCampaign.code,
    couponCode: "CORES-10",
    customer: { name: "Cliente com cupom", whatsapp: "5598999992070", email: "cupom@example.com" },
    items: [
      { variantId: couponCommonVariant.id, size: couponCommonSize.code, quantity: 1 },
      { variantId: couponOversizedVariant.id, size: couponOversizedSize.code, quantity: 1 },
    ],
  };
  await request("/api/orders", {
    method: "POST",
    expected: 422,
    headers: { "Idempotency-Key": randomUUID() },
    body: { ...couponOrderBody, couponCodes: ["CORES-10", "OUTRO-CUPOM"] },
  });
  await request("/api/orders", {
    method: "POST",
    expected: 409,
    headers: { "Idempotency-Key": randomUUID() },
    body: couponOrderBody,
  });
  const qualifyingCouponOrderBody = {
    ...couponOrderBody,
    items: couponOrderBody.items.map((item, index) => ({ ...item, quantity: index === 0 ? 1 : 2 })),
  };
  const discountedOrder = await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": randomUUID() },
    body: qualifyingCouponOrderBody,
  });
  assert.equal(discountedOrder.order.totalCents, 15970);
  const trackedDiscountedOrder = await request(`/api/orders/${discountedOrder.order.number}?whatsapp=5598999992070`);
  assert.equal(trackedDiscountedOrder.order.subtotalCents, 19970);
  assert.equal(trackedDiscountedOrder.order.discountCents, 4000);
  assert.equal(trackedDiscountedOrder.order.couponCode, "CORES-10");
  assert.deepEqual(trackedDiscountedOrder.order.items.map((item) => item.unitDiscountCents), [1000, 1500]);
  assert.deepEqual(trackedDiscountedOrder.order.items.map((item) => item.discountedQuantity), [1, 2]);
  await request("/api/orders", {
    method: "POST",
    expected: 409,
    headers: { "Idempotency-Key": randomUUID() },
    body: { ...qualifyingCouponOrderBody, customer: { ...qualifyingCouponOrderBody.customer, whatsapp: "5598999992071", email: "limite@example.com" } },
  });
  await request(`/api/admin/orders/${discountedOrder.order.number}/cancel`, {
    method: "PATCH",
    token,
    body: { reason: "Liberação controlada do limite do cupom" },
  });
  const cappedCouponOrderBody = {
    ...qualifyingCouponOrderBody,
    customer: { ...qualifyingCouponOrderBody.customer, whatsapp: "5598999992072", email: "liberado@example.com" },
    items: qualifyingCouponOrderBody.items.map((item, index) => ({ ...item, quantity: index === 0 ? 1 : 5 })),
  };
  const replacementCouponOrder = await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": randomUUID() },
    body: cappedCouponOrderBody,
  });
  assert.equal(replacementCouponOrder.order.totalCents, 34940);
  const trackedCappedCouponOrder = await request(`/api/orders/${replacementCouponOrder.order.number}?whatsapp=5598999992072`);
  assert.equal(trackedCappedCouponOrder.order.subtotalCents, 40940);
  assert.equal(trackedCappedCouponOrder.order.discountCents, 6000);
  assert.deepEqual(trackedCappedCouponOrder.order.items.map((item) => item.unitDiscountCents), [0, 1500]);
  assert.deepEqual(trackedCappedCouponOrder.order.items.map((item) => item.discountedQuantity), [0, 4]);
  assert.deepEqual(trackedCappedCouponOrder.order.items.map((item) => item.lineTotalCents), [5990, 28950]);
  await request(`/api/orders/${replacementCouponOrder.order.number}/checkout`, {
    method: "POST",
    body: { whatsapp: "5598999992072" },
  });
  const cappedCheckoutLink = fakeInfinitePay.links.at(-1);
  assert.equal(cappedCheckoutLink.items.length, 3);
  assert.deepEqual(cappedCheckoutLink.items.map((item) => [item.quantity, item.price]), [[1, 5990], [4, 5490], [1, 6990]]);
  assert.equal(cappedCheckoutLink.items.reduce((sum, item) => sum + item.price * item.quantity, 0), replacementCouponOrder.order.totalCents);
  fakeInfinitePay.links.length = 0;
  await request(`/api/admin/campaigns/${customCampaign.code}`, { method: "PATCH", token, body: { coupon: null } });
  await request(`/api/campaigns/${customCampaign.code}/coupon?code=CORES-10`, { expected: 404 });
  const campaignWithoutCoupon = (await request(`/api/admin/campaigns/${customCampaign.code}`, { token })).campaign;
  assert.equal(campaignWithoutCoupon.activeCoupon, null);
  const preservedCouponOrder = await request(`/api/orders/${replacementCouponOrder.order.number}?whatsapp=5598999992072`);
  assert.equal(preservedCouponOrder.order.couponCode, "CORES-10");
  assert.equal(preservedCouponOrder.order.discountCents, 6000);
  assert.deepEqual(preservedCouponOrder.order.items.map((item) => item.discountedQuantity), [0, 4]);
  step("cupom não acumula códigos, exige quantidade mínima, limita peças descontadas por corte e preserva o histórico");

  const replacementVideo = await binaryRequest("/api/admin/video-uploads", {
    token,
    headers: { "Content-Type": "video/mp4" },
    body: validMp4,
  });
  await request(`/api/admin/campaigns/${customCampaign.code}`, {
    method: "PATCH",
    token,
    body: { realVideos: [
      { colorName: "Lilás lavanda", url: replacementVideo.url, posterUrl: null, durationSeconds: 10, bytes: replacementVideo.bytes },
      customCampaignPayload.realVideos[1],
    ] },
  });
  const campaignWithReplacementVideo = (await request(`/api/campaigns/${customCampaign.code}`)).campaign;
  assert.equal(campaignWithReplacementVideo.realVideos.find((video) => video.colorName === "Lilás lavanda").url, replacementVideo.url);
  await request(uploadedVideo.url, { expected: 404 });
  await request(`/api/admin/campaigns/${customCampaign.code}`, {
    method: "PATCH",
    token,
    body: { realVideos: [customCampaignPayload.realVideos[1]] },
  });
  const campaignWithoutLilacVideo = (await request(`/api/campaigns/${customCampaign.code}`)).campaign;
  assert.equal(campaignWithoutLilacVideo.realVideos.some((video) => video.colorName === "Lilás lavanda"), false);
  await request(replacementVideo.url, { expected: 404 });
  step("vídeo por cor pode ser criado, substituído e removido com limpeza do arquivo órfão");

  await request("/api/admin/campaigns", {
    method: "POST",
    expected: 422,
    token,
    body: {
      ...customCampaignPayload,
      code: "MENDES-GRADE-COMUM-INVALIDA",
      models: [{ ...customCampaignPayload.models[0], sizes: ["PP"] }],
    },
  });
  await request("/api/admin/campaigns", {
    method: "POST",
    expected: 422,
    token,
    body: {
      ...customCampaignPayload,
      code: "MENDES-GRADE-OVER-INVALIDA",
      models: [{ ...customCampaignPayload.models[1], sizes: ["PB"] }],
    },
  });
  step("API limita Tradicional, Baby look e Oversized às respectivas grades comerciais");

  await request(`/api/admin/campaigns/${customCampaign.code}`, {
    method: "PATCH",
    expected: 422,
    token,
    body: { realPhotos: [{ colorName: "Lilás lavanda", urls: Array.from({ length: 7 }, (_, index) => `/uploads/44444444-4444-4444-8444-44444444444${index}.jpg`) }] },
  });
  step("galeria real limita seis fotos por cor");

  const galleryOnlyPayload = {
    ...customCampaignPayload,
    code: "MENDES-GALERIA-26",
    title: "Campanha somente com fotos reais",
    artFrontUrl: undefined,
    artRenderMode: undefined,
    artworkConfig: undefined,
    coupon: null,
    presentationConfig: { mockupEnabled: false, realPhotosEnabled: true },
    models: [{ modelCode: "common", unitPriceCents: 5990, colors: [{ name: "Branco", hex: "#F3F3EF" }], sizes: ["M"] }],
    realPhotos: [{ colorName: "Branco", urls: ["/uploads/55555555-5555-4555-8555-555555555555.jpg"] }],
    realVideos: [],
  };
  await request("/api/admin/campaigns", { method: "POST", expected: 201, token, body: galleryOnlyPayload });
  const galleryOnlyCampaign = (await request(`/api/campaigns/${galleryOnlyPayload.code}`)).campaign;
  assert.deepEqual(galleryOnlyCampaign.presentationConfig, { mockupEnabled: false, realPhotosEnabled: true });
  assert.equal(galleryOnlyCampaign.artFrontUrl, null);
  assert.deepEqual(galleryOnlyCampaign.realPhotos[0].urls, galleryOnlyPayload.realPhotos[0].urls);
  await request("/api/admin/campaigns", {
    method: "POST",
    expected: 422,
    token,
    body: { ...galleryOnlyPayload, code: "MENDES-SEM-IMAGEM", presentationConfig: { mockupEnabled: false, realPhotosEnabled: false } },
  });
  await request("/api/admin/campaigns", {
    method: "POST",
    expected: 422,
    token,
    body: { ...galleryOnlyPayload, code: "MENDES-GALERIA-VAZIA", realPhotos: [] },
  });
  step("campanha aceita somente galeria e recusa salvar sem nenhuma opção visual ou sem foto por cor");

  const identityTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
  const adjustedOverlay = {
    mode: "overlay",
    base: {
      front: { url: "/uploads/smoke-base-overlay.png", transform: { x: 4, y: -6, scale: 1.15, rotation: 3 } },
      back: null,
    },
    variants: [
      {
        modelCode: "common",
        colorName: "Lilás lavanda",
        front: { source: "inherit", transformOverride: true, transform: { x: 12, y: 8, scale: 0.9, rotation: -7 } },
        back: { source: "none", transformOverride: false, transform: identityTransform },
      },
      {
        modelCode: "oversized",
        colorName: "Preto",
        front: { source: "custom", url: "/uploads/smoke-oversized-art.png", transformOverride: true, transform: { x: -5, y: 10, scale: 1.4, rotation: 15 } },
        back: { source: "none", transformOverride: false, transform: identityTransform },
      },
    ],
  };
  await request(`/api/admin/campaigns/${customCampaign.code}`, { method: "PATCH", token, body: { artworkConfig: adjustedOverlay } });
  const campaignWithAdjustedArt = (await request(`/api/campaigns/${customCampaign.code}`)).campaign;
  const inheritedArtwork = campaignWithAdjustedArt.variants.find((candidate) => candidate.model.code === "common").artwork.front;
  const customArtwork = campaignWithAdjustedArt.variants.find((candidate) => candidate.model.code === "oversized").artwork.front;
  assert.equal(inheritedArtwork.url, "/uploads/smoke-base-overlay.png");
  assert.deepEqual(inheritedArtwork.transform, { x: 12, y: 8, scale: 0.9, rotation: -7 });
  assert.equal(customArtwork.url, "/uploads/smoke-oversized-art.png");
  assert.deepEqual(customArtwork.transform, { x: -5, y: 10, scale: 1.4, rotation: 15 });
  step("arte-base, substituição e ajuste independente são resolvidos por corte e cor");

  const individualPayload = {
    ...customCampaignPayload,
    code: "MENDES-MOCKUPS-26",
    title: "Campanha com mockups individuais",
    artFrontUrl: undefined,
    artRenderMode: undefined,
    presentationConfig: { mockupEnabled: true, realPhotosEnabled: false },
    realPhotos: [],
    realVideos: [],
    models: [
      { modelCode: "common", unitPriceCents: 5990, colors: [{ name: "Branco", hex: "#F3F3EF" }], sizes: ["P"] },
      { modelCode: "oversized", unitPriceCents: 6990, colors: [{ name: "Preto", hex: "#111315" }], sizes: ["M"] },
    ],
    artworkConfig: {
      mode: "variant_mockup",
      base: { front: null, back: null },
      variants: [
        { modelCode: "common", colorName: "Branco", front: { source: "custom", url: "/uploads/smoke-white-front.jpg", transform: identityTransform }, back: { source: "none", transform: identityTransform } },
        { modelCode: "oversized", colorName: "Preto", front: { source: "none", transform: identityTransform }, back: { source: "custom", url: "/uploads/smoke-black-back.webp", transform: identityTransform } },
      ],
    },
  };
  await request("/api/admin/campaigns", { method: "POST", expected: 201, token, body: individualPayload });
  const individualCampaign = (await request("/api/campaigns/MENDES-MOCKUPS-26")).campaign;
  assert.equal(individualCampaign.artRenderMode, "variant_mockup");
  assert.equal(individualCampaign.variants.find((candidate) => candidate.model.code === "common").artwork.front.url, "/uploads/smoke-white-front.jpg");
  assert.equal(individualCampaign.variants.find((candidate) => candidate.model.code === "oversized").artwork.front, null);
  assert.equal(individualCampaign.variants.find((candidate) => candidate.model.code === "oversized").artwork.back.url, "/uploads/smoke-black-back.webp");
  await request("/api/admin/campaigns", {
    method: "POST",
    expected: 422,
    token,
    body: {
      ...individualPayload,
      code: "MENDES-MOCKUP-INVALIDO",
      artworkConfig: { ...individualPayload.artworkConfig, variants: individualPayload.artworkConfig.variants.slice(0, 1) },
    },
  });
  step("mockup individual aceita frente ou costas e recusa combinação sem imagem");
  await request(`/api/admin/campaigns/${individualCampaign.code}/phase`, { method: "PATCH", token, body: { targetPhase: "orders_closed" } });
  const changedIndividualArtwork = structuredClone(individualPayload.artworkConfig);
  changedIndividualArtwork.variants[0].front.url = "/uploads/smoke-white-front-v2.jpg";
  await request(`/api/admin/campaigns/${individualCampaign.code}`, { method: "PATCH", token, body: { artworkConfig: changedIndividualArtwork } });
  await request(`/api/admin/campaigns/${individualCampaign.code}`, { method: "PATCH", expected: 409, token, body: { models: individualPayload.models } });
  const closedCampaign = (await request(`/api/campaigns/${individualCampaign.code}`)).campaign;
  assert.equal(closedCampaign.variants.find((candidate) => candidate.model.code === "common").artwork.front.url, "/uploads/smoke-white-front-v2.jpg");
  step("arte continua editável após fechar pedidos, enquanto as variantes permanecem travadas");

  const disposableVideo = await binaryRequest("/api/admin/video-uploads", {
    token,
    headers: { "Content-Type": "video/mp4" },
    body: validMp4,
  });
  const disposableCampaignPayload = {
    ...customCampaignPayload,
    code: "MENDES-EXCLUIR-26",
    title: "Campanha descartável sem pedidos",
    artFrontUrl: "/uploads/smoke-disposable.png",
    realVideos: [{ colorName: "Lilás lavanda", url: disposableVideo.url, posterUrl: null, durationSeconds: 5, bytes: disposableVideo.bytes }],
  };
  await request("/api/admin/campaigns", { method: "POST", expected: 201, token, body: disposableCampaignPayload });
  const campaignsBeforeDelete = await request("/api/admin/campaigns", { token });
  assert.equal(campaignsBeforeDelete.campaigns.find((candidate) => candidate.code === disposableCampaignPayload.code)?.canDelete, true);
  await request(`/api/admin/campaigns/${disposableCampaignPayload.code}`, { method: "DELETE", expected: 401 });
  const deletedCampaign = await request(`/api/admin/campaigns/${disposableCampaignPayload.code}`, { method: "DELETE", token });
  assert.deepEqual(deletedCampaign.campaign, { code: disposableCampaignPayload.code, deleted: true });
  await request(`/api/campaigns/${disposableCampaignPayload.code}`, { expected: 404 });
  await request(disposableVideo.url, { expected: 404 });
  step("campanha sem pedidos pode ser excluída somente por uma sessão administrativa");

  const removedModelVariant = customCampaign.variants.find((candidate) => candidate.model.code === "oversized");
  const removedModelSize = customCampaign.sizes.find((candidate) => candidate.model.code === "oversized");
  assert.ok(removedModelVariant && removedModelSize);
  const historicalOrder = await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      campaignCode: customCampaign.code,
      customer: { name: "Cliente do corte retirado", whatsapp: "5598999992026", email: "historico@example.com" },
      items: [{ variantId: removedModelVariant.id, size: removedModelSize.code, quantity: 1 }],
    },
  });
  await request(`/api/admin/campaigns/${customCampaign.code}`, { method: "DELETE", expected: 409, token });
  const campaignsAfterProtectedDelete = await request("/api/admin/campaigns", { token });
  assert.equal(campaignsAfterProtectedDelete.campaigns.find((candidate) => candidate.code === customCampaign.code)?.canDelete, false);
  await request(`/api/admin/campaigns/${customCampaign.code}`, {
    method: "PATCH",
    token,
    body: {
      models: [customCampaignPayload.models[0]],
      realPhotos: [customCampaignPayload.realPhotos[0]],
      realVideos: [],
    },
  });
  const campaignWithoutOversized = (await request(`/api/campaigns/${customCampaign.code}`)).campaign;
  assert.equal(campaignWithoutOversized.variants.some((candidate) => candidate.model.code === "oversized"), false);
  assert.deepEqual(campaignWithoutOversized.realPhotos.find((gallery) => gallery.colorName === "Preto").urls, customCampaignPayload.realPhotos[1].urls);
  assert.equal(campaignWithoutOversized.realVideos.find((video) => video.colorName === "Preto").url, uploadedVideoForInactiveColor.url);
  step("foto e vídeo não são exigidos para a cor de um corte removido da campanha");
  const preservedHistoricalOrder = await request(`/api/orders/${historicalOrder.order.number}?whatsapp=5598999992026`);
  assert.equal(preservedHistoricalOrder.order.items[0].modelName, "Oversized");
  await request("/api/orders", {
    method: "POST",
    expected: 422,
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      campaignCode: customCampaign.code,
      customer: { name: "Nova compra bloqueada", whatsapp: "5598999992027", email: "bloqueada@example.com" },
      items: [{ variantId: removedModelVariant.id, size: removedModelSize.code, quantity: 1 }],
    },
  });
  step("campanha com pedido não pode ser excluída; edição preserva o histórico e bloqueia novas compras retiradas");

  runNode("api/create-user.mjs", ["Representante Smoke", "representante@smoke.test", "senha-representante", "representative"]);
  await request("/api/auth/login", {
    method: "POST",
    expected: 403,
    body: { email: "representante@smoke.test", password: "senha-representante" },
  });
  step("representante não recebe sessão nem acesso ao painel");

  const campaignPayload = await request("/api/campaigns/MENDES-ADS-26");
  const campaign = campaignPayload.campaign;
  const variant = campaign.variants.find((candidate) => candidate.model.code === "common");
  const allowedSize = campaign.sizes.find((size) => size.model.code === variant.model.code);
  const secondVariant = campaign.variants.find((candidate) => candidate.id !== variant.id);
  const secondAllowedSize = campaign.sizes.find((size) => size.model.code === secondVariant.model.code && size.code !== allowedSize.code)
    ?? campaign.sizes.find((size) => size.model.code === secondVariant.model.code);
  assert.ok(variant && allowedSize && secondVariant && secondAllowedSize);
  step("campanha pública carrega variantes e tamanhos persistidos");

  const firstKey = randomUUID();
  const firstOrderBody = {
    campaignCode: campaign.code,
    customer: { name: "Cliente Smoke Pago", whatsapp: "98999991001", email: "pago@example.com" },
    items: [
      { variantId: variant.id, size: allowedSize.code, quantity: 2 },
      { variantId: secondVariant.id, size: secondAllowedSize.code, quantity: 1 },
    ],
  };
  await request("/api/orders", {
    method: "POST",
    expected: 422,
    headers: { "Idempotency-Key": randomUUID() },
    body: { ...firstOrderBody, customer: { ...firstOrderBody.customer, email: "email-invalido" } },
  });
  step("API recusa e-mail inválido antes de registrar o pedido");

  // Digito a mais, digito a menos, DDD que nao existe e celular sem o 9 sao erros de
  // digitacao. Recusar no pedido, dizendo o que corrigir, evita a descoberta na hora de
  // pagar -- e a mensagem precisa nomear o problema, nao dizer apenas "numero invalido".
  for (const [whatsapp, esperado] of [
    ["98999991001234", "dígitos demais"],
    ["989999910", "incompleto"],
    ["10999991001", "Não existe o DDD 10"],
    ["98899991001", "começa com 9"],
  ]) {
    const recusa = await request("/api/orders", {
      method: "POST",
      expected: 422,
      headers: { "Idempotency-Key": randomUUID(), "X-Forwarded-For": "198.51.100.30" },
      body: { ...firstOrderBody, customer: { ...firstOrderBody.customer, whatsapp } },
    });
    assert.equal(recusa.error.code, "VALIDATION_ERROR");
    assert.ok(
      recusa.error.message.includes(esperado),
      `mensagem inesperada para ${whatsapp}: ${recusa.error.message}`,
    );
  }
  step("API recusa WhatsApp com dígitos a mais, a menos, DDD inexistente ou celular sem o 9");

  const firstCreated = await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": firstKey },
    body: firstOrderBody,
  });
  const firstReplay = await request("/api/orders", {
    method: "POST",
    headers: { "Idempotency-Key": firstKey },
    body: firstOrderBody,
  });
  assert.equal(firstReplay.idempotentReplay, true);
  assert.equal(firstReplay.order.number, firstCreated.order.number);
  step("pedido é persistido e repetição idempotente não duplica");

  const pendingTracking = await request(`/api/orders/${firstCreated.order.number}?whatsapp=98999991001`);
  assert.equal(pendingTracking.order.status, "pending");
  assert.equal(pendingTracking.order.items.length, 2);
  assert.equal(pendingTracking.order.items.reduce((total, item) => total + item.quantity, 0), 3);
  // O pedido foi feito digitando so o DDD. Acompanhar digitando o codigo do pais, com
  // pontuacao, precisa encontrar o mesmo pedido -- e outro numero nao pode encontrar nada.
  const trackingInternacional = await request(
    `/api/orders/${firstCreated.order.number}?whatsapp=${encodeURIComponent("+55 (98) 99999-1001")}`,
  );
  assert.deepEqual(trackingInternacional, pendingTracking);
  await request(`/api/orders/${firstCreated.order.number}?whatsapp=98999991002`, { expected: 404 });
  step("rastreio encontra o pedido com o WhatsApp em qualquer formato e recusa outro numero");

  const campaignOrders = await request(`/api/admin/campaigns/${campaign.code}/orders`, { token });
  const groupedOrder = campaignOrders.orders.find((order) => order.number === firstCreated.order.number);
  assert.equal(groupedOrder.items.length, 2);
  assert.equal(campaignOrders.orders.filter((order) => order.number === firstCreated.order.number).length, 1);
  step("pedido com cores e tamanhos diferentes permanece agrupado como uma compra");
  let production = await request(`/api/admin/reports/production?campaign=${campaign.code}`, { token });
  assert.equal(production.rows.length, 0);
  step("pedido pendente fica fora do relatório oficial");

  await request(`/api/admin/orders/${firstCreated.order.number}/payment`, {
    method: "PATCH",
    token,
    expected: 404,
    body: { status: "paid", note: "Confirmação do smoke test" },
  });
  const stillPending = await request(`/api/orders/${firstCreated.order.number}?whatsapp=98999991001`);
  assert.equal(stillPending.order.status, "pending");
  step("painel e API não oferecem confirmação manual de pagamento");

  const checkout = await request(`/api/orders/${firstCreated.order.number}/checkout`, {
    method: "POST",
    body: { whatsapp: "98999991001" },
  });
  assert.match(checkout.checkout.url, /^https:\/\/checkout\.infinitepay\.io\//);
  assert.equal(fakeInfinitePay.links.length, 1);
  assert.equal(fakeInfinitePay.links[0].handle, "smoke-infinitepay");
  assert.equal(fakeInfinitePay.links[0].order_nsu, firstCreated.order.number);
  // O cliente digita DDD + numero; o provedor exige o codigo do pais.
  assert.equal(fakeInfinitePay.links[0].customer.phone_number, "+5598999991001");
  assert.equal(fakeInfinitePay.links[0].items.length, 2);
  assert.equal(fakeInfinitePay.links[0].items.reduce((sum, item) => sum + item.price * item.quantity, 0), firstCreated.order.totalCents);
  assert.match(fakeInfinitePay.links[0].webhook_url, /\/api\/payments\/infinitepay\/webhook$/);
  const checkoutReplay = await request(`/api/orders/${firstCreated.order.number}/checkout`, {
    method: "POST",
    body: { whatsapp: "98999991001" },
  });
  assert.equal(checkoutReplay.checkout.reused, true);
  assert.equal(fakeInfinitePay.links.length, 1);
  step("checkout InfinitePay usa handle, pedido e valor persistidos sem duplicar link");

  // Mesmo cliente, mesmo telefone, formato diferente do que ele digitou ao pedir.
  const checkoutInternacional = await request(`/api/orders/${firstCreated.order.number}/checkout`, {
    method: "POST",
    body: { whatsapp: "+55 (98) 99999-1001" },
  });
  assert.equal(checkoutInternacional.checkout.url, checkout.checkout.url);
  await request(`/api/orders/${firstCreated.order.number}/checkout`, {
    method: "POST",
    expected: 404,
    body: { whatsapp: "98999991002" },
  });
  step("checkout aceita o WhatsApp em qualquer formato e recusa outro numero");

  const transactionNsu = randomUUID();
  const invoiceSlug = `smoke-${randomUUID()}`;
  fakeInfinitePay.checks.set(transactionNsu, {
    success: true,
    paid: true,
    amount: firstCreated.order.totalCents,
    paid_amount: firstCreated.order.totalCents,
    installments: 1,
    capture_method: "pix",
  });
  const providerEvent = {
    invoice_slug: invoiceSlug,
    amount: firstCreated.order.totalCents,
    paid_amount: firstCreated.order.totalCents,
    installments: 1,
    capture_method: "pix",
    transaction_nsu: transactionNsu,
    order_nsu: firstCreated.order.number,
    receipt_url: "https://checkout.infinitepay.com.br/receipt/smoke",
    items: fakeInfinitePay.links[0].items,
  };
  const firstWebhook = await request("/api/payments/infinitepay/webhook", {
    method: "POST",
    body: providerEvent,
  });
  assert.equal(firstWebhook.duplicate, false);
  const browserReconciliation = await request("/api/payments/infinitepay/reconcile", {
    method: "POST",
    expected: 202,
    body: { ...providerEvent, slug: providerEvent.invoice_slug, invoice_slug: undefined },
  });
  assert.equal(browserReconciliation.duplicate, true);
  await waitForOrderStatus(firstCreated.order.number, "98999991001", "confirmed");
  const paidTracking = await request(`/api/orders/${firstCreated.order.number}?whatsapp=98999991001`);
  assert.equal(paidTracking.order.paymentMethod, "pix");
  const paidCampaignOrders = await request(`/api/admin/campaigns/${campaign.code}/orders`, { token });
  assert.equal(
    paidCampaignOrders.orders.find((order) => order.number === firstCreated.order.number)?.paymentMethod,
    "pix",
  );
  assert.equal(fakeInfinitePay.checkRequests.length, 1);
  assert.equal(fakeInfinitePay.checkRequests[0].order_nsu, firstCreated.order.number);
  assert.equal(fakeInfinitePay.checkRequests[0].transaction_nsu, transactionNsu);
  step("webhook e retorno reconciliam por payment_check e exibem a forma confirmada no pedido");

  const confirmationEmail = await deliverQueuedPaymentEmailForTest(firstCreated.order.number);
  assert.equal(confirmationEmail.to, "pago@example.com");
  assert.match(confirmationEmail.subject, new RegExp(firstCreated.order.number));
  assert.match(confirmationEmail.text, new RegExp(`Código da compra: ${firstCreated.order.number}`));
  assert.match(confirmationEmail.text, /rota=acompanhar-pedido/);
  assert.match(confirmationEmail.text, new RegExp(`pedido=${firstCreated.order.number}`));
  step("pagamento confirmado agenda e entrega um único e-mail com código e link de acompanhamento");

  production = await request(`/api/admin/reports/production?campaign=${campaign.code}`, { token });
  assert.equal(production.rows.reduce((total, row) => total + row.quantity, 0), 3);
  for (const item of pendingTracking.order.items) {
    const productionItem = production.rows.find((row) => row.modelName === item.modelName && row.color.name === item.color.name && row.size === item.size);
    assert.ok(productionItem, `combinação paga ausente da produção: ${item.modelName}/${item.color.name}/${item.size}`);
    assert.equal(productionItem.quantity, item.quantity);
  }
  step("confirmação validada inclui cada cor, tamanho e corte pago na produção");

  const divergentCreated = await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      campaignCode: campaign.code,
      customer: { name: "Cliente Valor Divergente", whatsapp: "5598999991003", email: "divergente@example.com" },
      items: [{ variantId: variant.id, size: allowedSize.code, quantity: 1 }],
    },
  });
  await request(`/api/orders/${divergentCreated.order.number}/checkout`, {
    method: "POST",
    body: { whatsapp: "5598999991003" },
  });
  const divergentTransaction = randomUUID();
  fakeInfinitePay.checks.set(divergentTransaction, {
    success: true,
    paid: true,
    amount: divergentCreated.order.totalCents + 1,
    paid_amount: divergentCreated.order.totalCents + 1,
    installments: 1,
    capture_method: "pix",
  });
  await request("/api/payments/infinitepay/webhook", {
    method: "POST",
    body: {
      invoice_slug: `divergent-${randomUUID()}`,
      amount: divergentCreated.order.totalCents + 1,
      transaction_nsu: divergentTransaction,
      order_nsu: divergentCreated.order.number,
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 1250));
  const divergentTracking = await request(`/api/orders/${divergentCreated.order.number}?whatsapp=5598999991003`);
  assert.equal(divergentTracking.order.status, "pending");
  production = await request(`/api/admin/reports/production?campaign=${campaign.code}`, { token });
  assert.equal(production.rows.reduce((total, row) => total + row.quantity, 0), 3);
  step("payment_check com valor divergente não confirma nem inclui o pedido na produção");

  const boundedQueueOrder = await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      campaignCode: campaign.code,
      customer: { name: "Cliente Limite da Fila", whatsapp: "5598999991030", email: "fila@example.com" },
      items: [{ variantId: variant.id, size: allowedSize.code, quantity: 1 }],
    },
  });
  await request(`/api/orders/${boundedQueueOrder.order.number}/checkout`, {
    method: "POST",
    body: { whatsapp: "5598999991030" },
  });
  const boundedQueueTransactions = [];
  for (let index = 0; index < 4; index += 1) {
    const queuedTransaction = randomUUID();
    boundedQueueTransactions.push(queuedTransaction);
    await request("/api/payments/infinitepay/webhook", {
      method: "POST",
      body: {
        invoice_slug: `fila-${index}-${randomUUID()}`,
        transaction_nsu: queuedTransaction,
        order_nsu: boundedQueueOrder.order.number,
        items: Array.from({ length: 20 }, () => ({ untrusted: "não deve ser persistido" })),
      },
    });
  }
  await request("/api/payments/infinitepay/webhook", {
    method: "POST",
    expected: 429,
    body: {
      invoice_slug: `fila-bloqueada-${randomUUID()}`,
      transaction_nsu: randomUUID(),
      order_nsu: boundedQueueOrder.order.number,
    },
  });
  const boundedEvents = await paymentEventsForTest(boundedQueueOrder.order.number);
  assert.equal(boundedEvents.length, 4);
  assert.ok(boundedEvents.every((event) => event.order_id));
  const storedPayload = typeof boundedEvents[0].payload === "string" ? JSON.parse(boundedEvents[0].payload) : boundedEvents[0].payload;
  assert.equal(Object.hasOwn(storedPayload, "items"), false);
  await forceFinalPaymentAttemptForTest(boundedQueueTransactions[0]);
  const deadLetter = await waitForDeadLetterForTest(boundedQueueOrder.order.number, boundedQueueTransactions[0]);
  assert.equal(Number(deadLetter.attempts), 6);
  step("eventos públicos não conseguem criar uma fila de reconciliação ilimitada por pedido");

  const orderWithoutCheckout = await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      campaignCode: campaign.code,
      customer: { name: "Cliente Sem Checkout", whatsapp: "5598999991031", email: "sem-checkout@example.com" },
      items: [{ variantId: variant.id, size: allowedSize.code, quantity: 1 }],
    },
  });
  await request("/api/payments/infinitepay/webhook", {
    method: "POST",
    expected: 409,
    body: {
      invoice_slug: `sem-checkout-${randomUUID()}`,
      transaction_nsu: randomUUID(),
      order_nsu: orderWithoutCheckout.order.number,
    },
  });
  step("reconciliação exige um checkout pendente vinculado ao pedido");

  const secondCreated = await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      campaignCode: campaign.code,
      customer: { name: "Cliente Smoke Cancelado", whatsapp: "5598999991002", email: "cancelado@example.com" },
      items: [{ variantId: variant.id, size: allowedSize.code, quantity: 1 }],
    },
  });
  await request(`/api/orders/${secondCreated.order.number}/checkout`, {
    method: "POST",
    body: { whatsapp: "5598999991002" },
  });
  const cancelledLateTransaction = randomUUID();
  const cancelledLateInvoice = `cancelado-tardio-${randomUUID()}`;
  fakeInfinitePay.checks.set(cancelledLateTransaction, {
    success: true,
    paid: false,
    amount: secondCreated.order.totalCents,
  });
  await request("/api/payments/infinitepay/webhook", {
    method: "POST",
    body: {
      invoice_slug: cancelledLateInvoice,
      transaction_nsu: cancelledLateTransaction,
      order_nsu: secondCreated.order.number,
      amount: secondCreated.order.totalCents,
    },
  });
  await request(`/api/admin/orders/${secondCreated.order.number}/cancel`, {
    method: "PATCH",
    token,
    body: { reason: "Pedido duplicado no smoke test" },
  });
  fakeInfinitePay.checks.set(cancelledLateTransaction, {
    success: true,
    paid: true,
    amount: secondCreated.order.totalCents,
    paid_amount: secondCreated.order.totalCents,
    capture_method: "pix",
  });
  await forcePaymentEventDueForTest(cancelledLateTransaction);
  const cancelledLateEvent = await waitForPaymentEventSettlementForTest(secondCreated.order.number, cancelledLateTransaction);
  assert.ok(cancelledLateEvent.dead_lettered_at);
  const cancelledTracking = await request(`/api/orders/${secondCreated.order.number}?whatsapp=5598999991002`);
  assert.equal(cancelledTracking.order.status, "cancelled");
  assert.equal(cancelledTracking.order.paymentStatus, "pending");
  assert.equal(cancelledTracking.order.cancellationReason, "Pedido duplicado no smoke test");
  const cancelledLifecycle = await paymentLifecycleForTest(secondCreated.order.number);
  assert.equal(cancelledLifecycle.checkout_status, "expired");
  assert.equal(Number(cancelledLifecycle.paid_payment_count), 0);
  production = await request(`/api/admin/reports/production?campaign=${campaign.code}`, { token });
  assert.equal(production.rows.reduce((total, row) => total + row.quantity, 0), 3);
  step("cancelamento expira checkout e rejeita pagamento tardio sem alterar produção");

  for (const targetPhase of ["orders_closed", "production", "ready_for_delivery"]) {
    await request(`/api/admin/campaigns/${campaign.code}/phase`, {
      method: "PATCH",
      token,
      body: { targetPhase },
    });
  }
  let phaseTracking = await request(`/api/orders/${firstCreated.order.number}?whatsapp=98999991001`);
  assert.equal(phaseTracking.order.status, "ready");
  await request(`/api/admin/campaigns/${campaign.code}/phase`, {
    method: "PATCH",
    token,
    expected: 422,
    body: { targetPhase: "production" },
  });
  await request(`/api/admin/campaigns/${campaign.code}/phase`, {
    method: "PATCH",
    token,
    body: { targetPhase: "production", reason: "Validando retorno controlado" },
  });
  phaseTracking = await request(`/api/orders/${firstCreated.order.number}?whatsapp=98999991001`);
  assert.equal(phaseTracking.order.status, "production");
  await request(`/api/admin/campaigns/${campaign.code}/phase`, {
    method: "PATCH",
    token,
    body: { targetPhase: "orders_closed", reason: "Validando retorno ao fechamento" },
  });
  phaseTracking = await request(`/api/orders/${firstCreated.order.number}?whatsapp=98999991001`);
  assert.equal(phaseTracking.order.status, "confirmed");
  await expireCampaignDeadlineForTest(campaign.code);
  await request(`/api/admin/campaigns/${campaign.code}/phase`, {
    method: "PATCH",
    token,
    body: { targetPhase: "receiving_orders", reason: "Reabrindo pedidos no smoke test" },
  });
  const reopenedCampaign = await request(`/api/campaigns/${campaign.code}`);
  assert.equal(reopenedCampaign.campaign.phase, "receiving_orders");
  await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      campaignCode: campaign.code,
      customer: { name: "Cliente da campanha reaberta", whatsapp: "5598999991004", email: "reaberta@example.com" },
      items: [{ variantId: variant.id, size: allowedSize.code, quantity: 1 }],
    },
  });
  for (const targetPhase of ["orders_closed", "production", "ready_for_delivery"]) {
    await request(`/api/admin/campaigns/${campaign.code}/phase`, {
      method: "PATCH",
      token,
      body: { targetPhase },
    });
  }
  step("retrocesso atualiza o cliente e reabre pedidos mesmo após o prazo original");

  await request(`/api/admin/orders/${firstCreated.order.number}/delivery`, {
    method: "PATCH",
    token,
    body: { status: "delivered", note: "Entrega do smoke test" },
  });
  const deliveredTracking = await request(`/api/orders/${firstCreated.order.number}?whatsapp=98999991001`);
  assert.equal(deliveredTracking.order.status, "delivered");
  const delivery = await request(`/api/admin/reports/delivery?campaign=${campaign.code}`, { token });
  assert.equal(delivery.rows.every((row) => row.orderNumber === firstCreated.order.number), true);
  step("pedido pago percorre produção, retirada e entrega");

  await request(`/api/admin/orders/${firstCreated.order.number}/cancel`, {
    method: "PATCH",
    token,
    expected: 409,
    body: { reason: "Tentativa antes do estorno" },
  });
  await request(`/api/admin/orders/${firstCreated.order.number}/refund`, {
    method: "POST",
    token,
    expected: 422,
    body: { amountCents: firstCreated.order.totalCents - 1, providerRefundId: `refund-invalid-${randomUUID()}`, reason: "Valor parcial" },
  });
  const refundedLateTransaction = randomUUID();
  const refundedLateInvoice = `reembolso-tardio-${randomUUID()}`;
  await insertFuturePaymentEventForTest(
    firstCreated.order.number,
    refundedLateTransaction,
    refundedLateInvoice,
    firstCreated.order.totalCents,
  );
  const refundReference = `refund-smoke-${randomUUID()}`;
  const refund = await request(`/api/admin/orders/${firstCreated.order.number}/refund`, {
    method: "POST",
    token,
    expected: 201,
    body: {
      amountCents: firstCreated.order.totalCents,
      providerRefundId: refundReference,
      reason: "Desistência validada no smoke test",
      receiptUrl: "https://checkout.infinitepay.com.br/receipt/refund-smoke",
    },
  });
  assert.equal(refund.refund.paymentStatus, "refunded");
  const refundedTracking = await request(`/api/orders/${firstCreated.order.number}?whatsapp=98999991001`);
  assert.equal(refundedTracking.order.status, "cancelled");
  assert.equal(refundedTracking.order.paymentStatus, "refunded");
  assert.match(refundedTracking.order.cancellationReason, /Reembolso integral/);
  fakeInfinitePay.checks.set(refundedLateTransaction, {
    success: true,
    paid: true,
    amount: firstCreated.order.totalCents,
    paid_amount: firstCreated.order.totalCents,
    capture_method: "pix",
  });
  await forcePaymentEventDueForTest(refundedLateTransaction);
  const refundedLateEvent = await waitForPaymentEventSettlementForTest(firstCreated.order.number, refundedLateTransaction);
  assert.ok(refundedLateEvent.dead_lettered_at);
  const refundedLifecycle = await paymentLifecycleForTest(firstCreated.order.number);
  assert.equal(refundedLifecycle.checkout_status, "expired");
  assert.equal(Number(refundedLifecycle.paid_payment_count), 0);
  production = await request(`/api/admin/reports/production?campaign=${campaign.code}`, { token });
  assert.equal(production.rows.length, 0);
  step("reembolso integral expira checkout, encerra eventos tardios e retira o pedido da produção");

  const controlPage = await fetch(`${baseUrl}/controle-licenca`, { signal: AbortSignal.timeout(5000) });
  assert.equal(controlPage.status, 200);
  assert.match(controlPage.headers.get("x-robots-tag") ?? "", /noindex/);
  const initialLicense = await request("/api/license/control");
  assert.equal(initialLicense.license.status, "active");

  const suspensionCommand = createLicenseCommand({
    privateKey: licensePrivateKey,
    installationId: environment.LICENSE_INSTALLATION_ID,
    action: "suspend",
    reason: "Suspensão contratual do smoke test.",
  });
  const suspended = await request("/api/license/control", {
    method: "POST",
    body: { token: suspensionCommand },
  });
  assert.equal(suspended.license.status, "suspended");
  await request("/api/license/control", {
    method: "POST",
    expected: 409,
    body: { token: suspensionCommand },
  });

  const suspendedPage = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(5000) });
  assert.equal(suspendedPage.status, 503);
  assert.match(await suspendedPage.text(), /temporariamente suspenso/i);
  assert.equal((await request("/api/health")).license.status, "suspended");
  await request("/api/admin/campaigns", { token });
  await request("/api/orders", {
    method: "POST",
    token,
    expected: 423,
    headers: { "Idempotency-Key": randomUUID() },
    body: {},
  });
  await request("/api/admin/campaigns", {
    method: "POST",
    token,
    expected: 423,
    body: {},
  });
  await request("/api/payments/infinitepay/webhook", {
    method: "POST",
    expected: 409,
    body: {
      invoice_slug: `licenca-webhook-${randomUUID()}`,
      transaction_nsu: randomUUID(),
      order_nsu: orderWithoutCheckout.order.number,
    },
  });

  const wrongInstallationCommand = createLicenseCommand({
    privateKey: licensePrivateKey,
    installationId: "outro-cliente-001",
    action: "activate",
  });
  await request("/api/license/control", {
    method: "POST",
    expected: 403,
    body: { token: wrongInstallationCommand },
  });
  const expiredCommand = createLicenseCommand({
    privateKey: licensePrivateKey,
    installationId: environment.LICENSE_INSTALLATION_ID,
    action: "activate",
    issuedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    lifetimeMs: 60_000,
  });
  await request("/api/license/control", {
    method: "POST",
    expected: 410,
    body: { token: expiredCommand },
  });

  const activationCommand = createLicenseCommand({
    privateKey: licensePrivateKey,
    installationId: environment.LICENSE_INSTALLATION_ID,
    action: "activate",
  });
  const activeAgain = await request("/api/license/control", {
    method: "POST",
    body: { token: activationCommand },
  });
  assert.equal(activeAgain.license.status, "active");
  assert.equal((await request("/api/health")).license.status, "active");
  step("licença suspende por comando assinado, preserva consultas/webhook e reativa sem apagar dados");

  const absoluteSession = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@teste.com", password: "123456" },
  });
  await backdateSessionForTest(absoluteSession.token);
  await request("/api/auth/session", { token: absoluteSession.token, expected: 401 });
  await request("/api/admin/campaigns", { token: absoluteSession.token, expected: 401 });
  const nearAbsoluteSession = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@teste.com", password: "123456" },
  });
  await placeSessionNearAbsoluteLimitForTest(nearAbsoluteSession.token);
  const cappedSession = await request("/api/auth/session", { token: nearAbsoluteSession.token });
  assert.ok(new Date(cappedSession.expiresAt).getTime() <= Date.now() + 65 * 60 * 1000);
  await request("/api/admin/campaigns", { token: nearAbsoluteSession.token });
  step("sessão administrativa expira definitivamente após sete dias");

  const accountUpdate = await request("/api/admin/account", {
    method: "PATCH",
    token,
    body: {
      name: "Equipe Mendes Smoke",
      email: "admin@teste.com",
      currentPassword: "123456",
      newPassword: "senha-conta-smoke-2026",
    },
  });
  assert.equal(accountUpdate.passwordChanged, true);
  assert.equal(accountUpdate.user.name, "Equipe Mendes Smoke");
  await request("/api/auth/session", { token });
  await request("/api/auth/login", {
    method: "POST",
    expected: 401,
    body: { email: "admin@teste.com", password: "123456" },
  });
  await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@teste.com", password: "senha-conta-smoke-2026" },
  });
  step("troca de conta mantém a sessão atual e invalida a senha antiga");

  const resetOutput = runNode("api/reset-password.mjs", ["admin@teste.com"]);
  const tokenMatch = resetOutput.match(/[?&]token=([^\s&]+)/);
  assert.ok(tokenMatch, "O comando de recuperação não devolveu um token.");
  const resetToken = decodeURIComponent(tokenMatch[1]);
  const resetAccount = await request(`/api/auth/password/reset?token=${encodeURIComponent(resetToken)}`);
  assert.equal(resetAccount.email, "admin@teste.com");
  await request("/api/auth/password/reset", {
    method: "POST",
    body: { token: resetToken, password: "senha-smoke-2026" },
  });
  await request("/api/auth/password/reset", {
    method: "POST",
    expected: 410,
    body: { token: resetToken, password: "outra-senha-smoke" },
  });
  await request("/api/auth/session", { token, expected: 401 });
  await request("/api/auth/login", {
    method: "POST",
    expected: 401,
    body: { email: "admin@teste.com", password: "senha-conta-smoke-2026" },
  });
  await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@teste.com", password: "senha-smoke-2026" },
  });
  step("redefinição usa token único, troca a senha e encerra sessões antigas");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await request("/api/auth/login", {
      method: "POST",
      expected: 401,
      headers: { "X-Forwarded-For": `203.0.113.${attempt + 1}, 198.51.100.10` },
      body: { email: "admin@teste.com", password: "senha-incorreta" },
    });
  }
  await request("/api/auth/login", {
    method: "POST",
    expected: 429,
    headers: { "X-Forwarded-For": "203.0.113.250, 198.51.100.10" },
    body: { email: "admin@teste.com", password: "senha-incorreta" },
  });
  await request("/api/auth/login", {
    method: "POST",
    headers: { "X-Forwarded-For": "198.51.100.11" },
    body: { email: "admin@teste.com", password: "senha-smoke-2026" },
  });
  step("login limita o cliente real atrás do proxy sem bloquear outro endereço");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await request("/api/orders", {
      method: "POST",
      expected: 422,
      headers: {
        "Idempotency-Key": randomUUID(),
        "X-Forwarded-For": `203.0.113.${attempt + 1}, 198.51.100.20`,
      },
      body: {},
    });
  }
  await request("/api/orders", {
    method: "POST",
    expected: 429,
    headers: {
      "Idempotency-Key": randomUUID(),
      "X-Forwarded-For": "203.0.113.250, 198.51.100.20",
    },
    body: {},
  });
  const customAllowedSize = customCampaign.sizes.find((size) => size.model.code === customVariant.model.code);
  assert.ok(customAllowedSize);
  await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: {
      "Idempotency-Key": randomUUID(),
      "X-Forwarded-For": "198.51.100.21",
    },
    body: {
      campaignCode: customCampaign.code,
      customer: { name: "Cliente após limite", whatsapp: "5598999991021", email: "limite@example.com" },
      items: [{ variantId: customVariant.id, size: customAllowedSize.code, quantity: 1 }],
    },
  });
  step("criação pública de pedidos limita abuso sem bloquear outro cliente");

  console.log("\nSmoke test operacional concluído com sucesso.");
} catch (error) {
  console.error(api.output());
  throw error;
} finally {
  await stopApi(api.child);
  providerApi.close();
  await once(providerApi, "close");
}
