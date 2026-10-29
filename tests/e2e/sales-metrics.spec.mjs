import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/acesso-camisaria/');
  await page.locator('input[type=email]').fill('admin@teste.com');
  await page.locator('input[type=password]').fill('123456');
  await page.getByRole('button', { name: /Entrar/ }).click();
}

test('metrics panel loads, changes period and applies a custom range', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Métricas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Onde as vendas param.' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Funil de compra/ })).toBeVisible();
  await page.getByRole('button', { name: 'Este ano', exact: true }).click();
  await expect(page.getByText('Pedidos pagos', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Personalizado', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Escolher período' })).toBeVisible();
  const dates = page.locator('dialog input[type=date]');
  await dates.nth(0).fill('2026-10-01');
  await dates.nth(1).fill('2026-10-13');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByRole('button', { name: /out\./ })).toBeVisible();
});
