// Local-only provisioning; never grants access to the application database.
import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import { config } from '../api/config.mjs';

if (config.isProduction) throw new Error('Preparação de testes indisponível em produção.');
if (!['127.0.0.1', 'localhost', '::1'].includes(config.database.host)) throw new Error('Preparação permitida somente no MySQL local.');
const filename = new URL('../.env.test.local', import.meta.url);
try { await fs.access(filename); throw new Error('.env.test.local já existe; preserve suas credenciais.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const user = 'mendes_test_runner';
const password = randomBytes(32).toString('hex');
const connection = await mysql.createConnection(config.database);
try {
  await connection.query('CREATE USER ?@? IDENTIFIED BY ?', [user, 'localhost', password]);
  for (const db of ['camisaria_structure_test','camisaria_structure_e2e_test','camisaria_structure_test_pickup_recovery_test','camisaria_structure_restore_test']) {
    await connection.query(`GRANT ALL PRIVILEGES ON \`${db}\`.* TO ?@?`, [user, 'localhost']);
  }
  await fs.writeFile(filename, `TEST_DB_HOST=127.0.0.1\nTEST_DB_PORT=${config.database.port}\nTEST_DB_NAME=camisaria_structure_test\nTEST_DB_USER=${user}\nTEST_DB_PASSWORD=${password}\n`, { flag:'wx', mode:0o600 });
  console.log('Credenciais locais de teste criadas em arquivo ignorado; acesso restrito a quatro bancos de teste.');
} finally { await connection.end(); }
