/**
 * Formato canonico do WhatsApp, usado em todo o sistema: somente digitos e sempre com o
 * codigo do pais. O cliente digita como quiser -- "(98) 98888-7777", "+55 98 98888-7777",
 * "098 98888 7777" -- e o sistema grava e consulta sempre a mesma forma, 5598988887777.
 *
 * Sem isso, o mesmo cliente com o mesmo telefone virava duas chaves diferentes: quem
 * pedia digitando o DDD e depois pagava digitando o codigo do pais recebia "pedido nao
 * encontrado", e o checkout enviava ao provedor um numero que nao existe.
 */

/**
 * DDDs em uso no Brasil. Um numero com dois primeiros digitos fora desta lista e erro de
 * digitacao, e recusar na hora do pedido e melhor do que descobrir na hora de pagar.
 */
const areaCodes = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

const exemplo = "como (98) 98888-7777";

/**
 * Analisa o que o cliente digitou e devolve `{ canonical }` ou `{ error }` com o motivo
 * exato. A pontuacao e livre; o que e conferido e o numero por tras dela.
 *
 * A decisao de tamanho vem depois de tirar o zero de operadora e o codigo do pais, e e
 * feita sobre o numero local: 11 digitos para celular, 10 para fixo. Um local de 11
 * digitos que comeca com 55 -- o DDD 55 de Santa Maria, por exemplo -- continua local e
 * vira 5555XXXXXXXXX, que e o certo.
 */
export function parseWhatsapp(value) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  if (!digits) return { error: `Informe o WhatsApp com DDD, ${exemplo}.` };

  // Nenhum numero brasileiro comeca com zero: o que vem antes do DDD e codigo de
  // operadora ou de discagem internacional.
  const semZeros = digits.replace(/^0+/, "");
  const local = semZeros.length > 11 && semZeros.startsWith("55") ? semZeros.slice(2) : semZeros;

  if (local.length < 10) return { error: `O WhatsApp está incompleto: informe DDD + número, ${exemplo}.` };
  if (local.length > 11) return { error: `O WhatsApp tem dígitos demais: informe DDD + número, ${exemplo}.` };

  const areaCode = local.slice(0, 2);
  if (!areaCodes.has(areaCode)) {
    return { error: `Não existe o DDD ${areaCode}. Confira os dois primeiros dígitos do WhatsApp.` };
  }

  const subscriber = local.slice(2);
  if (local.length === 11 && !subscriber.startsWith("9")) {
    return { error: `Depois do DDD, o celular tem 9 dígitos e começa com 9, ${exemplo}.` };
  }
  if (local.length === 10 && !["2", "3", "4", "5"].includes(subscriber[0])) {
    return { error: "Depois do DDD, o celular tem 9 dígitos e começa com 9; o fixo tem 8 e começa com 2, 3, 4 ou 5." };
  }

  return { canonical: `55${local}` };
}

/** Forma canonica, ou null quando o valor nao e um telefone brasileiro valido. */
export function canonicalWhatsapp(value) {
  return parseWhatsapp(value).canonical ?? null;
}

/** Telefone em E.164, formato que o checkout da InfinitePay exige. */
export function internationalPhone(value) {
  const canonical = canonicalWhatsapp(value);
  return canonical ? `+${canonical}` : null;
}

/**
 * Formas aceitas ao procurar um pedido. A migracao 020 normalizou o que estava gravado,
 * mas um backup antigo restaurado ou uma linha criada por um processo desatualizado nao
 * pode fazer o cliente ver "pedido nao encontrado": a consulta aceita tambem a forma sem
 * o codigo do pais.
 */
export function whatsappLookupValues(canonical) {
  const values = [canonical];
  if (canonical.startsWith("55") && canonical.length >= 12) values.push(canonical.slice(2));
  return values;
}
