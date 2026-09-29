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
