/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function updateAccountQuery1(executor, values) {
  return executor.execute(`SELECT id, name, email, password_hash, role, must_change_password
         FROM users WHERE id = ? AND active = TRUE LIMIT 1 FOR UPDATE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function updateAccountQuery2(executor, values) {
  return executor.execute("SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function updateAccountQuery3(executor, values) {
  return executor.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", values);
}
