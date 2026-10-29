import type { StaffUser, AccountUpdate, ApiPaymentReceiver, CreateReceiverPayload, UpdateReceiverPayload } from "../../../shared/contracts";
import { request, staffToken, setStaffToken, staffRequest } from "../../lib/http";

export async function loginStaff(email: string, password: string) {
  const payload = await request<{ token: string; expiresAt: string; user: StaffUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setStaffToken(payload.token);
  return payload;
}

export async function logoutStaff() {
  try {
    if (staffToken()) await staffRequest<void>("/auth/logout", { method: "POST" });
  } catch {
    // Encerrar a sessão local é o que importa; a do servidor expira por prazo.
  } finally {
    setStaffToken(null);
  }
}

export async function fetchStaffSession() {
  const payload = await staffRequest<{ user: StaffUser; expiresAt: string }>("/auth/session");
  return payload.user;
}

export async function updateStaffAccount(input: AccountUpdate) {
  const payload = await staffRequest<{ user: StaffUser; passwordChanged: boolean }>("/admin/account", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload;
}

/**
 * A API responde igual para e-mail cadastrado ou não. `delivery` diz apenas se o
 * envio por e-mail está disponível neste servidor — nunca se a conta existe.
 */
export async function requestPasswordReset(email: string) {
  const payload = await request<{ delivery: "email" | "unavailable" }>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  }, 30000);
  return payload.delivery;
}

export async function checkPasswordResetToken(token: string) {
  return request<{ email: string; name: string }>(`/auth/password/reset?token=${encodeURIComponent(token)}`);
}

export async function confirmPasswordReset(token: string, password: string) {
  return request<{ email: string }>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function fetchPaymentReceivers() {
  const payload = await staffRequest<{ receivers: ApiPaymentReceiver[] }>("/admin/receivers");
  return payload.receivers;
}

export async function createPaymentReceiver(input: CreateReceiverPayload) {
  const payload = await staffRequest<{ receiver: ApiPaymentReceiver }>("/admin/receivers", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.receiver;
}

export async function updatePaymentReceiver(id: number, input: UpdateReceiverPayload) {
  const payload = await staffRequest<{ receiver: ApiPaymentReceiver }>(`/admin/receivers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload.receiver;
}
