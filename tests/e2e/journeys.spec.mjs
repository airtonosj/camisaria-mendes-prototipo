import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import { testEnvironment } from '../test-environment.mjs';
const env=testEnvironment();
async function database(work){const c=await mysql.createConnection({host:env.DB_HOST,port:+env.DB_PORT,user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME.replace(/_test$/,'_e2e_test')});try{return await work(c);}finally{await c.end();}}
async function login(page,email='admin@teste.com'){
 await page.goto('/acesso-camisaria/');await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill('123456');await page.getByRole('button',{name:/Entrar/}).click();await expect(page).toHaveURL(/rota=admin/);
}
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='checkout.infinitepay.io')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<h1>Checkout fictício</h1>'});return ['127.0.0.1','localhost'].includes(url.hostname)||url.protocol==='data:'?route.continue():route.abort();});
});
test('checkout requires the name, creates one order, resumes and tracks it',async({page,request},testInfo)=>{
 await page.goto('/?campanha=MENDES-ENG-26');
 await page.getByRole('button',{name:'Adicionar',exact:true}).click();
 await page.getByRole('button',{name:'Revisar pedido'}).click();
 const name=page.getByRole('textbox',{name:'Nome completo'});await expect(name).toBeVisible();
 await page.getByPlaceholder('WhatsApp com DDD').fill('98999991234');await page.getByPlaceholder('E-mail para confirmação').fill('buyer@example.test');
 await page.getByRole('button',{name:/Ir para pagamento/}).click();await expect(name).toBeVisible();
 expect(await name.evaluate(el=>el.validity.valueMissing)).toBe(true);
 await name.fill('Comprador de teste');await page.getByRole('button',{name:/Ir para pagamento/}).click();
 const created=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/orders'));
 await page.getByRole('button',{name:/Pagar|pagamento/i}).last().click();
 const response=await created;expect(response.status()).toBe(201);const {order}=await response.json();
 await expect(page.getByRole('heading',{name:'Checkout fictício'})).toBeVisible();
 const result=await request.get(`/api/orders/${order.number}?whatsapp=98999991234`);expect(result.ok()).toBe(true);expect((await result.json()).order.paymentStatus).toBe('pending');
 await page.goto(`/?campanha=MENDES-ENG-26&retomar=${order.number}`);await expect(page.getByText('Retomando o pagamento do pedido',{exact:false})).toBeVisible();
 await page.getByPlaceholder('WhatsApp com DDD').fill('98999991234');
 await page.screenshot({path:`qa-evidence/structure/after/resume-${testInfo.project.name}.png`,fullPage:true});
 const checkout=page.waitForResponse(r=>r.url().endsWith('/checkout'));await page.getByRole('button',{name:/Pagar|pagamento/i}).last().click();expect((await checkout).ok()).toBe(true);
 await expect(page.getByRole('heading',{name:'Checkout fictício'})).toBeVisible();
 await page.goto(`/?rota=acompanhar-pedido&pedido=${order.number}`);await page.locator('input[type=tel]').fill('98999991234');await page.getByRole('button',{name:/Consultar|Acompanhar/}).click();await expect(page.getByText(order.number,{exact:false}).first()).toBeVisible();
});
test('staff login and required password change preserve access restrictions',async({page})=>{
 await login(page,'change@example.test');await expect(page.getByText(/senha provisória/i).first()).toBeVisible();
 await expect(page.getByRole('region',{name:'Dados de acesso'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Campanhas',exact:true})).toBeDisabled();
});
test('campaign editor loads existing data and preserves its code when saving',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Campanhas',exact:false}).first().click();
 await page.mouse.move(1000,100);
 await page.getByRole('button',{name:'Editar',exact:true}).first().click();
 const title=page.getByLabel('Nome da campanha');await expect(title).toBeVisible();const original=await title.inputValue();
 await title.fill(original+' QA');
 await page.getByRole('button',{name:/Revisão/}).click();
 const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/api/admin/campaigns/'));
 await page.getByRole('button',{name:/Salvar alterações/}).click();expect((await saved).ok()).toBe(true);
});
test('public page does not request administrative modules',async({page})=>{
 const scripts=[];page.on('request',r=>{if(r.resourceType()==='script')scripts.push(r.url());});
 await page.goto('/');await expect(page.locator('main')).toBeVisible();
 expect(scripts.some(url=>/AdminDashboard|Campaigns-|Orders-|Reports-/.test(url))).toBe(false);
});

test('delivery report marks an order delivered and keeps it after reload',async({page,request})=>{
 const campaign=(await (await request.get('/api/campaigns/MENDES-ENG-26')).json()).campaign;
 const response=await request.post('/api/orders',{headers:{'Idempotency-Key':crypto.randomUUID()},data:{campaignCode:campaign.code,customer:{name:'Entrega QA',whatsapp:'98999991234',email:'delivery@example.test'},items:[{variantId:campaign.variants[0].id,size:campaign.sizes.find(s=>s.model.code===campaign.variants[0].model.code).code,quantity:1}]}});
 expect(response.status()).toBe(201);
 const {order}=await response.json();
 await database(async c=>{
  await c.execute("UPDATE orders SET payment_status='paid',delivery_status='ready' WHERE order_number=?",[order.number]);
  await c.execute("UPDATE campaigns SET phase='ready_for_delivery' WHERE code=?",[campaign.code]);
 });
 try {
  await login(page);
  await page.getByRole('button',{name:'Relatórios',exact:true}).click();
  await page.getByRole('tab',{name:/Entrega/}).click();
  await page.getByPlaceholder('Nome ou número do pedido').fill(order.number);
  const row=page.locator('.delivery-report-row').filter({hasText:order.number});
  await expect(row.getByRole('button',{name:'Marcar entregue',exact:true})).toBeEnabled();
  // A saved delivery must remain visible even when the following report refresh fails.
  await page.route('**/api/admin/reports/production*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Falha de atualização simulada'}})}));
  const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().endsWith(`/orders/${order.number}/delivery`));
  const refresh=page.waitForResponse(r=>r.url().includes('/api/admin/reports/production')&&r.status()===503);
  await row.getByRole('button',{name:'Marcar entregue',exact:true}).click();
  expect((await saved).status()).toBe(200);
  await refresh;
  await expect(row.getByRole('button',{name:'Entregue',exact:true})).toBeDisabled();
  await database(async c=>{
   const [[stored]]=await c.execute('SELECT delivery_status,delivered_at FROM orders WHERE order_number=?',[order.number]);
   expect(stored.delivery_status).toBe('delivered');expect(stored.delivered_at).toBeTruthy();
   const [[history]]=await c.execute('SELECT COUNT(*) AS total FROM delivery_history h JOIN orders o ON o.id=h.order_id WHERE o.order_number=? AND h.next_status=?',[order.number,'delivered']);
   expect(history.total).toBe(1);
  });
  await page.unroute('**/api/admin/reports/production*');
  await page.reload();
  await page.getByRole('button',{name:'Relatórios',exact:true}).click();
  await page.getByRole('tab',{name:/Entrega/}).click();
  await page.getByPlaceholder('Nome ou número do pedido').fill(order.number);
  await expect(row.getByRole('button',{name:'Entregue',exact:true})).toBeDisabled();
 } finally {await database(c=>c.execute("UPDATE campaigns SET phase='receiving_orders' WHERE code=?",[campaign.code]));}
});
test('pickup preview never queues notifications',async({page,request})=>{
 // Prepare a fictional eligible order through the API; no notification is sent.
 const campaign=(await (await request.get('/api/campaigns/MENDES-ENG-26')).json()).campaign;
 const orderResponse=await request.post('/api/orders',{headers:{'Idempotency-Key':crypto.randomUUID()},data:{campaignCode:campaign.code,customer:{name:'Retirada QA',whatsapp:'98999991234',email:'pickup@example.test'},items:[{variantId:campaign.variants[0].id,size:campaign.sizes.find(s=>s.model.code===campaign.variants[0].model.code).code,quantity:1}]}});
 const {order}=await orderResponse.json();expect(order).toBeTruthy();
 const count=()=>database(async c=>{const [[row]]=await c.query("SELECT COUNT(*) AS total FROM order_email_notifications WHERE notification_type='pickup_ready'");return row.total;});
 await database(async c=>{await c.execute("UPDATE orders SET payment_status='paid',delivery_status='ready' WHERE order_number=?",[order.number]);await c.execute("DELETE FROM order_email_notifications WHERE notification_type='payment_confirmed'");await c.execute("UPDATE campaigns SET phase='ready_for_delivery' WHERE code=?",[campaign.code]);});
 try {
 const before=await count();await login(page);await page.getByRole('button',{name:'Pedidos',exact:false}).first().click();
 await page.mouse.move(1000,100);
 await page.locator('.orders-campaign-list button').filter({hasText:campaign.title}).click();
 await page.getByRole('button',{name:'Avisar compradores',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('dialog').locator('input[type=url]').fill('https://chat.whatsapp.com/Abcdefghijklmnop');
 await page.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(page.getByRole('button',{name:'Enviar e-mails'})).toBeVisible();expect(await count()).toBe(before);
 } finally {await database(c=>c.execute("UPDATE campaigns SET phase='receiving_orders' WHERE code=?",[campaign.code]));}
});

test('campaign creation completes all four editor steps',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Campanhas',exact:true}).click();
 await page.mouse.move(1000,100);
 await page.getByRole('button',{name:'Nova campanha',exact:true}).click();
 const title=`Campanha QA ${Date.now()}`;
 await page.getByLabel('Nome da campanha').fill(title);
 await page.getByText('Opções avançadas',{exact:true}).click();
 await page.getByLabel(/^Código da campanha/).fill('MENDES-QA-'+Date.now());
 await page.getByLabel('Representante da turma').fill('Representante QA');
 await page.getByLabel('WhatsApp do representante').fill('98999991234');
 await page.getByLabel('Prazo final dos pedidos').fill(new Date(Date.now()+30*86400000).toISOString().slice(0,10));
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByRole('button',{name:'Mockup Monte a estampa sobre a camisa.'}).click();
 const buffer=await sharp({create:{width:600,height:400,channels:4,background:{r:0,g:120,b:200,alpha:0.5}}}).png().toBuffer();
 await page.getByLabel('Enviar frente',{exact:true}).setInputFiles({name:'qa-art.png',mimeType:'image/png',buffer});
 await expect(page.getByRole('img',{name:'Prévia de frente',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 const created=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/admin/campaigns'));
 await expect(page.getByRole('button',{name:'Publicar campanha',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Publicar campanha',exact:true}).click();
 const response=await created;expect(response.status()).toBe(201);
 expect((await response.json()).campaign.title).toBe(title);
});

test('payment receiver is registered in the account tab and chosen for a campaign',async({page},testInfo)=>{
 const project=testInfo.project.name;
 await login(page);await page.getByRole('button',{name:'Conta',exact:true}).first().click();
 const card=page.getByRole('region',{name:'Recebedores de pagamento'});await expect(card).toBeVisible();
 await card.getByRole('button',{name:'Novo recebedor'}).click();
 const dialog=page.getByRole('dialog',{name:'Novo recebedor'});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByLabel('Nome completo')).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(card.getByRole('button',{name:'Novo recebedor'})).toBeFocused();
 await card.getByRole('button',{name:'Novo recebedor'}).click();
 await dialog.getByLabel('Nome completo').fill(`Recebedor ${project}`);
 await dialog.getByLabel('Telefone').fill('98988881234');
 const tag=dialog.getByLabel(/InfiniteTag/);
 await tag.pressSequentially(`$Camisaria ${project}`);
 await expect(tag).toHaveValue(`camisaria${project}`);
 await dialog.getByRole('button',{name:'Salvar recebedor'}).click();
 await expect(card.getByText(`$camisaria${project}`,{exact:false}).first()).toBeVisible();
 await page.screenshot({path:`qa-evidence/account-compact/confirm-${project}.png`,fullPage:true});
 const created=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/admin/receivers'));
 await dialog.getByRole('button',{name:'Confirmar e salvar'}).click();expect((await created).status()).toBe(201);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(card.getByText('Recebedor cadastrado.')).toBeVisible();
 await expect(card.getByRole('listitem').filter({hasText:`Recebedor ${project}`})).toContainText(`$camisaria${project}`);
 const row=card.getByRole('listitem').filter({hasText:`Recebedor ${project}`});
 await expect(row.getByRole('button',{name:`Editar Recebedor ${project}`})).toHaveText('edit');
 await expect(row.getByRole('button',{name:`Remover Recebedor ${project}`})).toHaveText('delete');
 await row.getByRole('button',{name:`Editar Recebedor ${project}`}).click();
 await expect(page.getByRole('dialog',{name:'Editar recebedor'}).getByLabel('Nome completo')).toHaveValue(`Recebedor ${project}`);
 await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click();
 await row.getByRole('button',{name:`Remover Recebedor ${project}`}).click();
 await expect(page.getByRole('dialog')).toContainText('histórico serão preservados');
 const deactivated=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/api/admin/receivers/'));
 await page.getByRole('dialog').getByRole('button',{name:'Desativar recebedor'}).click();
 expect((await deactivated).ok()).toBe(true);
 await expect(row).toContainText('desativado');
 const reactivated=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/api/admin/receivers/'));
 await row.getByRole('button',{name:`Reativar Recebedor ${project}`}).click();
 expect((await reactivated).ok()).toBe(true);
 await expect(row).not.toContainText('desativado');
 expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth)).toBe(true);
 await page.screenshot({path:`qa-evidence/account-compact/list-${project}.png`,fullPage:true});

 await page.getByRole('button',{name:'Campanhas',exact:false}).first().click();await page.mouse.move(1000,100);
 await page.locator('article.campaign-admin-card',{hasText:'MENDES-ADS-26'}).getByRole('button',{name:'Editar',exact:true}).click();
 const receiver=page.getByLabel('Recebedor do pagamento');await expect(receiver).toBeVisible();
 await expect(receiver.locator('option',{hasText:`Recebedor ${project}`})).toHaveCount(1);
 await receiver.selectOption({label:`Recebedor ${project} · $camisaria${project}`});
 await page.screenshot({path:`qa-evidence/account-compact/campaign-select-${project}.png`,fullPage:true});
 await page.getByRole('button',{name:/Revisão/}).click();
 await expect(page.getByText(`Pagamentos na conta InfinitePay $camisaria${project}`)).toBeVisible();
 const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/api/admin/campaigns/MENDES-ADS-26'));
 await page.getByRole('button',{name:/Salvar alterações/}).click();expect((await saved).ok()).toBe(true);
 await expect(page.locator('article.campaign-admin-card',{hasText:'MENDES-ADS-26'})).toContainText(`$camisaria${project}`);
 const stored=await database(c=>c.execute("SELECT r.infinitepay_handle FROM campaigns c JOIN payment_receivers r ON r.id=c.receiver_id WHERE c.code='MENDES-ADS-26'"));
 expect(stored[0][0].infinitepay_handle).toBe(`camisaria${project}`);
});
