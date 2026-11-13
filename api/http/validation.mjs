import { parseWhatsapp } from "../phone.mjs";
import { ApiError } from "./response.mjs";

export function requireText(value, field, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength) {
    throw new ApiError(422, "VALIDATION_ERROR", `O campo ${field} é obrigatório e deve ter até ${maxLength} caracteres.`);
  }
  return text;
}

export function normalizeHexColor(value, field) {
  const hex = requireText(value, field, 7).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) {
    throw new ApiError(422, "VALIDATION_ERROR", `O campo ${field} precisa usar o formato #RRGGBB.`);
  }
  return hex;
}

export function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (text.length > maxLength) throw new ApiError(422, "VALIDATION_ERROR", `Um campo opcional excede ${maxLength} caracteres.`);
  return text || null;
}

/**
 * Toda entrada de WhatsApp passa por aqui, para gravar e para consultar, e sai no
 * formato canônico de `phone.mjs`. É o que garante que o cliente encontre o próprio
 * pedido tendo digitado com ou sem o código do país, nas duas telas.
 *
 * O motivo da recusa vai junto: "tem dígitos demais" e "não existe o DDD 10" dizem ao
 * cliente o que corrigir, enquanto um "número inválido" genérico o deixa adivinhando.
 */
export function normalizeWhatsapp(value, field = "customer.whatsapp") {
  const { canonical, error } = parseWhatsapp(requireText(value, field, 30));
  if (!canonical) throw new ApiError(422, "VALIDATION_ERROR", error);
  return canonical;
}

export function parsePositiveInteger(value, field, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ApiError(422, "VALIDATION_ERROR", `O campo ${field} precisa ser um número inteiro válido.`);
  }
  return parsed;
}
