import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
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
  for (const expected of ["PUBLIC_APP_URL", "ADMIN_API_TOKEN", "SMTP_HOST", "DB_USER", "UPLOADS_DIR", "PAYMENT_PROVIDER", "INFINITEPAY_HANDLE", "INFINITEPAY_CHECKOUT_ENABLED"]) {
    assert.match(output, new RegExp(expected), `A recusa de produção não mencionou ${expected}.`);
  }
}

/**
 * O webhook ainda não foi implementado. Este helper de teste representa a única
 * transição que futuramente poderá marcar o pedido como pago, sem reabrir uma rota
 * administrativa de confirmação manual.
 */
async function recordProviderPaymentForTest(orderNumber) {
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
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT id, total_cents FROM orders WHERE order_number = ? LIMIT 1 FOR UPDATE",
      [orderNumber],
    );
    assert.equal(rows.length, 1);
    await connection.execute(
      "UPDATE orders SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [rows[0].id],
    );
    await connection.execute(
      `INSERT INTO payments
        (order_id, provider, provider_order_id, provider_transaction_id, status, amount_cents, confirmed_at)
       VALUES (?, 'infinitepay', ?, ?, 'paid', ?, CURRENT_TIMESTAMP(3))`,
      [rows[0].id, orderNumber, `smoke-${randomUUID()}`, rows[0].total_cents],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
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

const api = startApi();
try {
  const health = await waitForApi(api.child);
  assert.equal(health.schema.ready, true);
  assert.equal(health.schema.current, "006_custom_campaign_colors");
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

  await recordProviderPaymentForTest(firstCreated.order.number);
  production = await request(`/api/admin/reports/production?campaign=${campaign.code}`, { token });
  assert.equal(production.rows.reduce((total, row) => total + row.quantity, 0), 2);
  step("confirmação simulada do provedor inclui somente o pedido pago na produção");

  const secondCreated = await request("/api/orders", {
    method: "POST",
    expected: 201,
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      campaignCode: campaign.code,
      customer: { name: "Cliente Smoke Cancelado", whatsapp: "5598999991002" },
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

  console.log("\nSmoke test operacional concluído com sucesso.");
} catch (error) {
  console.error(api.output());
  throw error;
} finally {
  await stopApi(api.child);
}
