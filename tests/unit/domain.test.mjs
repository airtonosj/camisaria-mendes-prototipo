import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCouponDiscount, suggestedCampaignCode, normalizeCouponText } from '../../shared/domain.mjs';
import { validApiResponse } from '../../shared/response-contracts.mjs';
test('discount allocation preserves input order and resolves ties by variant and size',()=>{
 const items=[{variantId:2,size:'M',quantity:3,unitDiscountCents:1000},{variantId:1,size:'G',quantity:2,unitDiscountCents:1000},{variantId:3,size:'P',quantity:1,unitDiscountCents:1500}];
 assert.deepEqual(allocateCouponDiscount(items,4),[1,2,1]);
 assert.deepEqual(allocateCouponDiscount(items,0),[0,0,0]);
 assert.deepEqual(allocateCouponDiscount(items,null),[3,2,1]);
 assert.equal(items[0].quantity,3);
});
test('campaign code uses the same normalization and injected year',()=>{
 assert.equal(suggestedCampaignCode('Engenharia da Computação',2026),'MENDES-EC-26');
 assert.equal(suggestedCampaignCode('',2026),'MENDES-TURMA-26');
});
test('critical responses reject missing fields and invalid types, accept additive fields',()=>{
 assert.equal(validApiResponse('/orders','POST',{order:{number:'CM-1',totalCents:5000,paymentStatus:'pending',extra:true}}),true);
 for(const payload of [{},null,{order:{number:'CM-1',totalCents:'5000',paymentStatus:'pending'}}])assert.equal(validApiResponse('/orders','POST',payload),false);
 assert.equal(validApiResponse('/orders/CM-1/checkout','POST',{checkout:{url:'https://example.test',reused:false}}),true);
 assert.equal(validApiResponse('/campaigns/TEST','GET',{campaign:{code:'TEST'}}),false);
});

test("coupon normalization is shared without weakening server validation",()=>{
 assert.equal(normalizeCouponText("  turma  10 "),"TURMA-10");
 assert.equal(normalizeCouponText(null),"");
});
test('InfiniteTag is typed without the dollar sign and saved in the provider format',async()=>{
 const { normalizeInfinitePayHandle, validInfinitePayHandle } = await import('../../shared/receiver.mjs');
 assert.equal(normalizeInfinitePayHandle('$Camisaria Mendes'),'camisariamendes');
 assert.equal(normalizeInfinitePayHandle('  $$João_Conta.2 '),'joao_conta.2');
 assert.equal(normalizeInfinitePayHandle('conta-ção!@#'),'conta-cao');
 assert.equal(normalizeInfinitePayHandle(null),'');
 assert.equal(normalizeInfinitePayHandle('a'.repeat(80)).length,64);
 assert.equal(validInfinitePayHandle('camisariamendes'),true);
 assert.equal(validInfinitePayHandle('a'),false);
 assert.equal(validInfinitePayHandle('$conta'),false);
});
