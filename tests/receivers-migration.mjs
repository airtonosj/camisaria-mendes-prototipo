import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { testEnvironment } from './test-environment.mjs';

const env = testEnvironment();
const database = `${env.DB_NAME}_receivers_migration_test`;
assert.match(database, /^[A-Za-z0-9_]+_test$/);
const connection = await mysql.createConnection({
  host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER,
  password: env.DB_PASSWORD, multipleStatements: true,
});
const directory = new URL('../database/migrations/', import.meta.url);
let created = false;
try {
  await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  await connection.query(`USE \`${database}\``);
  // Reproduz o schema completo até a 024, sem depender de outro teste.
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.sql') && file < '025').sort();
  for (const file of files) await connection.query(await fs.readFile(new URL(file, directory), 'utf8'));
  const [[before]] = await connection.query('SELECT MAX(version) AS version FROM schema_migrations');
  assert.equal(before.version, '024_pickup_email');
  const sql = await fs.readFile(new URL('025_campaign_receivers.sql', directory), 'utf8');
  await connection.query(sql);
  await connection.query("INSERT INTO payment_receivers (name, infinitepay_handle) VALUES ('Recebedor QA', 'migration_qa')");
  await connection.query(sql);
  const [[receiver]] = await connection.query('SELECT infinitepay_handle FROM payment_receivers');
  assert.equal(receiver.infinitepay_handle, 'migration_qa');
  const [[after]] = await connection.query('SELECT MAX(version) AS version FROM schema_migrations');
  assert.equal(after.version, '025_campaign_receivers');
  const [columns] = await connection.query("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND ((TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'receiver_id') OR (TABLE_NAME = 'payment_checkouts' AND COLUMN_NAME = 'handle'))", [database]);
  assert.equal(columns.length, 2);
  console.log('✓ Migração 025: atualização da 024 e repetição preservando recebedor.');
} finally {
  if (created) await connection.query(`DROP DATABASE \`${database}\``);
  await connection.end();
}
