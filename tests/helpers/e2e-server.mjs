import { testEnvironment } from '../test-environment.mjs';
import { prepareDatabase, startApi, stopApi, waitForApi } from './environment.mjs';
import { startFakeInfinitePay } from './infinitepay.mjs';
import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
const environment=testEnvironment();
Object.assign(environment,{DB_NAME:environment.DB_NAME.replace(/_test$/,'_e2e_test'),API_PORT:'4186',TEST_INFINITEPAY_PORT:'4187',INFINITEPAY_API_BASE_URL:'http://127.0.0.1:4187',PUBLIC_APP_URL:'http://127.0.0.1:4186',CORS_ORIGIN:'http://127.0.0.1:4186'});
environment.UPLOADS_DIR=path.join(path.dirname(path.dirname(environment.UPLOADS_DIR)),environment.DB_NAME,'uploads');
await prepareDatabase(environment);
const artwork='00000000-0000-4000-8000-000000000001.png';
await fs.mkdir(environment.UPLOADS_DIR,{recursive:true});
await fs.copyFile('assets/logo-mendes.png',path.join(environment.UPLOADS_DIR,artwork));
const db=await mysql.createConnection({host:environment.DB_HOST,port:+environment.DB_PORT,user:environment.DB_USER,password:environment.DB_PASSWORD,database:environment.DB_NAME});
try {
 await db.execute("UPDATE campaigns SET deadline_at=DATE_ADD(NOW(), INTERVAL 30 DAY), phase='receiving_orders'");
 await db.execute("UPDATE campaigns SET art_front_url=?, art_back_url=NULL, art_render_mode='overlay', mockup_enabled=TRUE",['/uploads/'+artwork]);
 await db.execute("INSERT INTO users (name,email,password_hash,role,must_change_password) SELECT 'Troca obrigatória','change@example.test',password_hash,role,TRUE FROM users WHERE email='admin@teste.com'");
 // Configure only a loopback test SMTP address so the preview UI is available.
 // No test confirms delivery. Never inherit real SMTP configuration.
 Object.assign(environment,{SMTP_HOST:'127.0.0.1',SMTP_PORT:'4199',SMTP_USER:'fake',SMTP_PASSWORD:'fake',SMTP_FROM:'fake@example.test'});
} finally {await db.end();}
const provider=await startFakeInfinitePay(environment),api=startApi(environment);
try {await waitForApi(api.child,'http://127.0.0.1:4186');}
catch(error){console.error(api.output());await stopApi(api.child);provider.close();throw error;}
console.log('E2E pronto: API real, MySQL isolado, InfinitePay falso.');
let closing=false;
async function close(){if(closing)return;closing=true;await stopApi(api.child);provider.close(()=>process.exit(0));}
process.on('SIGTERM',close);process.on('SIGINT',close);
api.child.on('exit',code=>{if(!closing){console.error(api.output());provider.close();process.exitCode=code||1;}});
