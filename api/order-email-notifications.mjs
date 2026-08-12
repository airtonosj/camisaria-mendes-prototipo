import { config } from "./config.mjs";
import { pool } from "./database.mjs";
import { mailerConfigured, sendMail } from "./mailer.mjs";

const notificationType = "payment_confirmed";
const staleLockMinutes = 10;
const retryDelayMinutes = 5;

function trackingUrl(orderNumber) {
  const url = new URL(config.publicAppUrl);
  url.searchParams.set("rota", "acompanhar-pedido");
  url.searchParams.set("pedido", orderNumber);
  return url.toString();
}

function formatCents(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) / 100);
}

export function paymentConfirmationMessage(order) {
  const orderNumber = String(order.order_number);
  const itemLines = String(order.item_summary ?? "")
    .split("\n")
    .filter(Boolean);
  return {
    to: order.recipient_email,
    subject: `Pagamento confirmado - pedido ${orderNumber}`,
    messageId: `payment-confirmation.${orderNumber.toLowerCase()}@notifications.camisaria-mendes`,
    text: [
      `Olá, ${order.customer_name}.`,
      "",
      "O pagamento da sua compra na Camisaria Mendes foi confirmado.",
      "",
      `Código da compra: ${orderNumber}`,
      `Campanha: ${order.campaign_title}`,
      `Valor confirmado: ${formatCents(order.total_cents)}`,
      ...(itemLines.length ? ["", "Peças do pedido:", ...itemLines.map((item) => `- ${item}`)] : []),
      "",
      "Acompanhe seu pedido pelo endereço abaixo:",
      trackingUrl(orderNumber),
      "",
      "O código já estará preenchido. Para proteger seus dados, confirme também o WhatsApp usado na compra.",
      "Guarde este e-mail até a retirada do pedido.",
      "",
      "Camisaria Mendes",
    ].join("\n"),
  };
}

function deliveryCondition() {
  return `(
    (status IN ('pending', 'failed') AND available_at <= CURRENT_TIMESTAMP(3))
    OR (status = 'sending' AND locked_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL ${staleLockMinutes} MINUTE))
  )`;
}

/**
 * Entrega a fila transacional. database e send podem ser substituídos nos testes;
 * em produção usam o pool MySQL e o SMTP configurado.
 */
export async function processPaymentConfirmationEmails({ database = pool, send = sendMail, limit = 10 } = {}) {
  const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(limit), 10) || 10));
  const [candidates] = await database.execute(
    `SELECT id FROM order_email_notifications
      WHERE notification_type = ? AND ${deliveryCondition()}
      ORDER BY available_at, id
      LIMIT ${safeLimit}`,
    [notificationType],
  );
  const result = { processed: 0, sent: 0, failed: 0 };

  for (const candidate of candidates) {
    const [claim] = await database.execute(
      `UPDATE order_email_notifications
          SET status = 'sending', attempts = attempts + 1,
              locked_at = CURRENT_TIMESTAMP(3), last_error = NULL
        WHERE id = ? AND notification_type = ? AND ${deliveryCondition()}`,
      [candidate.id, notificationType],
    );
    if (claim.affectedRows !== 1) continue;
    result.processed += 1;

    const [rows] = await database.execute(
      `SELECT n.id, n.recipient_email, o.order_number, o.customer_name, o.total_cents,
              c.title AS campaign_title,
              GROUP_CONCAT(CONCAT(oi.quantity, 'x ', sm.name, ' - ', co.name, ' - ', sz.code)
                ORDER BY oi.id SEPARATOR '\n') AS item_summary
         FROM order_email_notifications n
         JOIN orders o ON o.id = n.order_id
         JOIN campaigns c ON c.id = o.campaign_id
         JOIN order_items oi ON oi.order_id = o.id
         JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
         JOIN shirt_models sm ON sm.id = cv.shirt_model_id
         JOIN colors co ON co.id = cv.color_id
         JOIN sizes sz ON sz.id = oi.size_id
        WHERE n.id = ? AND n.notification_type = ?
        GROUP BY n.id, n.recipient_email, o.order_number, o.customer_name, o.total_cents, c.title
        LIMIT 1`,
      [candidate.id, notificationType],
    );

    try {
      if (rows.length !== 1) throw new Error("Pedido da notificação não foi encontrado.");
      await send(paymentConfirmationMessage(rows[0]));
      await database.execute(
        `UPDATE order_email_notifications
            SET status = 'sent', sent_at = CURRENT_TIMESTAMP(3), locked_at = NULL, last_error = NULL
          WHERE id = ? AND status = 'sending'`,
        [candidate.id],
      );
      result.sent += 1;
    } catch (error) {
      const message = String(error?.message ?? error).slice(0, 500);
      await database.execute(
        `UPDATE order_email_notifications
            SET status = 'failed', locked_at = NULL, last_error = ?,
                available_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${retryDelayMinutes} MINUTE)
          WHERE id = ? AND status = 'sending'`,
        [message, candidate.id],
      );
      result.failed += 1;
      console.error(`Falha ao enviar confirmação de pagamento da notificação ${candidate.id}:`, error);
    }
  }
  return result;
}

export function startOrderEmailNotificationWorker() {
  if (!mailerConfigured()) return () => {};
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processPaymentConfirmationEmails();
    } catch (error) {
      console.error("Falha ao processar a fila de e-mails de pedidos:", error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, config.smtp.deliveryIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
