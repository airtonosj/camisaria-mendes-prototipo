import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { testEnvironment } from '../test-environment.mjs';
const env = testEnvironment();
async function database(work) {
  const c = await mysql.createConnection({ host: env.DB_HOST, port: +env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME.replace(/_test$/, '_e2e_test') });
  try { return await work(c); } finally { await c.end(); }
}
async function login(page) {
  await page.goto('/acesso-camisaria/');
  await page.locator('input[type=email]').fill('admin@teste.com');
  await page.locator('input[type=password]').fill('123456');
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/rota=admin/);
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
}
test('delivery forecast is editable, shown under the desktop image, grouped in review and tracked with its purchase date', async ({ page, request }, testInfo) => {
  const code = 'MENDES-ENG-26';
  const [[original]] = await database(c => c.execute("SELECT DATE_FORMAT(delivery_expected_on, '%Y-%m-%d') AS expected, delivery_note FROM campaigns WHERE code=?", [code]));
  const note = 'Camisas entregues ao representante de turma';
  await fs.mkdir('qa-evidence/campaign-delivery', { recursive: true });
  try {
    await login(page);
    await page.mouse.move(1000, 100);
    await page.locator('.campaign-admin-card').filter({ hasText: code }).locator('.campaign-card-action--edit').click();
    await page.getByLabel('Entrega prevista (opcional)', { exact: true }).fill('2026-11-10');
    await page.getByLabel('Observação sobre a entrega (opcional)', { exact: true }).fill(note);
    await expect(page.getByText('Data prevista para disponibilizar', { exact: false })).toHaveCount(0);
    await page.screenshot({ path: `qa-evidence/campaign-delivery/form-${testInfo.project.name}.png`, fullPage: true });
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.locator('.campaign-step--review')).toContainText('Entrega prevista para 10 de novembro');
    const saved = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith(`/api/admin/campaigns/${code}`));
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    expect((await saved).status()).toBe(200);
    const campaign = (await (await request.get(`/api/campaigns/${code}`)).json()).campaign;
    expect(campaign.deliveryExpectedOn).toBe('2026-11-10');
    expect(campaign.deliveryNote).toBe(note);
    await page.goto(`/?campanha=${code}`);
    const display = page.locator(testInfo.project.name === 'desktop' ? '.campaign-delivery-desktop' : '.campaign-delivery-mobile');
    await expect(display).toBeVisible();
    await expect(display).toContainText('Entrega prevista para 10 de novembro');
    await expect(display).not.toContainText('2026');
    if (testInfo.project.name === 'desktop') {
      const image = await page.locator('.campaign-media-carousel').boundingBox();
      const info = await display.boundingBox();
      expect(info.y).toBeGreaterThanOrEqual(image.y + image.height);
      expect(Math.abs(info.x - image.x)).toBeLessThan(2);
    }
    await page.screenshot({ path: `qa-evidence/campaign-delivery/choose-${testInfo.project.name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await page.getByRole('dialog', { name: /Seu carrinho/ }).getByRole('button', { name: 'Revisar pedido', exact: true }).click();
    const group = page.locator('.checkout-order-review .campaign-delivery-info');
    await expect(group).toContainText(note);
    expect(await group.locator(':scope > div').count()).toBe(3);
    expect(await group.locator(':scope > div').evaluateAll(rows => rows.every(row => globalThis.getComputedStyle(row).borderTopWidth === '0px' && globalThis.getComputedStyle(row).borderBottomWidth === '0px'))).toBe(true);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: `qa-evidence/campaign-delivery/review-${testInfo.project.name}.png`, fullPage: true });
    const variant = campaign.variants[0];
    const response = await request.post('/api/orders', { headers: { 'Idempotency-Key': randomUUID() }, data: { campaignCode: code, customer: { name: 'Entrega QA', whatsapp: '98999990000', email: 'delivery@example.test' }, items: [{ variantId: variant.id, size: campaign.sizes.find(s => s.model.code === variant.model.code).code, quantity: 1 }] } });
    expect(response.status()).toBe(201);
    const number = (await response.json()).order.number;
    await database(c => c.execute('UPDATE campaigns SET delivery_expected_on=? WHERE code=?', ['2026-11-15', code]));
    await page.goto(`/acompanhar-pedido/?pedido=${number}`);
    await page.locator('#tracking-phone').fill('98999990000');
    await page.getByRole('button', { name: 'Consultar pedido', exact: false }).click();
    const tracked = page.locator('.received-order-card .campaign-delivery-info');
    await expect(tracked).toContainText('Entrega prevista para 15 de novembro');
    await expect(tracked).toContainText('Previsão atualizada. Na compra: 10 de novembro.');
    await page.screenshot({ path: `qa-evidence/campaign-delivery/tracking-${testInfo.project.name}.png`, fullPage: true });
    await database(c => c.execute('UPDATE campaigns SET delivery_expected_on=NULL, delivery_note=NULL WHERE code=?', [code]));
    await page.goto(`/?campanha=${code}`);
    await expect(display).toContainText('Entrega prevista a definir');
  } finally {
    await database(c => c.execute('UPDATE campaigns SET delivery_expected_on=?, delivery_note=? WHERE code=?', [original.expected, original.delivery_note, code]));
  }
});

test('new campaign draft restores its optional delivery fields', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).click();
  await page.getByLabel('Entrega prevista (opcional)', { exact: true }).fill('2026-11-10');
  await page.getByLabel('Observação sobre a entrega (opcional)', { exact: true }).fill('Camisas entregues ao representante de turma');
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).click();
  await expect(page.getByLabel('Entrega prevista (opcional)', { exact: true })).toHaveValue('2026-11-10');
  await expect(page.getByLabel('Observação sobre a entrega (opcional)', { exact: true })).toHaveValue('Camisas entregues ao representante de turma');
});
