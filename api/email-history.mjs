import { pool } from './database.mjs';
import { PickupError } from './pickup-email.mjs';

export async function emailHistory(code, params = new URLSearchParams()) {
  const [[campaign]] = await pool.execute('SELECT id FROM campaigns WHERE code = ?', [code]);
  if (!campaign) throw new PickupError('Campanha não encontrada.', 404);
  const status = params.get('status') || '';
  if (status && !['pending', 'sending', 'sent', 'failed', 'cancelled', 'uncertain'].includes(status)) throw new PickupError('Status inválido.');
  const search = (params.get('search') || '').trim().slice(0, 160);
  const conditions = ['o.campaign_id = ?'];
  const values = [campaign.id];
  if (status) { conditions.push('n.status = ?'); values.push(status); }
  if (search) {
    conditions.push('(LOCATE(?, o.order_number) > 0 OR LOCATE(?, o.customer_name) > 0 OR LOCATE(?, n.recipient_email) > 0)');
    values.push(search, search, search);
  }
  const from = `FROM order_email_notifications n JOIN orders o ON o.id = n.order_id WHERE ${conditions.join(' AND ')}`;
  const [[count]] = await pool.execute(`SELECT COUNT(*) AS total ${from}`, values);
  const total = Number(count.total);
  const pages = Math.max(1, Math.ceil(total / 15));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.get('page'), 10) || 1));
  const [rows] = await pool.execute(`SELECT n.id, o.order_number AS orderNumber, o.customer_name AS customerName,
    n.recipient_email AS recipient, n.notification_type AS type, n.status, n.attempts,
    n.created_at AS createdAt, n.sent_at AS sentAt, n.message_snapshot AS snapshot
    ${from} ORDER BY n.created_at DESC, n.id DESC LIMIT 15 OFFSET ${(page - 1) * 15}`, values);
  const [summary] = await pool.execute(`SELECT n.status, COUNT(*) AS count FROM order_email_notifications n
    JOIN orders o ON o.id = n.order_id WHERE o.campaign_id = ? GROUP BY n.status`, [campaign.id]);
  return { page, pages, total, summary: summary.map(r => ({ status: r.status, count: Number(r.count) })), items: rows.map(row => {
    const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
    const { snapshot: ignored, ...item } = row;
    return { ...item, id: String(item.id), subject: snapshot?.subject || null, text: snapshot?.text || null };
  }) };
}
