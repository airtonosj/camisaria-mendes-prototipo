/** Queries accept the caller executor; services own authorization and transactions. */
export function campaignIdByCode(executor, code) {
  return executor.execute('SELECT id FROM campaigns WHERE code = ? LIMIT 1', [code]);
}

export function insertEvent(executor, values) {
  return executor.execute('INSERT INTO campaign_metric_events (campaign_id, anonymous_session_id, event_name, source) VALUES (?, ?, ?, ?)', values);
}

export function funnelRows(executor, values) {
  return executor.execute(`SELECT c.code AS campaign_code, e.source, e.event_name, COUNT(*) AS total
    FROM campaign_metric_events e JOIN campaigns c ON c.id = e.campaign_id
    WHERE e.created_at >= ? AND e.created_at < ? AND (? IS NULL OR c.code = ?) AND (? IS NULL OR e.source = ?)
    GROUP BY c.code, e.source, e.event_name`, values);
}

export function paidRows(executor, values) {
  return executor.execute(`SELECT c.code AS campaign_code, COALESCE(o.analytics_source, 'direct') AS source, COUNT(*) AS total
    FROM orders o JOIN campaigns c ON c.id = o.campaign_id
    WHERE o.paid_at >= ? AND o.paid_at < ? AND o.payment_status = 'paid' AND o.status <> 'cancelled'
      AND (? IS NULL OR c.code = ?) AND (? IS NULL OR COALESCE(o.analytics_source, 'direct') = ?)
    GROUP BY c.code, COALESCE(o.analytics_source, 'direct')`, values);
}
