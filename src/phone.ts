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

export function formattedWhatsapp(value: string | null | undefined): string {
  const digits = localWhatsapp(value);
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return digits || "Não informado";
}
