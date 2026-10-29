import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { projectDirectory } from '../test-environment.mjs';
import { resetTestDatabase } from '../reset-test-database.mjs';

export function runNode(environment, script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd:projectDirectory, env:environment, encoding:'utf8', timeout:120000 });
  if (result.status !== 0) throw new Error(`Falha em ${script}: ${result.error?.message || ''}\n${result.stdout || ''}\n${result.stderr || ''}`);
  return result.stdout;
}
export async function prepareDatabase(environment) {
  await resetTestDatabase(environment);
  runNode(environment, 'api/migrate.mjs');
  runNode(environment, 'api/seed.mjs');
}
export function startApi(environment, script = 'api/server.mjs') {
  const child = spawn(process.execPath,[script],{cwd:projectDirectory,env:environment,stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data',chunk=>{output+=chunk;});
  child.stderr.on('data',chunk=>{output+=chunk;});
  return {child,output:()=>output};
}
export async function waitForApi(child, baseUrl) {
  const deadline=Date.now()+15000;
  while(Date.now()<deadline) {
    if(child.exitCode!==null) throw new Error('API terminou antes de ficar pronta.');
    try { const r=await fetch(`${baseUrl}/api/health`,{signal:AbortSignal.timeout(1000)}); if(r.ok)return r.json(); } catch { /* boot */ }
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw new Error('API de teste não ficou pronta em 15 segundos.');
}
export async function stopApi(child) {
  if(child.exitCode!==null)return;
  const exited=once(child,'exit'); child.kill('SIGTERM');
  let timer; await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(resolve,3000);})]); clearTimeout(timer);
  if(child.exitCode===null) { child.kill('SIGKILL'); await exited; }
}
