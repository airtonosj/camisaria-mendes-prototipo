import { randomBytes } from "node:crypto";

function securityHeaders(nonce, contentLength) {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": contentLength,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`,
  };
}

export function serveLicenseControlPage(request, response) {
  const nonce = randomBytes(18).toString("base64");
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Controle de licença</title>
  <style>
    :root{font-family:Inter,system-ui,sans-serif;color:#172019;background:#f4f6f2}*{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(620px,100%);background:#fff;border:1px solid #dce3da;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(23,32,25,.1)}
    h1{margin:0 0 8px;font-size:1.7rem}p{line-height:1.55;color:#566057}.status{display:flex;gap:8px;align-items:center;margin:20px 0;padding:12px 14px;border-radius:12px;background:#eef3ec;font-weight:700}
    label{display:block;font-weight:700;margin-bottom:8px}textarea{width:100%;min-height:150px;resize:vertical;border:1px solid #b9c4b7;border-radius:12px;padding:12px;font:13px ui-monospace,SFMono-Regular,Consolas,monospace}
    button{width:100%;margin-top:14px;border:0;border-radius:12px;padding:13px 16px;background:#173c2c;color:white;font-weight:800;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.feedback{min-height:24px;margin:14px 0 0;font-weight:700}.error{color:#a52a2a}.success{color:#176b3a}small{display:block;margin-top:18px;color:#6b746c}
  </style>
</head>
<body>
  <main class="card">
    <h1>Controle de licença</h1>
    <p>Cole um código assinado de suspensão ou reativação. A URL não concede autoridade por si só.</p>
    <div class="status">Estado atual: <span id="status">consultando…</span></div>
    <form id="form">
      <label for="token">Código assinado</label>
      <textarea id="token" name="token" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="8192"></textarea>
      <button id="submit" type="submit">Aplicar código</button>
    </form>
    <p id="feedback" class="feedback" role="status" aria-live="polite"></p>
    <small>Cada código expira e só pode ser usado uma vez. Nenhum dado do cliente é apagado.</small>
  </main>
  <script nonce="${nonce}">
    const statusEl=document.getElementById('status');const form=document.getElementById('form');const tokenEl=document.getElementById('token');const feedback=document.getElementById('feedback');const submit=document.getElementById('submit');
    const label=(status)=>status==='suspended'?'suspenso':'ativo';
    async function refresh(){try{const r=await fetch('/api/license/control',{cache:'no-store'});const p=await r.json();if(!r.ok)throw new Error(p?.error?.message||'Não foi possível consultar.');statusEl.textContent=label(p.license.status)}catch(e){statusEl.textContent='indisponível';feedback.textContent=e.message;feedback.className='feedback error'}}
    form.addEventListener('submit',async(e)=>{e.preventDefault();submit.disabled=true;feedback.textContent='Validando código…';feedback.className='feedback';try{const r=await fetch('/api/license/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tokenEl.value})});const p=await r.json();if(!r.ok)throw new Error(p?.error?.message||'Código recusado.');statusEl.textContent=label(p.license.status);tokenEl.value='';feedback.textContent=p.license.status==='suspended'?'Sistema suspenso com sucesso.':'Sistema reativado com sucesso.';feedback.className='feedback success'}catch(e){feedback.textContent=e.message;feedback.className='feedback error'}finally{submit.disabled=false}});
    refresh();
  </script>
</body>
</html>`;
  const body = Buffer.from(html, "utf8");
  response.writeHead(200, securityHeaders(nonce, body.length));
  response.end(request.method === "HEAD" ? undefined : body);
}

export function serveLicenseSuspendedPage(request, response) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Sistema temporariamente suspenso</title><style>:root{font-family:Inter,system-ui,sans-serif;color:#172019;background:#f4f6f2}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center}main{max-width:620px;background:#fff;border:1px solid #dce3da;border-radius:20px;padding:36px;box-shadow:0 18px 50px rgba(23,32,25,.1)}h1{margin:0 0 12px}p{margin:0;color:#59635b;line-height:1.6}</style></head><body><main><h1>Sistema temporariamente suspenso</h1><p>O acesso às operações comerciais está indisponível. Entre em contato com o fornecedor responsável pela licença.</p></main></body></html>`;
  const body = Buffer.from(html, "utf8");
  response.writeHead(503, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "Retry-After": "3600",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

