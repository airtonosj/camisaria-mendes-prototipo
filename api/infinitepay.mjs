import { config } from "./config.mjs";

export class InfinitePayRequestError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function boundedText(value, field, maximum = 190) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new InfinitePayRequestError("INVALID_PROVIDER_PAYLOAD", `Campo ${field} inválido.`);
  }
  return text;
}

function optionalHttpsUrl(value, field) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") throw new Error("protocol");
    return url.toString();
  } catch {
    throw new InfinitePayRequestError("INVALID_PROVIDER_PAYLOAD", `Campo ${field} precisa usar HTTPS.`);
  }
}

async function postJson(path, payload, { fetchImpl = fetch } = {}) {
  const url = `${config.payments.infinitePay.apiBaseUrl}${path}`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.payments.infinitePay.requestTimeoutMs),
    });
  } catch (error) {
    throw new InfinitePayRequestError(
      "INFINITEPAY_UNAVAILABLE",
      "A InfinitePay não respondeu. O pedido continua salvo e o pagamento pode ser retomado.",
      { cause: String(error?.message ?? error) },
    );
  }

  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new InfinitePayRequestError("INFINITEPAY_INVALID_RESPONSE", "A InfinitePay devolveu uma resposta inválida.");
  }
  if (!response.ok) {
    throw new InfinitePayRequestError(
      "INFINITEPAY_REJECTED",
      "A InfinitePay recusou a solicitacao. O pedido continua salvo.",
      { status: response.status, response: body },
    );
  }
  return body;
}

function assertCheckoutUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new InfinitePayRequestError("INFINITEPAY_INVALID_RESPONSE", "A InfinitePay não devolveu um link de checkout válido.");
  }
  if (url.protocol !== "https:" || url.hostname !== "checkout.infinitepay.com.br") {
    const safeDestination = {
      protocol: url.protocol,
      hostname: url.hostname.toLowerCase(),
    };
    // Nunca registre caminho, query string ou fragmento: eles podem carregar
    // identificadores da fatura. Protocolo e hostname bastam para revisar a
    // allowlist sem transformar um erro do provedor em redirecionamento aberto.
    console.warn("[InfinitePay] Checkout bloqueado por destino inesperado.", safeDestination);
    throw new InfinitePayRequestError(
      "INFINITEPAY_UNTRUSTED_CHECKOUT",
      "A InfinitePay devolveu um destino de checkout inesperado.",
      safeDestination,
    );
  }
  return url.toString();
}

export async function createInfinitePayLink({ orderNumber, items, customer, redirectUrl, webhookUrl }, options) {
  const payload = {
    handle: config.payments.infinitePay.handle,
    redirect_url: redirectUrl,
    webhook_url: webhookUrl,
    order_nsu: orderNumber,
    customer: {
      name: customer.name,
      email: customer.email,
      phone_number: customer.phone,
    },
    items: items.map((item) => ({
      quantity: item.quantity,
      price: item.unitPriceCents,
      description: item.description,
    })),
  };
  const response = await postJson("/links", payload, options);
  return { url: assertCheckoutUrl(response.url), payload, response };
}

export async function checkInfinitePayPayment({ orderNsu, transactionNsu, invoiceSlug }, options) {
  const response = await postJson("/payment_check", {
    handle: config.payments.infinitePay.handle,
    order_nsu: orderNsu,
    transaction_nsu: transactionNsu,
    slug: invoiceSlug,
  }, options);
  return response;
}

/**
 * Webhook e retorno do navegador carregam os mesmos identificadores com nomes
 * ligeiramente diferentes. Nenhum deles confirma pagamento: servem apenas para
 * solicitar a verificacao server-to-server em payment_check.
 */
export function normalizeInfinitePayEvent(payload, source = "webhook") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new InfinitePayRequestError("INVALID_PROVIDER_PAYLOAD", "Payload da InfinitePay inválido.");
  }
  const orderNsu = boundedText(payload.order_nsu, "order_nsu", 24).toUpperCase();
  if (!/^CM-\d{4}-[A-F0-9]{8}$/.test(orderNsu)) {
    throw new InfinitePayRequestError("INVALID_PROVIDER_PAYLOAD", "order_nsu não pertence a esta aplicação.");
  }
  const transactionNsu = boundedText(payload.transaction_nsu, "transaction_nsu");
  const invoiceSlug = boundedText(payload.invoice_slug ?? payload.slug, "invoice_slug");
  const amount = payload.amount === undefined ? null : Number(payload.amount);
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 1)) {
    throw new InfinitePayRequestError("INVALID_PROVIDER_PAYLOAD", "Valor informado pela InfinitePay é inválido.");
  }
  return {
    source,
    orderNsu,
    transactionNsu,
    invoiceSlug,
    amount,
    paidAmount: payload.paid_amount === undefined ? null : Number(payload.paid_amount),
    captureMethod: typeof payload.capture_method === "string" ? payload.capture_method : null,
    receiptUrl: optionalHttpsUrl(payload.receipt_url, "receipt_url"),
    raw: payload,
  };
}
