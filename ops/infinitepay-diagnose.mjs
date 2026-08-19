/**
 * Diagnostico do checkout InfinitePay.
 *
 * Sem `--send`, apenas monta e imprime o payload exato que a API enviaria para o pedido
 * informado: nenhuma chamada externa, nenhuma escrita. Com `--send`, cria de fato o link
 * na conta da camisaria e imprime o status e o corpo da resposta -- a unica forma de
 * saber por que o provedor recusou, porque a mensagem que chega ao cliente e generica.
 *
 *   node ops/infinitepay-diagnose.mjs CM-2026-XXXXXXXX
 *   node ops/infinitepay-diagnose.mjs CM-2026-XXXXXXXX --send
 */
import { config } from "../api/config.mjs";
import { pool } from "../api/database.mjs";
import { createInfinitePayLink, infinitePayLinkPayload, InfinitePayRequestError } from "../api/infinitepay.mjs";

const argumentos = process.argv.slice(2);
const send = argumentos.includes("--send");
const orderNumber = (argumentos.find((argumento) => !argumento.startsWith("--")) ?? "").toUpperCase();

if (!orderNumber) {
  console.error("Informe o numero do pedido: node ops/infinitepay-diagnose.mjs CM-2026-XXXXXXXX [--send]");
  process.exit(1);
}

function publicUrl(parameters = {}) {
  const url = new URL(config.publicAppUrl);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.toString();
}

function webhookUrl() {
  const url = new URL(config.publicAppUrl);
  url.pathname = `${url.pathname.replace(/[/]+$/, "")}/api/payments/infinitepay/webhook`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

try {
  console.log("Conta e endpoint em uso:");
  console.log(`  handle           : ${config.payments.infinitePay.handle || "(nao configurada)"}`);
  console.log(`  apiBaseUrl       : ${config.payments.infinitePay.apiBaseUrl}`);
  console.log(`  checkoutEnabled  : ${config.payments.infinitePay.checkoutEnabled}`);
  console.log(`  publicAppUrl     : ${config.publicAppUrl}`);

  const [orders] = await pool.execute(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_whatsapp, o.customer_email,
            o.status, o.payment_status, o.subtotal_cents, o.discount_cents, o.coupon_code, o.total_cents
       FROM orders o WHERE o.order_number = ? LIMIT 1`,
    [orderNumber],
  );
  if (orders.length === 0) {
    console.error(`Pedido ${orderNumber} nao encontrado.`);
    process.exit(1);
  }
  const order = orders[0];
  console.log("\nPedido:");
  console.log(`  status/pagamento : ${order.status} / ${order.payment_status}`);
  console.log(`  subtotal/desconto: ${order.subtotal_cents} / ${order.discount_cents} (cupom ${order.coupon_code ?? "-"})`);
  console.log(`  total            : ${order.total_cents}`);
  console.log(`  e-mail cadastrado: ${order.customer_email ?? "(vazio)"}`);
  console.log(`  whatsapp         : ${order.customer_whatsapp}`);

  const [checkouts] = await pool.execute(
    "SELECT status, checkout_url IS NOT NULL AS tem_url, last_error, locked_at FROM payment_checkouts WHERE order_id = ? AND provider = 'infinitepay' LIMIT 1",
    [order.id],
  );
  console.log("\nUltima tentativa registrada:");
  console.log(checkouts[0] ? `  ${JSON.stringify(checkouts[0])}` : "  (nenhuma)");

  const [items] = await pool.execute(
    `SELECT oi.quantity, oi.unit_price_cents, oi.unit_discount_cents,
            sm.name AS model_name, co.name AS color_name, sz.code AS size_code
       FROM order_items oi
       JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
       JOIN sizes sz ON sz.id = oi.size_id
      WHERE oi.order_id = ? ORDER BY oi.id`,
    [order.id],
  );

  const input = {
    orderNumber: order.order_number,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_whatsapp,
    },
    items: items.map((item) => ({
      quantity: Number(item.quantity),
      unitPriceCents: Number(item.unit_price_cents) - Number(item.unit_discount_cents),
      description: `${item.model_name} - ${item.color_name} - ${item.size_code}`.slice(0, 120),
    })),
    redirectUrl: publicUrl({ rota: "acompanhar-pedido", pedido: order.order_number }),
    webhookUrl: webhookUrl(),
  };

  console.log("\nPayload que seria enviado para /links:");
  console.log(JSON.stringify(infinitePayLinkPayload(input), null, 2));

  if (!send) {
    console.log("\nNenhuma chamada foi feita. Repita com --send para criar o link de verdade e ver a resposta da InfinitePay.");
    process.exit(0);
  }

  console.log("\nEnviando para a InfinitePay...");
  try {
    const checkout = await createInfinitePayLink(input);
    console.log("Aceito. Link criado:");
    console.log(`  ${checkout.url}`);
    console.log("Resposta completa:");
    console.log(JSON.stringify(checkout.response, null, 2));
    console.log("\nEste link nao foi gravado no pedido: serve apenas como teste e pode ser ignorado.");
  } catch (error) {
    if (error instanceof InfinitePayRequestError) {
      console.error(`Recusado. codigo=${error.code} mensagem=${error.message}`);
      console.error("Detalhes do provedor:");
      console.error(JSON.stringify(error.details ?? {}, null, 2));
      process.exit(2);
    }
    throw error;
  }
} finally {
  await pool.end();
}
