import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { pool } from "./database.mjs";

const scryptParameters = { N: 16384, r: 8, p: 1 };
const keyLength = 64;
const sessionHours = 12;
const absoluteSessionDays = 7;
const resetTokenMinutes = 60;

export const minimumPasswordLength = 8;

/**
 * Aceita `nome@dominio` sem exigir ponto: o cadastro inicial da camisaria usa
 * `gustavo@mendes`, que é válido para o `input type="email"` do navegador. O que
 * não pode passar é espaço, arroba duplicada ou campo vazio.
 */
export function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(email) && email.length <= 254 ? email : "";
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, keyLength, scryptParameters).toString("hex");
  return `scrypt$${scryptParameters.N}$${salt}$${key}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number.parseInt(parts[1], 10);
  if (!Number.isSafeInteger(cost) || cost < 1024) return false;
  const expected = Buffer.from(parts[3], "hex");
  if (expected.length !== keyLength) return false;
  const received = scryptSync(password, parts[2], keyLength, { ...scryptParameters, N: cost });
  return timingSafeEqual(expected, received);
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  await pool.execute(
    `INSERT INTO staff_sessions (token_hash, user_id, expires_at)
     VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${sessionHours} HOUR))`,
    [tokenHash(token), userId],
  );
  // Aproveita o login para limpar sessões vencidas, dispensando rotina agendada.
  await pool.execute(
    `DELETE FROM staff_sessions
      WHERE expires_at < CURRENT_TIMESTAMP(3)
         OR created_at <= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL ${absoluteSessionDays} DAY)`,
  );
  return { token, expiresAt: new Date(Date.now() + sessionHours * 60 * 60 * 1000) };
}

export async function resolveSession(token) {
  if (!token) return null;
  const [rows] = await pool.execute(
    `SELECT s.id,
            TIMESTAMPDIFF(MICROSECOND, CURRENT_TIMESTAMP(3), s.expires_at) / 1000 AS idle_remaining_ms,
            TIMESTAMPDIFF(
              MICROSECOND,
              CURRENT_TIMESTAMP(3),
              DATE_ADD(s.created_at, INTERVAL ${absoluteSessionDays} DAY)
            ) / 1000 AS absolute_remaining_ms,
            u.id AS user_id, u.name, u.email, u.role, u.must_change_password
       FROM staff_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.expires_at > CURRENT_TIMESTAMP(3)
        AND s.created_at > DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL ${absoluteSessionDays} DAY)
        AND u.active = TRUE
      LIMIT 1`,
    [tokenHash(token)],
  );
  if (rows.length === 0) return null;
  const session = rows[0];

  /**
   * Sessão deslizante: quem está usando o painel não deve ser deslogado no meio do
   * turno. O prazo é renovado quando falta menos da metade dele, e não a cada
   * requisição, para não escrever no banco a toda chamada de uma tela que atualiza
   * sozinha. Quem parar de usar continua expirando no prazo normal.
   */
  const sessionMs = sessionHours * 60 * 60 * 1000;
  const absoluteRemainingMs = Number(session.absolute_remaining_ms);
  const idleRemainingMs = Number(session.idle_remaining_ms);
  let remainingMs = Math.min(idleRemainingMs, absoluteRemainingMs);
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    await pool.execute("DELETE FROM staff_sessions WHERE id = ?", [session.id]);
    return null;
  }
  if (remainingMs < sessionMs / 2) {
    remainingMs = Math.min(sessionMs, absoluteRemainingMs);
    await pool.execute(
      `UPDATE staff_sessions
          SET expires_at = LEAST(
                DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${sessionHours} HOUR),
                DATE_ADD(created_at, INTERVAL ${absoluteSessionDays} DAY)
              ),
              last_seen_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?`,
      [session.id],
    );
  } else if (idleRemainingMs > absoluteRemainingMs) {
    await pool.execute(
      `UPDATE staff_sessions
          SET expires_at = DATE_ADD(created_at, INTERVAL ${absoluteSessionDays} DAY),
              last_seen_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?`,
      [session.id],
    );
  } else {
    await pool.execute("UPDATE staff_sessions SET last_seen_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [session.id]);
  }

  return {
    sessionId: session.id,
    expiresAt: new Date(Date.now() + remainingMs),
    user: {
      id: session.user_id,
      name: session.name,
      email: session.email,
      role: session.role,
      mustChangePassword: Boolean(session.must_change_password),
    },
  };
}

export async function deleteSession(token) {
  if (!token) return;
  await pool.execute("DELETE FROM staff_sessions WHERE token_hash = ?", [tokenHash(token)]);
}

export async function deleteSessionsOfUser(userId, exceptToken, executor = pool) {
  if (exceptToken) {
    await executor.execute("DELETE FROM staff_sessions WHERE user_id = ? AND token_hash <> ?", [userId, tokenHash(exceptToken)]);
    return;
  }
  await executor.execute("DELETE FROM staff_sessions WHERE user_id = ?", [userId]);
}

export async function findActiveUserByEmail(email) {
  const [rows] = await pool.execute(
    "SELECT id, name, email, password_hash, role, must_change_password FROM users WHERE email = ? AND active = TRUE LIMIT 1",
    [email],
  );
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Recuperação de senha                                                */
/* ------------------------------------------------------------------ */

/**
 * O link viaja pelo e-mail; o banco guarda só o SHA-256 do token. Um token novo
 * invalida os anteriores do mesmo usuário, para um pedido repetido não deixar
 * vários links válidos circulando.
 */
export async function createPasswordResetToken(userId, requestedFrom) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + resetTokenMinutes * 60 * 1000);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at < CURRENT_TIMESTAMP(3)", [userId]);
    await connection.execute(
      "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, requested_from) VALUES (?, ?, ?, ?)",
      [tokenHash(token), userId, expiresAt, requestedFrom ? String(requestedFrom).slice(0, 64) : null],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return { token, expiresAt, expiresInMinutes: resetTokenMinutes };
}

export async function resolvePasswordResetToken(token) {
  if (!token) return null;
  const [rows] = await pool.execute(
    `SELECT t.id, t.user_id, u.name, u.email
       FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > CURRENT_TIMESTAMP(3) AND u.active = TRUE
      LIMIT 1`,
    [tokenHash(token)],
  );
  return rows[0] ?? null;
}

/**
 * Trocar a senha encerra todas as sessões abertas do usuário: se a troca foi por
 * suspeita de acesso indevido, deixar a sessão antiga viva anularia o esforço.
 */
export async function applyNewPassword(
  userId,
  password,
  { tokenId = null, keepSessionToken = null, connection: providedConnection = null } = {},
) {
  const apply = async (connection) => {
    if (tokenId) {
      const [claimed] = await connection.execute(
        `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP(3)
          WHERE id = ? AND user_id = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP(3)`,
        [tokenId, userId],
      );
      if (claimed.affectedRows !== 1) return false;
    }
    await connection.execute(
      "UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?",
      [hashPassword(password), userId],
    );
    await deleteSessionsOfUser(userId, keepSessionToken, connection);
    return true;
  };

  if (providedConnection) return apply(providedConnection);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const applied = await apply(connection);
    if (applied) await connection.commit();
    else await connection.rollback();
    return applied;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
