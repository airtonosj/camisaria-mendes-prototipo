import { validApiResponse } from '../../shared/response-contracts.mjs';

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function apiBase() {
  // O `.env.example` traz localhost para o desenvolvimento. Em um build de produção,
  // nunca deixe esse valor ser empacotado por engano: o Nginx publica site e API na
  // mesma origem, então produção usa `/api` sem qualquer override do Vite.
  if (import.meta.env.PROD) return `${window.location.origin}/api`;
  const configured = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    return "http://127.0.0.1:3333/api";
  }
  return `${window.location.origin}/api`;
}

export async function request<T>(path: string, init?: RequestInit, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiRequestError(
        response.status,
        payload?.error?.code ?? "REQUEST_FAILED",
        payload?.error?.message ?? "Não foi possível concluir a operação.",
      );
    }
    if (!validApiResponse(path, init?.method ?? 'GET', payload)) {
      throw new ApiRequestError(502, 'INVALID_API_RESPONSE', 'O servidor retornou dados incompletos. Tente novamente.');
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(0, "API_UNAVAILABLE", "Não foi possível conectar ao servidor. Tente novamente.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export function assetUrl(value: string | null) {
  if (!value) return null;
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
  const origin = new URL(apiBase()).origin;
  return new URL(value, origin).toString();
}

/* ------------------------------------------------------------------ */
/* Sessão da equipe                                                    */
/* ------------------------------------------------------------------ */

export const STAFF_TOKEN_KEY = "camisaria-mendes-staff-token";

export function staffToken() {
  return sessionStorage.getItem(STAFF_TOKEN_KEY) ?? "";
}

export function setStaffToken(token: string | null) {
  if (token) sessionStorage.setItem(STAFF_TOKEN_KEY, token);
  else sessionStorage.removeItem(STAFF_TOKEN_KEY);
}

/** Toda rota do painel viaja com o token da sessão, nunca com a chave do servidor. */
export function staffRequest<T>(path: string, init?: RequestInit, timeoutMs?: number) {
  const token = staffToken();
  if (!token) throw new ApiRequestError(401, "NO_SESSION", "Faça login para acessar o painel.");
  return request<T>(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } }, timeoutMs);
}
