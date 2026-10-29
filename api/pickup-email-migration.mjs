// DDL can persist even when a later statement fails. Resume migration 024 by
// inspecting the schema, without deleting columns, tables or notification data.
export async function migratePickupEmail(connection, sql) {
  async function column(table, name, definition) {
    const [rows] = await connection.execute('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, name]);
    if (!rows.length) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
  }
  async function constraint(name) {
    const [rows] = await connection.execute('SELECT CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?', ['order_email_notifications', name]);
    return rows[0]?.CONSTRAINT_TYPE;
  }
  await column('campaigns', 'pickup_group_url', 'VARCHAR(512) NULL');
  const create = sql.match(/CREATE TABLE pickup_email_batches\s*\([\s\S]*?ENGINE=InnoDB[^;]*;/)?.[0];
  if (!create) throw new Error('Definição de pickup_email_batches ausente na migração 024.');
  await connection.query(create.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
  await column('order_email_notifications', 'pickup_batch_id', 'CHAR(36) NULL');
  await column('order_email_notifications', 'message_snapshot', 'JSON NULL');
  if (!await constraint('fk_pickup_batch')) {
    await connection.query('ALTER TABLE order_email_notifications ADD CONSTRAINT fk_pickup_batch FOREIGN KEY (pickup_batch_id) REFERENCES pickup_email_batches(id)');
  }
  for (const [name, expression] of [
    ['chk_order_email_notifications_type', "notification_type IN ('payment_confirmed', 'pickup_ready')"],
    ['chk_order_email_notifications_status', "status IN ('pending', 'sending', 'sent', 'failed', 'cancelled', 'uncertain')"],
  ]) {
    const type = await constraint(name);
    if (type && type !== 'CHECK') throw new Error(`Tipo inesperado da restrição ${name}: ${type}`);
    // DROP CONSTRAINT is also used by migration 002 and works on MySQL 8/MariaDB.
    await connection.query(`ALTER TABLE order_email_notifications ${type ? `DROP CONSTRAINT \`${name}\`, ` : ''}ADD CONSTRAINT \`${name}\` CHECK (${expression})`);
  }
}
