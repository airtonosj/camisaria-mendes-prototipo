import { test, expect } from '@playwright/test';

test('orders workspace keeps paid defaults, one campaign selector and historical details', async ({ page }, testInfo) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol === 'data:' ? route.continue() : route.abort();
  });
  const order = (number, paymentStatus, status = 'active') => ({
    number, customer: { name: 'Comprador QA', whatsapp: '5598999994321', email: 'qa@example.test' },
    status, cancellationReason: status === 'cancelled' ? 'Cancelamento QA' : null,
    paymentStatus, paymentMethod: paymentStatus === 'pending' ? null : 'pix', deliveryStatus: 'waiting_campaign',
    totalCents: 9000, subtotalCents: 10000, discountCents: 1000, couponCode: ['QA-PAID', 'QA-PENDING', 'QA-CANCELLED'].includes(number) ? 'HISTORICO10' : null,
    createdAt: '2026-10-02T12:00:00Z', items: [{ modelName: 'Comum', color: { name: 'Preto', hex: '#111315' },
      size: 'M', sizeGroup: 'standard', quantity: 2, unitPriceCents: 5000, unitDiscountCents: 500,
      discountedQuantity: 2, lineTotalCents: 9000 }],
  });
  let partial = false;
  let longList = false;
  await page.route('**/api/admin/campaigns/*/orders', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    orders: longList ? Array.from({ length: 35 }, (_, i) => ({ ...order('QA-HISTORY-' + i, 'paid'), createdAt: new Date(Date.UTC(2026, 9, 2, 12) - i * 86400000).toISOString() })) : [order('QA-PAID', 'paid'), order('QA-PENDING', 'pending'), order('QA-CANCELLED', 'paid', 'cancelled'),
      ...(partial ? [order('QA-PARTIAL', 'partially_refunded')] : [])],
  }) }));
  await page.goto('/acesso-camisaria/');
  await page.locator('input[type=email]').fill('admin@teste.com');
  await page.locator('input[type=password]').fill('123456');
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/rota=admin/);
  await page.getByRole('button', { name: 'Pedidos', exact: true }).click();
  await page.mouse.move(1000, 100);
  const payment = page.getByLabel('Filtrar por pagamento');
  await expect(payment).toHaveValue('paid');
  await expect(page.locator('.campaign-orders-row')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Resumo de produção' })).toHaveCount(0);
  await expect(page.locator('.orders-campaign-summary')).toContainText('2 peças');
  await expect(page.locator('.orders-campaign-summary')).toContainText('1 pedidos pagos');
  await expect(page.locator('.orders-campaign-summary')).toContainText('1 pedido pago com cupom');
  await expect(page.locator('.orders-campaign-summary')).not.toContainText('Não disponível');
  const header = page.locator('.campaign-orders-head');
  await expect(header).toContainText('Valor pago');
  await expect(header).toContainText('Telefone');
  await expect(header).not.toContainText('Entrega');
  await expect(header).not.toContainText('Corte');
  await expect(header).not.toContainText('Cor');
  const paid = page.locator('.campaign-orders-row').filter({ hasText: '#QA-PAID' });
  await expect(paid).toContainText('HISTORICO10');
  await expect(paid).toContainText('R$ 90,00');
  await expect(paid.getByRole('button', { name: 'Registrar reembolso do pedido QA-PAID' })).toBeVisible();
  await payment.selectOption('all');
  await expect(page.locator('.campaign-orders-row')).toHaveCount(3);
  await expect(payment.locator('option[value=partially_refunded]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancelar pedido QA-PENDING' })).toBeVisible();
  await page.getByPlaceholder('Pedido, cliente ou telefone').fill('(98) 99999-4321');
  await expect(page.locator('.campaign-orders-row')).toHaveCount(3);
  await page.getByPlaceholder('Pedido, cliente ou telefone').fill('QA-PAID');
  await expect(page.locator('.campaign-orders-row')).toHaveCount(1);
  await paid.getByRole('button', { name: /QA-PAID/ }).first().click();
  const details = page.getByRole('dialog', { name: '#QA-PAID' });
  await expect(details).toBeVisible();
  await expect(details).toContainText('HISTORICO10');
  await expect(details).toContainText('R$ 90,00');
  await expect(details).toContainText('Preto');
  await page.screenshot({ path: `qa-evidence/orders-compact/popup-${testInfo.project.name}.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(details).toHaveCount(0);
  const launch = page.getByRole('button', { name: 'Selecionar campanha', exact: true });
  await expect(launch).toHaveCount(1);
  await launch.click();
  const picker = page.getByRole('dialog', { name: 'Selecionar campanha' });
  await expect(picker).toBeVisible();
  await page.getByLabel('Pesquisar campanha').fill('nao-existe-qa');
  await expect(picker).toContainText('Nenhuma campanha encontrada');
  await page.getByLabel('Pesquisar campanha').fill('MENDES-ENG-26');
  await page.getByLabel('Filtrar por fase').selectOption('completed');
  await expect(picker).toContainText('Nenhuma campanha encontrada');
  await page.getByLabel('Filtrar por fase').selectOption('all');
  await expect(picker.locator('.orders-campaign-list button')).toHaveCount(1);
  await page.screenshot({ path: `qa-evidence/orders-compact/picker-${testInfo.project.name}.png`, fullPage: true });
  partial = true;
  await picker.locator('.orders-campaign-list button').click();
  await expect(picker).not.toBeVisible();
  await expect(payment).toHaveValue('paid');
  await expect(page.getByPlaceholder('Pedido, cliente ou telefone')).toHaveValue('');
  await page.reload();
  await page.getByRole('button', { name: 'Pedidos', exact: true }).click();
  await page.mouse.move(1000, 100);
  await expect(payment.locator('option[value=partially_refunded]')).toHaveCount(1);
  await payment.selectOption('partially_refunded');
  await expect(page.locator('.campaign-orders-row')).toContainText('Atendimento manual');
  await payment.selectOption('paid');
  await page.screenshot({ path: `qa-evidence/orders-compact/workspace-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.ownerDocument.defaultView.innerWidth)).toBe(true);
  longList = true;
  await page.reload();
  await page.getByRole('button', { name: 'Pedidos', exact: true }).click();
  await page.mouse.move(1000, 100);
  await expect(page.locator('.campaign-orders-row')).toHaveCount(35);
  const list = page.getByRole('region', { name: 'Lista de pedidos da campanha' });
  expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await list.focus();
  await list.press('Control+End');
  const oldest = page.locator('.campaign-orders-row').filter({ hasText: '#QA-HISTORY-34' }).getByRole('button').first();
  await expect(oldest).toBeInViewport();
  await expect.poll(() => list.evaluate(el => Math.abs(el.querySelector('.campaign-orders-head').getBoundingClientRect().top - el.getBoundingClientRect().top))).toBeLessThanOrEqual(2);
  await oldest.click();
  await expect(page.getByRole('dialog', { name: '#QA-HISTORY-34' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `qa-evidence/orders-compact/history-${testInfo.project.name}.png`, fullPage: true });
});
