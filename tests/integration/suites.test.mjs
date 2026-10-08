import test from 'node:test';
import { execFileSync } from 'node:child_process';
for(const suite of ['smoke','receivers','receivers-migration','campaign-list','pickup-email','pickup-email-migration','startup-migrations','campaign-delivery']) {
  test(suite,{timeout:240000},()=>execFileSync(process.execPath,[`tests/${suite}.mjs`],{stdio:'inherit',timeout:230000}));
}
