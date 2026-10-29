import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { spawnSync } from 'node:child_process';
import { testEnvironment } from './test-environment.mjs';
import { prepareDatabase, startApi, waitForApi, stopApi } from './helpers/environment.mjs';
const env={...testEnvironment(),API_PORT:'3346',MIGRATIONS_ON_START:'false'};
await prepareDatabase(env);
async function boots(environment){
 const api=startApi(environment,'api/start.mjs');
 try {const health=await waitForApi(api.child,'http://127.0.0.1:3346');assert.equal(health.schema.ready,true);assert.ok(health.version);return api.output();}
 finally {await stopApi(api.child);}
}
await boots(env);
const warmBoot = await boots({...env,MIGRATIONS_ON_START:'true'});
assert.doesNotMatch(warmBoot,/Migração já aplicada:|O banco já está atualizado\./);
const db=await mysql.createConnection({host:env.DB_HOST,port:+env.DB_PORT,user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME});
try {
 const [[last]]=await db.query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
 await db.execute('DELETE FROM schema_migrations WHERE version=?',[last.version]);
 const rejected=spawnSync(process.execPath,['api/start.mjs'],{env,encoding:'utf8',timeout:15000});
 assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/DATABASE_MIGRATION_REQUIRED/);
 await boots({...env,MIGRATIONS_ON_START:'true',MIGRATION_DB_USER:env.DB_USER,MIGRATION_DB_PASSWORD:env.DB_PASSWORD});
 const [[count]]=await db.execute('SELECT COUNT(*) AS total FROM schema_migrations WHERE version=?',[last.version]);
 assert.equal(count.total,1);
 console.log('✓ Inicialização: schema pronto, recusa de pendência e migração automática com credenciais separadas.');
} finally {await db.end();}
