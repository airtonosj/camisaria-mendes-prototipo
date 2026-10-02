import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/acesso-camisaria/');
  await page.locator('input[type=email]').fill('admin@teste.com');
  await page.locator('input[type=password]').fill('123456');
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/rota=admin/);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol === 'data:'
      ? route.continue() : route.abort();
  });
});

test('panel exposes a server failure and recovers the real campaigns on retry and reload', async ({ page }, testInfo) => {
  let failures = 1;
  await page.route('**/api/admin/campaigns', route => failures-- > 0
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } }) })
    : route.continue());
  await login(page);
  await expect(page.getByRole('heading', { name: 'Não foi possível carregar os dados' })).toBeVisible();
  await expect(page.getByText('Erro interno do servidor.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sua produção em um só lugar.' })).toHaveCount(0);
  await page.screenshot({path:`qa-evidence/panel-review/load-failure-${testInfo.project.name}.png`,fullPage:true});
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sua produção em um só lugar.' })).toBeVisible();
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Campanhas da camisaria' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sua produção em um só lugar.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Não foi possível carregar os dados' })).toHaveCount(0);
  await page.screenshot({path:`qa-evidence/panel-review/load-recovered-${testInfo.project.name}.png`,fullPage:true});
});

test('panel never displays a successful empty overview when the campaign request loses its connection', async ({ page }) => {
  await page.route('**/api/admin/campaigns', route => route.abort('connectionreset'));
  await login(page);
  await expect(page.getByRole('heading', { name: 'Não foi possível carregar os dados' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sua produção em um só lugar.' })).toHaveCount(0);
  await page.unroute('**/api/admin/campaigns');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sua produção em um só lugar.' })).toBeVisible();
});

for (const scenario of [
  { name:'invalid JSON', body:'not JSON' },
  { name:'missing campaign array', body:JSON.stringify({}) },
  { name:'invalid totals', body:JSON.stringify({campaigns:[{code:'QA',title:'QA',phase:'production',deadlineAt:'2027-12-31',
    representative:{name:'QA'},orderCount:2,paidTotalCents:'invalid',canDelete:false}]}) },
]) test(`panel rejects HTTP 200 with ${scenario.name} and recovers`, async ({ page }) => {
  await page.route('**/api/admin/campaigns', route => route.fulfill({status:200,contentType:'application/json',body:scenario.body}));
  await login(page);
  await expect(page.getByRole('heading', {name:'Não foi possível carregar os dados'})).toBeVisible();
  await expect(page.getByText('O servidor retornou dados incompletos. Tente novamente.', {exact:true})).toBeVisible();
  await expect(page.getByRole('heading', {name:'Sua produção em um só lugar.'})).toHaveCount(0);
  await page.unroute('**/api/admin/campaigns');
  await page.getByRole('button', {name:'Tentar novamente',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Sua produção em um só lugar.'})).toBeVisible();
});

test('panel recovers after request timeout', async ({ page }) => {
  let release;
  const held = new Promise(resolve => {release=resolve;});
  await page.route('**/api/admin/campaigns', async route => {
    await held;
    try {await route.abort();} catch { /* The client has already aborted the timed-out request. */ }
  });
  try {
    await login(page);
    await expect(page.getByRole('heading', {name:'Não foi possível carregar os dados'})).toBeVisible();
    await expect(page.getByText('Não foi possível conectar ao servidor. Tente novamente.', {exact:true})).toBeVisible();
    release();
    await page.unroute('**/api/admin/campaigns');
    await page.getByRole('button', {name:'Tentar novamente',exact:true}).click();
    await expect(page.getByRole('heading', {name:'Sua produção em um só lugar.'})).toBeVisible();
  } finally {release();}
});
