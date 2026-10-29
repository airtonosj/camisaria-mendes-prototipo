import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from './database.mjs';
import { config } from './config.mjs';
import { parseWhatsapp } from './phone.mjs';
import { mailerConfigured, sendMail } from './mailer.mjs';

export class PickupError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}
const json = value => typeof value === 'string' ? JSON.parse(value) : value;
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
export function pickupSettings(body) {
  const text = (key, max) => {
    const value = typeof body[key] === 'string' ? body[key].trim() : '';
    if (!value || value.length > max) throw new PickupError(`Preencha corretamente ${ { instructions: 'as orientações de retirada', representative: 'o representante', groupUrl: 'o link do grupo' }[key] }.`);
    return value;
  };
  const instructions = text('instructions', 255);
  const representative = text('representative', 160);
  const phone = parseWhatsapp(body.phone);
  if (phone.error) throw new PickupError(phone.error);
  let group;
  try { group = new URL(text('groupUrl', 512)); } catch { throw new PickupError('Informe um convite válido do grupo no WhatsApp.'); }
  if (group.protocol !== 'https:' || group.hostname !== 'chat.whatsapp.com' || group.port || group.username || group.password || !/^\/[A-Za-z0-9]{10,100}\/?$/.test(group.pathname)) throw new PickupError('Use um convite https://chat.whatsapp.com/ do grupo da turma.');
  group.hash = '';
  group.search = '';
  return { instructions, representative, phone: phone.canonical, groupUrl: group.toString() };
}
export function pickupMessage(order, settings, title) {
  const url = new URL(config.publicAppUrl);
  url.searchParams.set('rota', 'acompanhar-pedido'); url.searchParams.set('pedido', order.order_number);
  const local = settings.phone.slice(2);
  const phone = `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}`;
  return {
    to: order.customer_email,
    subject: `Seu pedido ${order.order_number} está pronto para retirada!`,
    messageId: `pickup.${order.order_number.toLowerCase()}@notifications.camisaria-mendes`,
    text: [`Olá, ${order.customer_name}!`, '', `Seu pedido da campanha ${title} está pronto para retirada.`, '', `Pedido: ${order.order_number}`, ...(order.items?.length ? ['', 'Peças do pedido:', ...order.items.map(item => `- ${item}`)] : []), '', settings.instructions, '', `Representante: ${settings.representative}`, `WhatsApp: ${phone}`, 'Conversar com o representante:', `https://wa.me/${settings.phone}`, '', 'Entrar no grupo da turma:', settings.groupUrl, '', 'Acompanhar meu pedido:', url.toString(), 'Para consultar, confirme o WhatsApp usado na compra.', '', 'Camisaria Mendes'].join('\n'),
  };
}
async function campaign(database, code, lock = false) {
  const [rows] = await database.execute(`SELECT id, title, phase, pickup_instructions, representative_name, representative_whatsapp, pickup_group_url FROM campaigns WHERE code = ?${lock ? ' FOR UPDATE' : ''}`, [code]);
  if (!rows[0]) throw new PickupError('Campanha não encontrada.', 404);
  return rows[0];
}
async function recipients(database, campaignId) {
  const [rows] = await database.execute(`SELECT o.id, o.order_number, o.customer_name, o.customer_email FROM orders o
    WHERE o.campaign_id = ? AND o.status = 'active' AND o.payment_status = 'paid' AND o.delivery_status <> 'delivered'
    AND NOT EXISTS (SELECT 1 FROM order_email_notifications n WHERE n.order_id = o.id AND n.notification_type = 'pickup_ready') ORDER BY o.id`, [campaignId]);
  return rows.filter(row => validEmail(row.customer_email));
}
async function items(database, orderId) {
  const [rows] = await database.execute(`SELECT oi.quantity, sm.name AS model, co.name AS color, sz.code AS size FROM order_items oi
    JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id JOIN shirt_models sm ON sm.id = cv.shirt_model_id
    JOIN colors co ON co.id = cv.color_id JOIN sizes sz ON sz.id = oi.size_id WHERE oi.order_id = ? ORDER BY oi.id`, [orderId]);
  return rows.map(row => `${row.quantity}x ${row.model} · ${row.color} · ${row.size}`);
}
export async function pickupInfo(code) {
  const c = await campaign(pool, code);
  const eligible = await recipients(pool, c.id);
  const [history] = await pool.execute(`SELECT n.status, COUNT(*) AS count FROM order_email_notifications n JOIN orders o ON o.id = n.order_id WHERE o.campaign_id = ? AND n.notification_type = 'pickup_ready' GROUP BY n.status`, [c.id]);
  return { settings: { instructions: c.pickup_instructions, representative: c.representative_name, phone: c.representative_whatsapp, groupUrl: c.pickup_group_url || '' }, eligible: eligible.length, configured: mailerConfigured(), history: history.map(row => ({ status: row.status, count: Number(row.count) })) };
}
export async function previewPickup(code, body, staffId) {
  const settings = pickupSettings(body);
  return withTransaction(async database => {
    const c = await campaign(database, code, true);
    if (c.phase !== 'ready_for_delivery') throw new PickupError('A campanha precisa estar pronta para entrega.', 409);
    const orders = await recipients(database, c.id);
    if (!orders.length) throw new PickupError('Não há pedidos aptos ainda não avisados.', 409);
    const messages = [];
    for (const order of orders) messages.push({ orderId: order.id, ...pickupMessage({ ...order, items: await items(database, order.id) }, settings, c.title) });
    const id = randomUUID();
    await database.execute('INSERT INTO pickup_email_batches (id, campaign_id, created_by_user_id, payload) VALUES (?, ?, ?, ?)', [id, c.id, staffId, JSON.stringify({ settings, messages })]);
    return { batchId: id, count: messages.length, subject: messages[0].subject, text: messages[0].text };
  });
}
export async function confirmPickup(code, batchId, staffId) {
  if (!mailerConfigured()) throw new PickupError('O envio de e-mails não está configurado.', 503);
  return withTransaction(async database => {
    const c = await campaign(database, code, true);
    const [rows] = await database.execute('SELECT *, (created_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 30 MINUTE)) AS expired FROM pickup_email_batches WHERE id = ? AND campaign_id = ? AND created_by_user_id = ? FOR UPDATE', [batchId, c.id, staffId]);
    const batch = rows[0];
    if (!batch) throw new PickupError('Prévia não encontrada. Revise as informações novamente.', 404);
    if (batch.status === 'confirmed') return { queued: 0, alreadyConfirmed: true };
    if (c.phase !== 'ready_for_delivery' || Boolean(batch.expired)) throw new PickupError('A prévia expirou ou a campanha mudou de fase. Revise novamente.', 409);
    const payload = json(batch.payload);
    const eligible = new Map((await recipients(database, c.id)).map(order => [String(order.id), order]));
    let queued = 0;
    for (const message of payload.messages) {
      const order = eligible.get(String(message.orderId));
      if (!order || order.customer_email !== message.to) continue;
      const [result] = await database.execute(`INSERT INTO order_email_notifications (order_id, notification_type, recipient_email, pickup_batch_id, message_snapshot)
        VALUES (?, 'pickup_ready', ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`, [message.orderId, message.to, batchId, JSON.stringify(message)]);
      if (result.affectedRows === 1) queued++;
    }
    await database.execute("UPDATE pickup_email_batches SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [batchId]);
    const s = payload.settings;
    await database.execute('UPDATE campaigns SET pickup_instructions = ?, representative_name = ?, representative_whatsapp = ?, pickup_group_url = ? WHERE id = ?', [s.instructions, s.representative, s.phone, s.groupUrl, c.id]);
    return { queued, skipped: payload.messages.length - queued };
  });
}

export async function processPickupEmails({ database = pool, send = sendMail, limit = 5 } = {}) {
  // Never automatically replay an interrupted SMTP delivery: acceptance may already have happened.
  await database.execute("UPDATE order_email_notifications SET status = 'uncertain', locked_at = NULL WHERE notification_type = 'pickup_ready' AND status = 'sending' AND locked_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 10 MINUTE)");
  const [rows] = await database.execute(`SELECT id FROM order_email_notifications WHERE notification_type = 'pickup_ready' AND status IN ('pending', 'failed') AND attempts < 3 AND available_at <= CURRENT_TIMESTAMP(3) ORDER BY id LIMIT ${Math.max(1, Math.min(20, Number.parseInt(String(limit), 10) || 5))}`);
  for (const row of rows) {
    const [claim] = await database.execute("UPDATE order_email_notifications SET status = 'sending', attempts = attempts + 1, locked_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND status IN ('pending', 'failed') AND attempts < 3", [row.id]);
    if (claim.affectedRows !== 1) continue;
    let sending = false;
    try {
      const [current] = await database.execute(`SELECT n.message_snapshot, n.recipient_email, o.customer_email, o.status, o.payment_status, o.delivery_status, c.phase FROM order_email_notifications n JOIN orders o ON o.id = n.order_id JOIN campaigns c ON c.id = o.campaign_id WHERE n.id = ?`, [row.id]);
      const o = current[0];
      if (!o || o.status !== 'active' || o.payment_status !== 'paid' || o.delivery_status === 'delivered' || o.phase !== 'ready_for_delivery' || o.customer_email !== o.recipient_email || !validEmail(o.customer_email)) {
        await database.execute("UPDATE order_email_notifications SET status = 'cancelled', locked_at = NULL WHERE id = ?", [row.id]); continue;
      }
      const message = json(o.message_snapshot);
      sending = true;
      await send(message);
      await database.execute("UPDATE order_email_notifications SET status = 'sent', sent_at = CURRENT_TIMESTAMP(3), locked_at = NULL, last_error = NULL WHERE id = ?", [row.id]);
    } catch (error) {
      const status = sending && error.deliveryUncertain !== false ? 'uncertain' : 'failed';
      await database.execute("UPDATE order_email_notifications SET status = ?, locked_at = NULL, last_error = ?, available_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 5 MINUTE) WHERE id = ?", [status, String(error.message).slice(0, 500), row.id]);
    }
  }
}
