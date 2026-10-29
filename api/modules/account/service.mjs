import * as queries from './repository.mjs';
import { applyNewPassword, createPasswordResetToken, createSession, findActiveUserByEmail, minimumPasswordLength, normalizeEmail, resolvePasswordResetToken, verifyPassword } from "../../auth.mjs";
import { config } from "../../config.mjs";
import { withTransaction } from "../../database.mjs";
import { mailerConfigured, sendMail } from "../../mailer.mjs";
import { rateLimitEntries } from "../../runtime/constants.mjs";
import { ApiError } from "../../http/response.mjs";
import { requireText } from "../../http/validation.mjs";
import { loginWindowMs, maxLoginAttempts, registerRateLimitedAttempt, assertRateLimitAllowed } from "../../http/rate-limit.mjs";

export async function login({ body, requestAddress }) {
  const email = normalizeEmail(body.email);
  const password = requireText(body.password, "password", 200);
  const attemptKey = `login:${requestAddress}:${email}`;
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

export function assertStrongEnoughPassword(password) {
  if (password.length < minimumPasswordLength) {
    throw new ApiError(422, "WEAK_PASSWORD", `A senha precisa ter ao menos ${minimumPasswordLength} caracteres.`);
  }
}

/**
 * Conta da equipe. O e-mail e a senha do cadastro inicial são provisórios; esta rota
 * é o caminho para trocá-los sem passar por linha de comando. A senha atual é exigida
 * mesmo já havendo sessão: sessão aberta em máquina alheia não deve virar troca de dono.
 */
/** @param {{current:object, body:import("../../../shared/contracts").AccountUpdate, sessionToken:string}} input Validated at the HTTP/service boundary. */
export async function updateAccount({ current, body, sessionToken }) {
  const currentPassword = requireText(body.currentPassword, "currentPassword", 200);
  const newPassword = body.newPassword ? String(body.newPassword) : "";
  if (newPassword) assertStrongEnoughPassword(newPassword);

  return withTransaction(async (connection) => {
    const [users] = await queries.updateAccountQuery1(connection, [current.id]);
    const user = users[0];
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "A senha atual está incorreta.");
    }
    const name = body.name === undefined ? user.name : requireText(body.name, "name", 160);
    const email = body.email === undefined ? user.email : normalizeEmail(body.email);
    if (!email) throw new ApiError(422, "INVALID_EMAIL", "Informe um e-mail válido.");
    if (email !== user.email) {
      const [taken] = await queries.updateAccountQuery2(connection, [email, user.id]);
      if (taken.length > 0) throw new ApiError(409, "EMAIL_IN_USE", "Já existe uma conta com esse e-mail.");
    }
    await queries.updateAccountQuery3(connection, [name, email, user.id]);
    if (newPassword) {
      // A sessão de quem está trocando continua válida; as demais caem no mesmo commit.
      await applyNewPassword(user.id, newPassword, {
        keepSessionToken: sessionToken,
        connection,
      });
    }
    return {
      user: { name, email, role: user.role, mustChangePassword: newPassword ? false : Boolean(user.must_change_password) },
      passwordChanged: Boolean(newPassword),
    };
  });
}

export function resetLink(token) {
  return `${config.publicAppUrl}/?rota=redefinir-senha&token=${encodeURIComponent(token)}`;
}

/**
 * Recuperação de senha. A resposta é sempre a mesma para e-mail existente ou não —
 * dizer "esse e-mail não está cadastrado" entregaria quem tem acesso ao painel.
 * Sem SMTP configurado a API diz isso abertamente, em vez de fingir que enviou.
 */
export async function requestPasswordReset({ body, requestAddress }) {
  const email = normalizeEmail(body.email);
  const attemptKey = `reset:${requestAddress}`;
  assertRateLimitAllowed(attemptKey, maxLoginAttempts, loginWindowMs, "Muitas tentativas de recuperação. Aguarde alguns minutos.");
  registerRateLimitedAttempt(attemptKey, loginWindowMs);

  const configured = mailerConfigured();
  const user = email ? await findActiveUserByEmail(email) : null;
  if (!user) return { delivery: configured ? "email" : "unavailable" };

  const { token, expiresInMinutes } = await createPasswordResetToken(user.id, requestAddress);
  const link = resetLink(token);
  if (!configured) {
    console.warn("Recuperação de senha indisponível: SMTP não configurado.");
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
    console.error("Falha ao enviar o e-mail de redefinição:", { code: error.code ?? "SMTP_ERROR" });
    throw new ApiError(502, "EMAIL_NOT_SENT", "Não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde.");
  }
  return { delivery: "email" };
}

export async function confirmPasswordReset({ body }) {
  const token = requireText(body.token, "token", 200);
  const password = requireText(body.password, "password", 200);
  assertStrongEnoughPassword(password);
  const reset = await resolvePasswordResetToken(token);
  if (!reset) throw new ApiError(410, "RESET_TOKEN_INVALID", "Este link de redefinição expirou ou já foi usado.");
  const applied = await applyNewPassword(reset.user_id, password, { tokenId: reset.id });
  if (!applied) throw new ApiError(410, "RESET_TOKEN_INVALID", "Este link de redefinição expirou ou já foi usado.");
  return { email: reset.email };
}
