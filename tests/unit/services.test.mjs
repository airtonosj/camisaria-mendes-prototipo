import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { validateActiveCoupon } from '../../api/modules/coupons/service.mjs';

test('expired, unavailable and exhausted coupons retain their errors',async()=>{
 for(const [rows,code] of [[[],'COUPON_NOT_FOUND'],[[{id:1,expires_at:'2000-01-01',usage_limit:null}],'COUPON_EXPIRED'],[[{id:1,expires_at:null,usage_limit:1}],'COUPON_EXHAUSTED']]){
  let calls=0;const executor={execute:async()=>[calls++===0?rows:[{used_count:1}]]};
  await assert.rejects(validateActiveCoupon(executor,1,'TEST'),error=>error.code===code);
 }
});
test('service imports finish without opening servers or starting timers',()=>{
 const domains=['account','campaigns','coupons','orders','reports','media'];
 execFileSync(process.execPath,['--input-type=module','-e',domains.map(domain=>`await import('./api/modules/${domain}/service.mjs');`).join('\n')],{timeout:20000,stdio:'pipe'});
});
