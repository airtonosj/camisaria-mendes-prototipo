import { config } from "../config.mjs";
import { rateLimitEntries } from "../runtime/constants.mjs";
import { ApiError } from "./response.mjs";

export const maxRateLimitEntries = 10_000;

export const loginWindowMs = 10 * 60 * 1000;

export const maxLoginAttempts = 8;

export const orderWindowMs = 10 * 60 * 1000;

export const maxOrderAttempts = 20;

export const paymentEventWindowMs = 10 * 60 * 1000;

export const maxPaymentEventAttempts = 120;

export const licenseControlWindowMs = 10 * 60 * 1000;

export const maxLicenseControlAttempts = 8;

export function clientAddress(request) {
  const socketAddress = String(request.socket.remoteAddress ?? "desconhecido").slice(0, 64);
  if (!config.trustProxy) return socketAddress;

  // O proxy confiável acrescenta o endereço real ao fim de X-Forwarded-For. Usar o
  // último valor impede o cliente de escapar do limite adicionando valores à esquerda.
  const forwarded = String(request.headers["x-forwarded-for"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const proxyAddress = forwarded.at(-1) || String(request.headers["x-real-ip"] ?? "").trim();
  return (proxyAddress || socketAddress).slice(0, 64);
}

export function pruneRateLimits(now) {
  if (rateLimitEntries.size < maxRateLimitEntries) return;
  for (const [key, entry] of rateLimitEntries) {
    if (entry.resetAt <= now) rateLimitEntries.delete(key);
  }
  if (rateLimitEntries.size >= maxRateLimitEntries) {
    const oldestKey = rateLimitEntries.keys().next().value;
    if (oldestKey !== undefined) rateLimitEntries.delete(oldestKey);
  }
}

export function rateLimitEntry(key, windowMs) {
  const now = Date.now();
  let entry = rateLimitEntries.get(key);
  if (!entry || entry.resetAt <= now) {
    pruneRateLimits(now);
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitEntries.set(key, entry);
  }
  return entry;
}

export function registerRateLimitedAttempt(key, windowMs) {
  rateLimitEntry(key, windowMs).count += 1;
}

export function assertRateLimitAllowed(key, limit, windowMs, message) {
  if (rateLimitEntry(key, windowMs).count >= limit) {
    throw new ApiError(429, "TOO_MANY_ATTEMPTS", message);
  }
}
