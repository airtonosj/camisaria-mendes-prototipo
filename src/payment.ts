export function paymentMethodLabel(method: string | null | undefined) {
  if (!method) return "Forma não informada";
  const normalized = method.trim().toLowerCase();
  const labels: Record<string, string> = {
    pix: "Pix",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    card: "Cartão",
    wallet: "Carteira digital",
    balance: "Saldo InfinitePay",
    boleto: "Boleto",
  };
  return labels[normalized] ?? normalized
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toLocaleUpperCase("pt-BR"));
}
