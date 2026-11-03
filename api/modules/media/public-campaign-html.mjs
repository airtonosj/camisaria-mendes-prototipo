import { publicCampaignCatalog } from '../campaigns/service.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

export async function publicCampaignDocumentHtml(html, requestUrl, publicAppUrl, catalogLoader = publicCampaignCatalog) {
  const url = new URL(requestUrl, publicAppUrl);
  if (url.pathname.replace(/\/$/, '') !== '/campanhas') return html;
  const page = Math.max(1, Number(url.searchParams.get('pagina')) || 1);
  const search = url.searchParams.get('busca') ?? '';
  try {
    const catalog = await catalogLoader({ page, search });
    const links = catalog.campaigns.map((campaign) => {
      const href = new URL('/', publicAppUrl);
      href.searchParams.set('campanha', campaign.code);
      return `<article><h2><a href="${escapeHtml(href.href)}">${escapeHtml(campaign.title)}</a></h2>${campaign.subtitle ? `<p>${escapeHtml(campaign.subtitle)}</p>` : ''}</article>`;
    }).join('');
    const next = page * catalog.pageSize < catalog.total ? `<a href="/campanhas?pagina=${page + 1}">Próxima página</a>` : '';
    const body = `<main><h1>Campanhas abertas | Camisaria Mendes</h1>${links}<nav>${next}</nav></main>`;
    const canonical = new URL('/campanhas', publicAppUrl);
    if (page > 1) canonical.searchParams.set('pagina', String(page));
    const meta = `${search ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${escapeHtml(canonical.href)}" />`}`;
    return html.replace(/<title>[\s\S]*?<\/title>/i, '<title>Campanhas abertas | Camisaria Mendes</title>')
      .replace('</head>', `${meta}</head>`)
      .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  } catch { return html; }
}
