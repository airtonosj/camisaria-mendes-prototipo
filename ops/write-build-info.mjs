import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
let commit='unknown',dirty=null;
try {
 commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 dirty=Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim());
} catch { /* Source archives have no Git metadata. */ }
await fs.writeFile('dist/version.json',JSON.stringify({commit,dirty,builtAt:new Date().toISOString()})+'\n');
