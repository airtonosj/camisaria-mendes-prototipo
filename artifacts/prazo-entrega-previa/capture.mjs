import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4398','--strictPort'],{stdio:'pipe',windowsHide:true});
await new Promise((resolve,reject)=>{vite.stdout.on('data',data=>{if(data.toString().includes('Local:'))resolve();});vite.on('error',reject);vite.on('exit',code=>reject(new Error('Vite '+code)));});
process.on('exit',()=>vite.kill());
const out='C:/Users/edeconsil/.codex/visualizations/2026/10/08/01a11c80-ca0e-7d30-9584-9cbb42f0a655';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();
await page.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Prévia local"}'}));
await page.addInitScript(()=>sessionStorage.setItem('camisaria-mendes-demo-session','demonstration'));
const notice=[['person','Retirada com <b>Lucas Pereira</b>'],['inventory_2','Entrega prevista para <b>10 de novembro</b>'],['info','Camisas entregues ao representante de turma']].map(([icon,text])=>`<div style="display:flex;align-items:center;gap:9px"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span><span>${text}</span></div>`).join('');
const captures=[];
async function capture(name,title,width){
 await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(400);
 await page.evaluate(()=>window.scrollTo(0,0));
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(`Overflow em ${name}`);
 const image=await page.screenshot({type:'jpeg',quality:80,fullPage:true,path:`${out}/${name}.jpg`});
 captures.push({name,title,width,image:image.toString('base64')});
}
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 await page.setViewportSize({width,height});
 await page.goto('http://127.0.0.1:4398/');
 await page.evaluate(()=>localStorage.clear());
 await page.goto('http://127.0.0.1:4398/?campanha=MENDES-ENG-26');
 await page.locator('.campaign-builder-heading').waitFor();
 await page.evaluate(({markup,desktop})=>{const el=document.createElement('div');el.className='checkout-pickup preview-delivery';el.style.cssText='margin:16px 0 0;flex-direction:column;align-items:stretch;gap:10px';el.innerHTML=markup;document.querySelector(desktop?'.campaign-art-stage':'.campaign-builder-heading').append(el);},{markup:notice,desktop:device==='desktop'});
 await capture(`cliente-${device}`,`Escolha da camisa · ${device==='desktop'?'computador':'celular'}`,width);
 await page.evaluate(()=>document.querySelector('.preview-delivery').remove());
 await page.getByRole('button',{name:'Adicionar',exact:true}).click();
 await page.getByRole('button',{name:'Revisar pedido',exact:true}).click();
 await page.locator('.checkout-order-review .checkout-pickup').waitFor();
 await page.evaluate(markup=>{const el=document.querySelector('.checkout-order-review .checkout-pickup');el.style.cssText='flex-direction:column;align-items:stretch;gap:10px';el.innerHTML=markup;},notice);
 await capture(`revisao-${device}`,`Revisão do pedido · ${device==='desktop'?'computador':'celular'}`,width);
 await page.goto('http://127.0.0.1:4398/?rota=admin');
 await page.getByRole('button',{name:'Campanhas',exact:true}).click();
 await page.getByRole('button',{name:'Nova campanha'}).click();
 await page.locator('.campaign-information-grid').waitFor();
 await page.evaluate(()=>{const deadline=[...document.querySelectorAll('.campaign-field')].find(el=>el.textContent.includes('Prazo final dos pedidos'));const field=document.createElement('label');field.className='campaign-field';field.innerHTML='<span>Entrega prevista (opcional)</span><input type="date" value="2026-11-10">';deadline.after(field);const note=document.createElement('label');note.className='campaign-field campaign-field--wide';note.innerHTML='<span>Observação sobre a entrega (opcional)</span><input value="Camisas entregues ao representante de turma" maxlength="255">';document.querySelector('.campaign-information-grid').append(note);});
 await capture(`painel-${device}`,`Configuração da campanha · ${device==='desktop'?'computador':'celular'}`,width);
}
await browser.close();
const html=`<div id="mendes-exact-preview"><style>#mendes-exact-preview .preview-controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}#mendes-exact-preview .preview-image{display:block;width:100%;height:auto}#mendes-exact-preview .preview-image.phone{max-width:390px;margin:auto}#mendes-exact-preview figure{margin:0}#mendes-exact-preview [hidden]{display:none}</style><div class="preview-controls" aria-label="Tela e dispositivo">${captures.map((c,i)=>`<button type="button" class="btn" data-target="${c.name}" aria-pressed="${i===0}">${c.title}</button>`).join('')}</div>${captures.map((c,i)=>`<figure data-screen="${c.name}"${i?' hidden':''}><img class="preview-image ${c.width===390?'phone':''}" alt="${c.title}: layout atual do sistema com o campo de entrega prevista adicionado" src="data:image/jpeg;base64,${c.image}"></figure>`).join('')}<script>(()=>{const root=document.getElementById('mendes-exact-preview');root.querySelectorAll('[data-target]').forEach(button=>button.addEventListener('click',()=>{root.querySelectorAll('[data-target]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));root.querySelectorAll('[data-screen]').forEach(el=>el.hidden=el.dataset.screen!==button.dataset.target);}));})();</script></div>`;
await writeFile(`${out}/prazo-entrega-real.html`,html);
console.log(`6 capturas das telas reais; prévia ${Buffer.byteLength(html)} bytes.`);
vite.kill();
