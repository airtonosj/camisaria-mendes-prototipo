import test from 'node:test';
import { execFileSync } from 'node:child_process';
for(const suite of ['contact-validation','license-token']) {
  test(suite,()=>execFileSync(process.execPath,[`tests/${suite}.mjs`],{stdio:'pipe',timeout:30000}));
}
