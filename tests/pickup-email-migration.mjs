import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { testEnvironment } from './test-environment.mjs';
import { migratePickupEmail } from '../api/pickup-email-migration.mjs';

const env = testEnvironment();
const database = `pickup_recovery_${Date.now()}_test`;
assert.match(database, /^pickup_recovery_\d+_test$/);
const connection = await mysql.createConnection({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD || '', multipleStatements: true });
const sql = await fs.readFile(new URL('../database/migrations/024_pickup_email.sql', import.meta.url), 'utf8');
let created = false;
try {
  await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  await connection.query(`USE \`${database}\``);
  for (const stopAfter of [0, 1, 2, 3, 4, 5, 6, 7]) {
    await connection.query(`CREATE TABLE users (id BIGINT UNSIGNED PRIMARY KEY);
      CREATE TABLE campaigns (id BIGINT UNSIGNED PRIMARY KEY);
      CREATE TABLE order_email_notifications (id BIGINT UNSIGNED PRIMARY KEY, notification_type VARCHAR(40), status VARCHAR(16),
      CONSTRAINT chk_order_email_notifications_type CHECK (notification_type IN ('payment_confirmed')),
      CONSTRAINT chk_order_email_notifications_status CHECK (status IN ('pending', 'sending', 'sent', 'failed')));
      INSERT INTO users VALUES (1); INSERT INTO campaigns VALUES (1);
      INSERT INTO order_email_notifications VALUES (1, 'payment_confirmed', 'sent');`);
    if (stopAfter) {
      let ddl = 0;
      const interrupted = {
        execute: (...args) => connection.execute(...args),
        query: async (...args) => { const result = await connection.query(...args); if (++ddl === stopAfter) throw new Error('interrupção simulada'); return result; },
      };
      await assert.rejects(migratePickupEmail(interrupted, sql), /interrupção simulada/);
      await connection.query("UPDATE campaigns SET pickup_group_url = 'https://chat.whatsapp.com/PreservarValor' WHERE id = 1");
    }
    await migratePickupEmail(connection, sql);
    await connection.query("INSERT INTO pickup_email_batches (id, campaign_id, created_by_user_id, payload) VALUES ('batch-preservado', 1, 1, '{\"teste\":true}')");
    await connection.query("INSERT INTO order_email_notifications (id, notification_type, status, pickup_batch_id, message_snapshot) VALUES (2, 'pickup_ready', 'uncertain', 'batch-preservado', '{\"text\":\"Preservar conteúdo\"}')");
    await migratePickupEmail(connection, sql);
    const [[old]] = await connection.query('SELECT * FROM order_email_notifications WHERE id = 1');
    assert.equal(old.status, 'sent'); assert.equal(old.notification_type, 'payment_confirmed');
    const [[notice]] = await connection.query('SELECT * FROM order_email_notifications WHERE id = 2');
    assert.equal(notice.status, 'uncertain'); assert.equal(notice.pickup_batch_id, 'batch-preservado');
    assert.match(JSON.stringify(notice.message_snapshot), /Preservar/);
    if (stopAfter) {
      const [[campaign]] = await connection.query('SELECT pickup_group_url FROM campaigns WHERE id = 1');
      assert.match(campaign.pickup_group_url, /PreservarValor/);
    }
    await assert.rejects(connection.query("INSERT INTO order_email_notifications (id, notification_type, status) VALUES (3, 'invalid', 'sent')"));
    await connection.query('DROP TABLE order_email_notifications; DROP TABLE pickup_email_batches; DROP TABLE campaigns; DROP TABLE users;');
    console.log(`✓ Migração 024: retomada após ${stopAfter} etapa(s), repetição e dados preservados`);
  }
} finally {
  if (created) await connection.query(`DROP DATABASE \`${database}\``);
  await connection.end();
}
