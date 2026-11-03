import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testEnvironment } from './test-environment.mjs';
import { prepareDatabase } from './helpers/environment.mjs';

const env = testEnvironment();
await prepareDatabase(env);
Object.assign(process.env, env);
const { pool } = await import('../api/database.mjs');
const campaigns = await import('../api/modules/campaigns/service.mjs');
const orders = await import('../api/modules/orders/service.mjs');

try {
  const seed = await campaigns.getCampaign('MENDES-ENG-26');
  const groups = new Map();
  for (const variant of seed.variants) {
    const group = groups.get(variant.model.code) ?? { model: variant.model, colors: new Map(), sizes: [] };
    group.colors.set(variant.color.name, variant.color);
    groups.set(variant.model.code, group);
  }
  for (const size of seed.sizes) groups.get(size.model.code)?.sizes.push(size.code);
  const [modelA, modelB] = [...groups.values()].filter(group => group.colors.size >= 2 && group.sizes.length >= 2);
  const anotherModel = [...groups.values()].find(group => group.model.code !== modelA?.model.code && group.colors.size >= 1 && group.sizes.length >= 1);
  assert.ok(modelA && modelB && anotherModel, 'o banco de teste precisa ter dois cortes com tamanhos e cores para cobrir o estoque por SKU');

  const colorsA = [...modelA.colors.values()].slice(0, 2);
  const colorsB = [...anotherModel.colors.values()].slice(0, 1);
  const sizesA = [...new Set(modelA.sizes)].slice(0, 2);
  const sizesB = [...new Set(anotherModel.sizes)].slice(0, 1);
  const skuStocks = [
    ...colorsA.flatMap(color => sizesA.map(sizeCode => ({ modelCode: modelA.model.code, colorName: color.name, sizeCode, quantity: color.name === colorsA[1].name && sizeCode === sizesA[1] ? 2 : 1 }))),
    ...colorsB.flatMap(color => sizesB.map(sizeCode => ({ modelCode: anotherModel.model.code, colorName: color.name, sizeCode, quantity: 1 }))),
  ];
  const body = {
    code: `MENDES-STOCK-${randomUUID().slice(0, 8)}`.toUpperCase(), title: 'Estoque público QA', isPublic: true,
    deadlineAt: '2027-12-31T23:59:59Z', pickupInstructions: 'Retirada com o representante',
    representative: { name: 'Representante QA', whatsapp: '98999990000' },
    artFrontUrl: '/uploads/00000000-0000-4000-8000-000000000001.png',
    presentationConfig: { mockupEnabled: true, realPhotosEnabled: false },
    models: [
      { modelCode: modelA.model.code, unitPriceCents: 5000, colors: colorsA, sizes: sizesA },
      { modelCode: anotherModel.model.code, unitPriceCents: 6000, colors: colorsB, sizes: sizesB },
    ],
    skuStocks,
  };
  const [[staff]] = await pool.execute('SELECT id FROM users LIMIT 1');
  await assert.rejects(campaigns.createCampaign({ staff, body: { ...body, code: `${body.code}-MISSING`, skuStocks: undefined } }), error => error.code === 'SKU_STOCK_REQUIRED');
  const created = await campaigns.createCampaign({ staff, body });
  const detail = await campaigns.getCampaign(body.code);
  assert.equal(detail.skuStocks.length, skuStocks.length);
  assert.ok(detail.skuStocks.every(stock => stock.stockLimit !== null && stock.remaining === stock.stockLimit));

  const stockFor = (modelCode, colorName, sizeCode) => {
    const stock = created.skuStocks.find(item => item.modelCode === modelCode && item.colorName === colorName && item.sizeCode === sizeCode);
    const variant = created.variants.find(item => item.model.code === modelCode && item.color.name === colorName);
    return stock && variant ? { ...stock, variantId: variant.id } : null;
  };
  const [raceSku, secondSizeSku, otherColorSku, quantitySku, otherCutSku] = [
    stockFor(modelA.model.code, colorsA[0].name, sizesA[0]),
    stockFor(modelA.model.code, colorsA[0].name, sizesA[1]),
    stockFor(modelA.model.code, colorsA[1].name, sizesA[0]),
    stockFor(modelA.model.code, colorsA[1].name, sizesA[1]),
    stockFor(anotherModel.model.code, colorsB[0].name, sizesB[0]),
  ];
  assert.ok([raceSku, secondSizeSku, otherColorSku, quantitySku, otherCutSku].every(Boolean));
  const orderBody = sku => ({
    campaignCode: body.code,
    customer: { name: 'Cliente QA', whatsapp: '98999990000', email: 'stock@example.test' },
    items: [{ variantId: sku.variantId, size: sku.sizeCode, quantity: 1 }],
  });
  const concurrent = await Promise.allSettled([
    orders.createOrder({ idempotencyKey: randomUUID(), body: orderBody(raceSku) }),
    orders.createOrder({ idempotencyKey: randomUUID(), body: orderBody(raceSku) }),
  ]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1, 'a trava da campanha deve permitir só um pedido para a última peça');
  const raceOrder = concurrent.find(result => result.status === 'fulfilled').value.order;
  const rejectedRace = concurrent.find(result => result.status === 'rejected').reason;
  assert.equal(rejectedRace.code, 'SKU_SOLD_OUT');

  for (const sku of [secondSizeSku, otherColorSku, otherCutSku]) {
    await orders.createOrder({ idempotencyKey: randomUUID(), body: orderBody(sku) });
  }
  const quantityOrderBody = orderBody(quantitySku);
  quantityOrderBody.items[0].quantity = 2;
  const quantityOrder = await orders.createOrder({ idempotencyKey: randomUUID(), body: quantityOrderBody });
  await assert.rejects(orders.createOrder({ idempotencyKey: randomUUID(), body: orderBody(quantitySku) }), error => error.code === 'SKU_SOLD_OUT');
  await assert.rejects(campaigns.updateCampaign({ body: { skuStocks: skuStocks.map(stock => ({ ...stock, quantity: stock.modelCode === modelA.model.code && stock.colorName === colorsA[1].name && stock.sizeCode === sizesA[1] ? 1 : stock.quantity })) } }, body.code), error => error.code === 'STOCK_BELOW_RESERVED');

  const catalog = await campaigns.publicCampaignCatalog({ search: body.code });
  assert.equal(catalog.campaigns[0].stockConfigured, true);
  assert.equal(catalog.campaigns[0].soldOut, true);
  const listed = (await campaigns.listCampaigns()).find(campaign => campaign.code === body.code);
  assert.equal(listed.skuStocks.find(stock => stock.colorName === colorsA[0].name && stock.sizeCode === sizesA[0]).unitsReserved, 1);
  assert.equal(listed.skuStocks.find(stock => stock.colorName === colorsA[1].name && stock.sizeCode === sizesA[1]).unitsReserved, 2);

  await pool.execute("UPDATE orders SET status = 'cancelled' WHERE order_number = ?", [raceOrder.order_number]);
  const afterCancellation = await campaigns.publicCampaignCatalog({ search: body.code });
  assert.equal(afterCancellation.campaigns[0].soldOut, false, 'cancelamento libera o SKU e reabre a campanha enquanto houver estoque');
  const afterCancelDetail = await campaigns.getCampaign(body.code);
  assert.equal(afterCancelDetail.skuStocks.find(stock => stock.colorName === colorsA[0].name && stock.sizeCode === sizesA[0]).remaining, 1);
  assert.ok(quantityOrder.created);
  console.log('✓ Estoque público por corte, cor e tamanho: validação, concorrência, limite, esgotamento, edição e liberação no cancelamento.');
} finally {
  await pool.end();
}
