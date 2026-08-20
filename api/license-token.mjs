import { createPrivateKey, createPublicKey, randomUUID, sign, verify } from "node:crypto";

const tokenPrefix = "LC1";
const maximumTokenLength = 8192;
const maximumCommandLifetimeMs = 24 * 60 * 60 * 1000;
const maximumFutureSkewMs = 5 * 60 * 1000;
const installationPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
const commandIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class LicenseTokenError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function assertValidInstallationId(value) {
  const installationId = String(value ?? "").trim();
  if (!installationPattern.test(installationId)) {
    throw new LicenseTokenError(
      422,
      "LICENSE_INSTALLATION_INVALID",
      "A instalação precisa ter de 3 a 64 caracteres: letras, números, ponto, hífen ou sublinhado.",
    );
  }
  return installationId;
}

function assertEd25519Key(key, label) {
  if (key.asymmetricKeyType !== "ed25519") {
    throw new LicenseTokenError(500, "LICENSE_KEY_INVALID", `${label} precisa ser uma chave Ed25519.`);
  }
  return key;
}

export function parseLicensePublicKey(base64Value) {
  const value = String(base64Value ?? "").trim();
  if (!value || value.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new LicenseTokenError(500, "LICENSE_KEY_INVALID", "A chave pública de licença não está configurada corretamente.");
  }
  try {
    const key = createPublicKey({ key: Buffer.from(value, "base64"), format: "der", type: "spki" });
    return assertEd25519Key(key, "A chave pública de licença");
  } catch (error) {
    if (error instanceof LicenseTokenError) throw error;
    throw new LicenseTokenError(500, "LICENSE_KEY_INVALID", "A chave pública de licença não está configurada corretamente.");
  }
}

function parsePrivateKey(value) {
  try {
    return assertEd25519Key(createPrivateKey(value), "A chave privada de licença");
  } catch (error) {
    if (error instanceof LicenseTokenError) throw error;
    throw new LicenseTokenError(500, "LICENSE_PRIVATE_KEY_INVALID", "A chave privada de licença é inválida.");
  }
}

function normalizeAction(value) {
  const action = String(value ?? "").trim().toLowerCase();
  if (!new Set(["suspend", "activate"]).has(action)) {
    throw new LicenseTokenError(422, "LICENSE_ACTION_INVALID", "A ação precisa ser suspend ou activate.");
  }
  return action;
}

function normalizeReason(value, action) {
  const reason = String(value ?? "").trim();
  if (reason.length > 240) {
    throw new LicenseTokenError(422, "LICENSE_REASON_INVALID", "O motivo precisa ter até 240 caracteres.");
  }
  if (action === "suspend" && !reason) {
    throw new LicenseTokenError(422, "LICENSE_REASON_REQUIRED", "Informe o motivo contratual da suspensão.");
  }
  return reason || "Licença reativada pelo fornecedor.";
}

function dateFrom(value, code, message) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new LicenseTokenError(422, code, message);
  return date;
}

