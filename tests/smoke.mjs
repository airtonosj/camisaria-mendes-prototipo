import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import mysql from "mysql2/promise";
import { resetTestDatabase } from "./reset-test-database.mjs";
import { projectDirectory, testEnvironment } from "./test-environment.mjs";

const environment = testEnvironment();
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
      ADMIN_API_TOKEN_ENABLED: "true",
      ADMIN_API_TOKEN: "curta",
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
  for (const expected of ["PUBLIC_APP_URL", "ADMIN_API_TOKEN", "TRUST_PROXY", "ADMIN_INITIAL_PASSWORD", "SMTP_HOST", "DB_USER", "UPLOADS_DIR", "PAYMENT_PROVIDER", "INFINITEPAY_HANDLE", "INFINITEPAY_CHECKOUT_ENABLED"]) {
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
      fakeInfinitePay.links.push(body);
      response.end(JSON.stringify({
        url: `https://checkout.infinitepay.com.br/smoke-infinitepay?lenc=${encodeURIComponent(body.order_nsu)}`,
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
  assert.equal(health.schema.current, "008_infinitepay_checkout");
  assert.equal(health.storage.ready, true);
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
  step("login e sessão da camisaria");

  const customCampaignPayload = {
    code: "MENDES-CORES-26",
    title: "Campanha com cor personalizada",
    subtitle: "Validação da paleta por HEX",
    deadlineAt: "2027-12-31T23:59:59.000Z",
    pickupInstructions: "Retirada com a representante",
    representative: { name: "Representante das Cores", whatsapp: "5598999992000" },
    artFrontUrl: "/uploads/smoke-custom-color.png",
    models: [
      { modelCode: "common", unitPriceCents: 5990, colors: [{ name: "Lilás lavanda", hex: "#8B5CF6" }], sizes: ["P", "M"] },
      { modelCode: "oversized", unitPriceCents: 6990, colors: [{ name: "Preto", hex: "#111315" }], sizes: ["M", "G"] },
    ],
  };
  await request("/api/admin/campaigns", { method: "POST", expected: 201, token, body: customCampaignPayload });
  const customCampaign = (await request("/api/campaigns/MENDES-CORES-26")).campaign;
  const customVariant = customCampaign.variants.find((candidate) => candidate.color.name === "Lilás lavanda");
  assert.ok(customVariant);
  assert.equal(customVariant.color.hex, "#8B5CF6");
  step("campanha aceita e publica cor personalizada com nome e código HEX");

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
  assert.ok(variant && allowedSize);
  step("campanha pública carrega variantes e tamanhos persistidos");

  const firstKey = randomUUID();
  const firstOrderBody = {
    campaignCode: campaign.code,
    customer: { name: "Cliente Smoke Pago", whatsapp: "5598999991001", email: "pago@example.com" },
    items: [{ variantId: variant.id, size: allowedSize.code, quantity: 2 }],
  };
  await request("/api/orders", {
    method: "POST",
    expected: 422,
    headers: { "Idempotency-Key": randomUUID() },
    body: { ...firstOrderBody, customer: { ...firstOrderBody.customer, email: "email-invalido" } },
  });
  step("API recusa e-mail inválido antes de registrar o pedido");

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

  const pendingTracking = await request(`/api/orders/${firstCreated.order.number}?whatsapp=5598999991001`);
  assert.equal(pendingTracking.order.status, "pending");
  let production = await request(`/api/admin/reports/production?campaign=${campaign.code}`, { token });
  assert.equal(production.rows.length, 0);
  step("pedido pendente fica fora do relatório oficial");

  await request(`/api/admin/orders/${firstCreated.order.number}/payment`, {
    method: "PATCH",
    token,
    expected: 404,
    body: { status: "paid", note: "Confirmação do smoke test" },
  });
  const stillPending = await request(`/api/orders/${firstCreated.order.number}?whatsapp=5598999991001`);
  assert.equal(stillPending.order.status, "pending");
  step("painel e API não oferecem confirmação manual de pagamento");

  const checkout = await request(`/api/orders/${firstCreated.order.number}/checkout`, {
    method: "POST",
    body: { whatsapp: "5598999991001" },
  });
  assert.match(checkout.checkout.url, /^https:\/\/checkout\.infinitepay\.com\.br\//);
  assert.equal(fakeInfinitePay.links.length, 1);
  assert.equal(fakeInfinitePay.links[0].handle, "smoke-infinitepay");
  assert.equal(fakeInfinitePay.links[0].order_nsu, firstCreated.order.number);
  assert.equal(fakeInfinitePay.links[0].items.reduce((sum, item) => sum + item.price * item.quantity, 0), firstCreated.order.totalCents);
  assert.match(fakeInfinitePay.links[0].webhook_url, /\/api\/payments\/infinitepay\/webhook$/);
  const checkoutReplay = await request(`/api/orders/${firstCreated.order.number}/checkout`, {
    method: "POST",
    body: { whatsapp: "5598999991001" },
  });
  assert.equal(checkoutReplay.checkout.reused, true);
  assert.equal(fakeInfinitePay.links.length, 1);
  step("checkout InfinitePay usa handle, pedido e valor persistidos sem duplicar link");

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
  await waitForOrderStatus(firstCreated.order.number, "5598999991001", "confirmed");
  assert.equal(fakeInfinitePay.checkRequests.length, 1);
  assert.equal(fakeInfinitePay.checkRequests[0].order_nsu, firstCreated.order.number);
  assert.equal(fakeInfinitePay.checkRequests[0].transaction_nsu, transactionNsu);
  step("webhook e retorno do navegador reconciliam por payment_check de forma idempotente");

  const confirmationEmail = await deliverQueuedPaymentEmailForTest(firstCreated.order.number);
  assert.equal(confirmationEmail.to, "pago@example.com");
  assert.match(confirmationEmail.subject, new RegExp(firstCreated.order.number));
  assert.match(confirmationEmail.text, new RegExp(`Código da compra: ${firstCreated.order.number}`));
  assert.match(confirmationEmail.text, /rota=acompanhar-pedido/);
  assert.match(confirmationEmail.text, new RegExp(`pedido=${firstCreated.order.number}`));
  step("pagamento confirmado agenda e entrega um único e-mail com código e link de acompanhamento");

  production = await request(`/api/admin/reports/production?campaign=${campaign.code}`, { token });
  assert.equal(production.rows.reduce((total, row) => total + row.quantity, 0), 2);
  step("confirmação validada do provedor inclui somente o pedido pago na produção");

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
  assert.equal(production.rows.reduce((total, row) => total + row.quantity, 0), 2);
  step("payment_check com valor divergente não confirma nem inclui o pedido na produção");

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
  await request(`/api/admin/orders/${secondCreated.order.number}/cancel`, {
    method: "PATCH",
    token,
    body: { reason: "Pedido duplicado no smoke test" },
  });
  const cancelledTracking = await request(`/api/orders/${secondCreated.order.number}?whatsapp=5598999991002`);
  assert.equal(cancelledTracking.order.status, "cancelled");
  assert.equal(cancelledTracking.order.cancellationReason, "Pedido duplicado no smoke test");
  production = await request(`/api/admin/reports/production?campaign=${campaign.code}`, { token });
  assert.equal(production.rows.reduce((total, row) => total + row.quantity, 0), 2);
  step("cancelamento exige motivo, continua consultável e não altera produção");

  for (const targetPhase of ["orders_closed", "production", "ready_for_delivery"]) {
    await request(`/api/admin/campaigns/${campaign.code}/phase`, {
      method: "PATCH",
      token,
      body: { targetPhase },
    });
  }
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
  await request(`/api/admin/campaigns/${campaign.code}/phase`, {
    method: "PATCH",
    token,
    body: { targetPhase: "ready_for_delivery" },
  });
  step("campanha avança uma etapa e retorno exige motivo");

  await request(`/api/admin/orders/${firstCreated.order.number}/delivery`, {
    method: "PATCH",
    token,
    body: { status: "delivered", note: "Entrega do smoke test" },
  });
  const deliveredTracking = await request(`/api/orders/${firstCreated.order.number}?whatsapp=5598999991001`);
  assert.equal(deliveredTracking.order.status, "delivered");
  const delivery = await request(`/api/admin/reports/delivery?campaign=${campaign.code}`, { token });
  assert.equal(delivery.rows.every((row) => row.orderNumber === firstCreated.order.number), true);
  step("pedido pago percorre produção, retirada e entrega");

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
