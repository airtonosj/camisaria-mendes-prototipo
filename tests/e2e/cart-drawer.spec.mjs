import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('cart drawer preserves items, keeps actions visible and hides its icon when empty', async ({ page }, testInfo) => {
  await page.goto('/?campanha=MENDES-ENG-26');
  const launcher = page.locator('.campaign-cart-launcher');
  const drawer = page.getByRole('dialog', { name: /Seu carrinho/ });
  await expect(launcher).toHaveCount(0);
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Aumentar quantidade no carrinho', exact: true }).click();
  await expect(drawer.getByRole('heading')).toHaveText('Seu carrinho (2)');
  await drawer.getByRole('button', { name: 'Continuar escolhendo', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(launcher).toHaveAccessibleName('Abrir carrinho, 2 peças');
  await page.reload();
  await expect(launcher).toHaveAccessibleName('Abrir carrinho, 2 peças');
  for (const size of ['M', 'G', 'GG']) {
    await page.locator('.campaign-size-options label').filter({ has: page.getByRole('radio', { name: size, exact: true }) }).click();
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: 'Continuar escolhendo', exact: true }).click();
  }
  await launcher.click();
  await expect(drawer.getByRole('heading')).toHaveText('Seu carrinho (5)');
  await drawer.locator('.campaign-drawer-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const viewport = page.viewportSize();
  for (const name of ['Revisar pedido', 'Continuar escolhendo']) {
    const button = drawer.getByRole('button', { name, exact: true });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  await fs.mkdir('qa-evidence/cart-drawer', { recursive: true });
  await page.screenshot({ path: `qa-evidence/cart-drawer/drawer-${testInfo.project.name}.png` });
  await drawer.getByRole('button', { name: 'Fechar carrinho' }).press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(launcher).toBeFocused();
  await page.screenshot({ path: `qa-evidence/cart-drawer/icon-${testInfo.project.name}.png` });
  await launcher.click();
  await drawer.getByRole('button', { name: 'Revisar pedido', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revise e identifique' })).toBeVisible();
  await expect(page.locator('.checkout-total')).toContainText('5 peças');
  await page.getByRole('button', { name: 'Editar carrinho' }).click();
  await launcher.click();
  while (await drawer.getByRole('button', { name: 'Remover', exact: true }).count()) {
    await drawer.getByRole('button', { name: 'Remover', exact: true }).first().click();
  }
  await expect(drawer.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible();
  await drawer.getByRole('button', { name: 'Continuar escolhendo', exact: true }).click();
  await expect(launcher).toHaveCount(0);
});