export function createLicenseCommand({
  privateKey,
  installationId,
  action,
  reason,
  issuedAt = new Date(),
  expiresAt,
  lifetimeMs = 15 * 60 * 1000,
  commandId = randomUUID(),
}) {
  const normalizedInstallation = assertValidInstallationId(installationId);
  const normalizedAction = normalizeAction(action);
  const normalizedReason = normalizeReason(reason, normalizedAction);
  const issued = dateFrom(issuedAt, "LICENSE_ISSUED_AT_INVALID", "A data de emissão do comando é inválida.");
  const expiry = expiresAt
    ? dateFrom(expiresAt, "LICENSE_EXPIRES_AT_INVALID", "A data de expiração do comando é inválida.")
    : new Date(issued.getTime() + Number(lifetimeMs));
  const lifetime = expiry.getTime() - issued.getTime();
  if (!Number.isFinite(lifetime) || lifetime < 60_000 || lifetime > maximumCommandLifetimeMs) {
    throw new LicenseTokenError(422, "LICENSE_LIFETIME_INVALID", "O comando precisa valer entre 1 minuto e 24 horas.");
  }
  if (!commandIdPattern.test(String(commandId))) {
    throw new LicenseTokenError(422, "LICENSE_COMMAND_ID_INVALID", "O identificador do comando é inválido.");
  }

  const payload = {
    v: 1,
    installationId: normalizedInstallation,
    action: normalizedAction,
    reason: normalizedReason,
    commandId: String(commandId).toLowerCase(),
    issuedAt: issued.toISOString(),
    expiresAt: expiry.toISOString(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signingInput = `${tokenPrefix}.${encodedPayload}`;
  const signature = sign(null, Buffer.from(signingInput, "ascii"), parsePrivateKey(privateKey));
  return `${signingInput}.${signature.toString("base64url")}`;
}

export function verifyLicenseCommand(token, { publicKey, installationId, now = new Date() }) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken || normalizedToken.length > maximumTokenLength) {
    throw new LicenseTokenError(401, "LICENSE_COMMAND_INVALID", "O código de licença é inválido.");
  }
  const parts = normalizedToken.split(".");
  if (parts.length !== 3 || parts[0] !== tokenPrefix || !parts[1] || !parts[2]) {
    throw new LicenseTokenError(401, "LICENSE_COMMAND_INVALID", "O código de licença é inválido.");
  }

  let payload;
  let signature;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    signature = Buffer.from(parts[2], "base64url");
  } catch {
    throw new LicenseTokenError(401, "LICENSE_COMMAND_INVALID", "O código de licença é inválido.");
  }
  const signingInput = `${tokenPrefix}.${parts[1]}`;
  if (signature.length !== 64 || !verify(null, Buffer.from(signingInput, "ascii"), publicKey, signature)) {
    throw new LicenseTokenError(401, "LICENSE_COMMAND_INVALID", "A assinatura do código de licença é inválida.");
  }

  if (!payload || payload.v !== 1) {
    throw new LicenseTokenError(422, "LICENSE_COMMAND_VERSION_UNSUPPORTED", "A versão do código de licença não é suportada.");
  }
  const expectedInstallation = assertValidInstallationId(installationId);
  const commandInstallation = assertValidInstallationId(payload.installationId);
  if (commandInstallation !== expectedInstallation) {
    throw new LicenseTokenError(403, "LICENSE_INSTALLATION_MISMATCH", "O código pertence a outra instalação.");
  }
  const action = normalizeAction(payload.action);
  const reason = normalizeReason(payload.reason, action);
  if (!commandIdPattern.test(String(payload.commandId ?? ""))) {
    throw new LicenseTokenError(422, "LICENSE_COMMAND_ID_INVALID", "O identificador do comando é inválido.");
  }
  const issued = dateFrom(payload.issuedAt, "LICENSE_ISSUED_AT_INVALID", "A data de emissão do código é inválida.");
  const expiry = dateFrom(payload.expiresAt, "LICENSE_EXPIRES_AT_INVALID", "A data de expiração do código é inválida.");
  const current = dateFrom(now, "LICENSE_CLOCK_INVALID", "O relógio do servidor é inválido.");
  const lifetime = expiry.getTime() - issued.getTime();
  if (lifetime < 60_000 || lifetime > maximumCommandLifetimeMs) {
    throw new LicenseTokenError(422, "LICENSE_LIFETIME_INVALID", "O período de validade do código é inválido.");
  }
  if (issued.getTime() > current.getTime() + maximumFutureSkewMs) {
    throw new LicenseTokenError(422, "LICENSE_COMMAND_NOT_YET_VALID", "O código ainda não é válido; confira o relógio do servidor.");
  }
  if (expiry.getTime() <= current.getTime()) {
    throw new LicenseTokenError(410, "LICENSE_COMMAND_EXPIRED", "O código de licença expirou.");
  }
  return {
    installationId: commandInstallation,
    action,
    reason,
    commandId: String(payload.commandId).toLowerCase(),
    issuedAt: issued,
    expiresAt: expiry,
  };
}

