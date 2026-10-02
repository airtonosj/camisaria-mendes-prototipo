/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 */
export function listReceiversQuery(executor) {
  return executor.execute(`SELECT r.id, r.name, r.email, r.phone, r.infinitepay_handle, r.active,
            (SELECT COUNT(*) FROM campaigns c WHERE c.receiver_id = r.id) AS campaign_count
       FROM payment_receivers r
      ORDER BY r.active DESC, r.name, r.id`);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function receiverCampaignsQuery(executor, values = []) {
  return executor.execute(`SELECT receiver_id, code, title FROM campaigns
      WHERE receiver_id IS NOT NULL ORDER BY created_at DESC`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function findReceiverQuery(executor, values, { lock = false } = {}) {
  return executor.execute(`SELECT id, name, email, phone, infinitepay_handle, active
       FROM payment_receivers WHERE id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function findReceiverByHandleQuery(executor, values) {
  return executor.execute("SELECT id FROM payment_receivers WHERE infinitepay_handle = ? AND id <> ? LIMIT 1", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createReceiverQuery(executor, values) {
  return executor.execute(`INSERT INTO payment_receivers (name, email, phone, infinitepay_handle, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function updateReceiverQuery(executor, values) {
  return executor.execute(`UPDATE payment_receivers
        SET name = ?, email = ?, phone = ?, infinitepay_handle = ?, active = ?
      WHERE id = ?`, values);
}

/**
 * Checkouts em preparação ou emitidos e ainda não pagos. Cada um aponta para a conta gravada
 * em `payment_checkouts.handle`; trocar essa conta por baixo deles faria o cliente
 * pagar para quem já não é o recebedor da campanha.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function pendingCheckoutsQuery(executor, values, fragment) {
  return executor.execute(`SELECT COUNT(*) AS total
       FROM payment_checkouts pc
       JOIN orders o ON o.id = pc.order_id
       JOIN campaigns c ON c.id = o.campaign_id
      WHERE pc.status = 'pending' AND (pc.checkout_url IS NOT NULL OR pc.locked_at IS NOT NULL)
        AND o.status = 'active' AND o.payment_status IN ('pending', 'failed')
        AND ${fragment}`, values);
}
