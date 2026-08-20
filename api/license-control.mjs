import { config } from "./config.mjs";
import { pool, withTransaction } from "./database.mjs";
import { LicenseTokenError, parseLicensePublicKey, verifyLicenseCommand } from "./license-token.mjs";

const cacheLifetimeMs = 2000;
let cachedState = null;
let cachedUntil = 0;
let configuredPublicKey = null;

export class LicenseControlError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function licenseConfigurationErrors() {
  if (!config.license.controlEnabled) return [];
  const errors = [];
  try {
    if (!config.license.installationId) throw new Error("missing");
    // A validação completa também limita tamanho e caracteres.
    verifyInstallationConfiguration();
  } catch {
    errors.push("LICENSE_INSTALLATION_ID precisa identificar esta instalação com 3 a 64 caracteres válidos.");
  }
  try {
    configuredPublicKey = parseLicensePublicKey(config.license.publicKeyBase64);
  } catch {
    errors.push("LICENSE_PUBLIC_KEY_BASE64 precisa conter uma chave pública Ed25519 válida.");
  }
  return errors;
}

function verifyInstallationConfiguration() {
  const value = config.license.installationId;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(value)) throw new Error("invalid installation id");
  return value;
}

function publicKey() {
  if (!configuredPublicKey) configuredPublicKey = parseLicensePublicKey(config.license.publicKeyBase64);
  return configuredPublicKey;
}

function disabledState() {
  return { enabled: false, status: "active", changedAt: null };
}

function mapState(row) {
  return {
    enabled: true,
    status: row.status,
    changedAt: row.changed_at ? new Date(row.changed_at).toISOString() : null,
  };
}

async function ensureState(connection) {
  const installationId = verifyInstallationConfiguration();
  await connection.execute(
    `INSERT IGNORE INTO license_state (id, installation_id, status)
     VALUES (1, ?, 'active')`,
    [installationId],
  );
  const [rows] = await connection.execute(
    "SELECT installation_id, status, changed_at FROM license_state WHERE id = 1 LIMIT 1",
  );
  if (rows.length !== 1) {
    throw new LicenseControlError(503, "LICENSE_STATE_UNAVAILABLE", "O estado da licença não está disponível.");
  }
  if (rows[0].installation_id !== installationId) {
    throw new LicenseControlError(
      503,
      "LICENSE_INSTALLATION_MISMATCH",
      "A identidade configurada não corresponde à instalação registrada no banco.",
    );
  }
  return rows[0];
}

export async function getLicenseState({ fresh = false } = {}) {
  if (!config.license.controlEnabled) return disabledState();
  const now = Date.now();
  if (!fresh && cachedState && cachedUntil > now) return cachedState;
  const row = await ensureState(pool);
  cachedState = mapState(row);
  cachedUntil = now + cacheLifetimeMs;
  return cachedState;
}

export async function applyLicenseCommand(token) {
  if (!config.license.controlEnabled) {
    throw new LicenseControlError(404, "LICENSE_CONTROL_DISABLED", "O controle de licença não está habilitado.");
  }
  const command = verifyLicenseCommand(token, {
    publicKey: publicKey(),
    installationId: verifyInstallationConfiguration(),
  });
  const result = await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT IGNORE INTO license_state (id, installation_id, status)
       VALUES (1, ?, 'active')`,
      [command.installationId],
    );
    const [stateRows] = await connection.execute(
      "SELECT installation_id, status FROM license_state WHERE id = 1 LIMIT 1 FOR UPDATE",
    );
    if (stateRows.length !== 1 || stateRows[0].installation_id !== command.installationId) {
      throw new LicenseControlError(503, "LICENSE_INSTALLATION_MISMATCH", "A identidade da instalação não corresponde ao banco.");
    }
    const [usedRows] = await connection.execute(
      "SELECT id FROM license_state_history WHERE command_id = ? LIMIT 1",
      [command.commandId],
    );
    if (usedRows.length > 0) {
      throw new LicenseControlError(409, "LICENSE_COMMAND_REPLAYED", "Este código de licença já foi utilizado.");
    }

    const previousStatus = stateRows[0].status;
    const nextStatus = command.action === "suspend" ? "suspended" : "active";
    await connection.execute(
      `UPDATE license_state
          SET status = ?, reason = ?, command_id = ?, changed_at = CURRENT_TIMESTAMP(3)
        WHERE id = 1`,
      [nextStatus, command.reason, command.commandId],
    );
    await connection.execute(
      `INSERT INTO license_state_history
         (installation_id, command_id, action, previous_status, next_status, reason, issued_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        command.installationId,
        command.commandId,
        command.action,
        previousStatus,
        nextStatus,
        command.reason,
        command.issuedAt,
        command.expiresAt,
      ],
    );
    return { status: nextStatus, changed: nextStatus !== previousStatus };
  });

  cachedState = { enabled: true, status: result.status, changedAt: new Date().toISOString() };
  cachedUntil = Date.now() + cacheLifetimeMs;
  return cachedState;
}

export { LicenseTokenError };

