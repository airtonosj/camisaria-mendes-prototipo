import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationDatabase, migrationsOnStart } from '../../api/migration-config.mjs';
import { startWorker } from '../../api/runtime/worker.mjs';
test('migration credentials are separate and validated',()=>{
 const original={user:'app',password:'app-secret'};
 assert.deepEqual(migrationDatabase(original,{}),original);
 assert.deepEqual(migrationDatabase(original,{MIGRATION_DB_USER:'migrator',MIGRATION_DB_PASSWORD:'test'}),{user:'migrator',password:'test'});
 assert.equal(original.user,'app');
 assert.throws(()=>migrationDatabase(original,{MIGRATION_DB_USER:'incomplete'}));
 assert.equal(migrationsOnStart({}),true); assert.equal(migrationsOnStart({MIGRATIONS_ON_START:'false'}),false);
 assert.throws(()=>migrationsOnStart({MIGRATIONS_ON_START:'typo'}));
});
test('stopping a worker drains active work and prevents later runs',async()=>{
 let release,calls=0;const work=new Promise(resolve=>{release=resolve;});
 const stop=startWorker(async()=>{calls++;await work;},5,()=>{});
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(calls,1);
 let drained=false;const stopping=stop().then(()=>{drained=true;});
 await Promise.resolve();assert.equal(drained,false);release();await stopping;
 await new Promise(resolve=>setTimeout(resolve,15));assert.equal(calls,1);
});
