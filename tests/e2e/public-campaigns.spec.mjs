import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import { testEnvironment } from '../test-environment.mjs';

test('public campaigns use the sale photo, appear in navigation and remain crawlable', async ({ page, request }, testInfo) => {
  test.setTimeout(90000);
  const env = testEnvironment();
  const name = env.DB_NAME.replace(/_test$/, '_e2e_test');
  const uploads = path.join(path.dirname(path.dirname(env.UPLOADS_DIR)), name, 'uploads');
  const photoName = '22222222-2222-4222-8222-222222222222.webp';
  const db = await mysql.createConnection({ host: env.DB_HOST, port: +env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: name });
  try {
    await fs.copyFile('assets/showcase-lex-justitia.webp', path.join(uploads, photoName));
    const [[campaign]] = await db.execute("SELECT id FROM campaigns WHERE code='MENDES-ENG-26'");
    const [colors] = await db.execute('SELECT DISTINCT color_id FROM campaign_variants WHERE campaign_id=? AND active=TRUE', [campaign.id]);
    await db.execute("UPDATE campaigns SET is_public=TRUE, real_photos_enabled=TRUE WHERE code='MENDES-ENG-26'");
    await db.execute("UPDATE campaigns SET is_public=TRUE WHERE code='MENDES-ADS-26'");
    for (const color of colors) await db.execute('INSERT INTO campaign_color_photos (campaign_id, color_id, photo_url, sort_order) VALUES (?, ?, ?, 0)', [campaign.id, color.color_id, `/uploads/${photoName}`]);

    const catalog = await request.get('/api/campaigns/public');
    expect(catalog.ok()).toBe(true);
    expect((await catalog.json()).campaigns.find((item) => item.code === 'MENDES-ENG-26').imageUrl).toBe(`/uploads/${photoName}`);
    const html = await (await request.get('/campanhas')).text();
    expect(html).toContain('href="http://127.0.0.1:4186/?campanha=MENDES-ENG-26"');
    expect((await (await request.get('/sitemap.xml')).text())).toContain('MENDES-ENG-26');

    await page.goto('/');
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(page.getByRole('link', { name: 'Campanhas', exact: true }).first()).toBeVisible();
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Fechar menu' }).click();
    await expect(page.locator('.public-campaign-home .public-campaign-card')).toHaveCount(2);
    const firstImage = page.locator('.public-campaign-home .public-campaign-card').filter({ hasText: 'Engenharia Civil' }).locator('img');
    await expect(firstImage).toHaveAttribute('src', new RegExp(photoName));
    await expect(firstImage).toBeVisible();
    await page.locator('img').evaluateAll(async (images) => { images.forEach((image) => { image.loading = 'eager'; }); await Promise.race([Promise.all(images.map((image) => image.decode().catch(() => {}))), new Promise((resolve) => setTimeout(resolve, 5000))]); });
    await page.screenshot({ path: `qa-evidence/public-campaign-preview/implemented-home-${testInfo.project.name}.png`, fullPage: true });

    await page.goto('/campanhas');
    await expect(page.locator('.public-campaign-grid .public-campaign-card')).toHaveCount(2);
    await page.locator('img').evaluateAll(async (images) => { images.forEach((image) => { image.loading = 'eager'; }); await Promise.race([Promise.all(images.map((image) => image.decode().catch(() => {}))), new Promise((resolve) => setTimeout(resolve, 5000))]); });
    await page.screenshot({ path: `qa-evidence/public-campaign-preview/implemented-list-${testInfo.project.name}.png`, fullPage: true });

    await page.goto('/acesso-camisaria/');
    await page.locator('input[type=email]').fill('admin@teste.com');
    await page.locator('input[type=password]').fill('123456');
    await page.getByRole('button', { name: /Entrar/ }).click();
    await expect(page).toHaveURL(/rota=admin/);
    await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
    await page.mouse.move(1000, 100);
    await page.locator('.campaign-admin-card').filter({ hasText: 'MENDES-ENG-26' }).locator('.campaign-card-action--edit').click();
    const switchControl = page.getByRole('switch', { name: 'Exibir no site público' });
    await expect(switchControl).toBeChecked();
    await page.screenshot({ path: `qa-evidence/public-campaign-preview/implemented-panel-${testInfo.project.name}.png`, fullPage: true });
    await switchControl.uncheck();
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    const saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().endsWith('/api/admin/campaigns/MENDES-ENG-26'));
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    expect((await saved).status()).toBe(200);
    expect((await (await request.get('/api/campaigns/public')).json()).campaigns.some((item) => item.code === 'MENDES-ENG-26')).toBe(false);
  } finally {
    await db.execute('DELETE FROM campaign_color_photos WHERE photo_url=?', [`/uploads/${photoName}`]);
    await db.execute("UPDATE campaigns SET is_public=FALSE, real_photos_enabled=FALSE WHERE code IN ('MENDES-ENG-26','MENDES-ADS-26')");
    await db.end();
  }
});
