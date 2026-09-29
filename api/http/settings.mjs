import { randomUUID } from "node:crypto";
import { config } from "../config.mjs";

/** Estado público do checkout. Nenhuma credencial ou identificador da conta é exposto. */
export function publicSettings() {
  return {
    payment: {
      provider: config.payments.provider,
      checkoutEnabled: config.payments.infinitePay.checkoutEnabled,
      methods: ["pix", "credit_card"],
    },
  };
}

export function publicOrderNumber() {
  const year = new Date().getUTCFullYear();
  return `CM-${year}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}
