import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { testEnvironment } from '../test-environment.mjs';
import { resetTestDatabase } from '../reset-test-database.mjs';
import { changeDeliveryStatusQuery2 } from '../../api/modules/orders/repository.mjs';

test('delivery update accepts differing connection and column collations', async () => {
  const env = testEnvironment();
  await resetTestDatabase(env);
  const connection = await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,charset:'utf8mb4_general_ci'});
  try {
    // Temporary table shadows orders only on this connection; no persisted order is touched.
    await connection.query("CREATE TEMPORARY TABLE orders (id INT PRIMARY KEY, delivery_status VARCHAR(32) COLLATE utf8mb4_unicode_ci, delivered_at DATETIME(3))");
    await connection.query("INSERT INTO orders VALUES (1, 'ready', NULL)");
    for (const collation of ['utf8mb4_general_ci', 'utf8mb4_unicode_ci']) {
      await connection.query(`SET NAMES utf8mb4 COLLATE ${collation}`);
      await connection.query("UPDATE orders SET delivery_status='ready', delivered_at=NULL WHERE id=1");
      await changeDeliveryStatusQuery2(connection, ['ready', 0, 1]);
      let [[row]] = await connection.query('SELECT * FROM orders WHERE id=1');
      assert.equal(row.delivered_at, null);
      await changeDeliveryStatusQuery2(connection, ['delivered', 1, 1]);
      [[row]] = await connection.query('SELECT * FROM orders WHERE id=1');
      assert.equal(row.delivery_status, 'delivered');
      assert.ok(row.delivered_at);
      const deliveredAt = row.delivered_at.getTime();
      await changeDeliveryStatusQuery2(connection, ['issue', 0, 1]);
      [[row]] = await connection.query('SELECT * FROM orders WHERE id=1');
      assert.equal(row.delivery_status, 'issue');
      assert.equal(row.delivered_at.getTime(), deliveredAt);
    }
  } finally { await connection.end(); }
});
