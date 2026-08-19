/**
 * O WhatsApp é gravado no formato canônico, com o código do país (ver `api/phone.mjs`).
 * Na tela, a camisaria lê e copia o número como ele é falado e escrito por aqui: DDD +
 * número, sem o 55 na frente. A gravação continua canônica; isto é só exibição.
 */
export function localWhatsapp(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits.slice(2);
  return digits;
}
