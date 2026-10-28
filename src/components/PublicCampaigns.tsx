import { FormEvent, useEffect, useState } from 'react';
import { assetUrl, fetchPublicCampaigns } from '../api';
import type { PublicCampaignCatalog, PublicCampaignSummary } from '../features/campaigns/api';
import { buildRoute } from '../navigation';
import { Header } from './Header';

function CampaignCard({ campaign }: { campaign: PublicCampaignSummary }) {
  return <article className="public-campaign-card">
    <a className="public-campaign-image" href={buildRoute(undefined, campaign.code)} aria-label={`Ver campanha ${campaign.title}`}>
      {campaign.imageUrl ? <img src={assetUrl(campaign.imageUrl) ?? undefined} alt={`Camiseta da campanha ${campaign.title}`} loading="lazy" decoding="async" /> : <span>Imagem da campanha</span>}
    </a>
    <div className="public-campaign-info">
      <div><span className="public-campaign-status">Pedidos abertos</span><h3>{campaign.title}</h3>{campaign.subtitle && <p>{campaign.subtitle}</p>}</div>
      <a href={buildRoute(undefined, campaign.code)}>Ver campanha <span aria-hidden="true">→</span></a>
    </div>
  </article>;
}

export function PublicCampaignHome() {
  const [items, setItems] = useState<PublicCampaignSummary[]>([]);
  useEffect(() => { let active = true; fetchPublicCampaigns().then((result) => { if (active) setItems(result.campaigns.slice(0, 2)); }).catch(() => {}); return () => { active = false; }; }, []);
  if (!items.length) return null;
  return <section className="public-campaign-home" id="campanhas">
    <div className="container"><div className="public-campaign-heading"><div><span className="kicker">Campanhas abertas</span><h2>Encontre a sua turma.<br />Vista essa história.</h2></div><p>Campanhas que estão recebendo pedidos agora. Escolha a sua para ver a camiseta e participar.</p></div>
      <div className="public-campaign-featured">{items.map((campaign) => <CampaignCard key={campaign.code} campaign={campaign} />)}</div>
      <a className="public-campaign-all" href="/campanhas">Ver todas as campanhas <span aria-hidden="true">→</span></a>
    </div>
  </section>;
}

export function PublicCampaignListing() {
  const url = new URL(window.location.href);
  const initialPage = Math.min(10000, Math.max(1, Number(url.searchParams.get('pagina')) || 1));
  const initialSearch = url.searchParams.get('busca') ?? '';
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState(initialSearch);
  const [query, setQuery] = useState(initialSearch);
  const [catalog, setCatalog] = useState<PublicCampaignCatalog | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetchPublicCampaigns(page, query).then((result) => { if (active) { setCatalog(result); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [page, query]);
  useEffect(() => {
    const onPopState = () => {
      const current = new URL(window.location.href);
      const nextSearch = current.searchParams.get('busca') ?? '';
      setPage(Math.min(10000, Math.max(1, Number(current.searchParams.get('pagina')) || 1)));
      setQuery(nextSearch); setSearch(nextSearch);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  function navigate(nextPage: number, nextSearch = query) {
    const next = new URL('/campanhas', window.location.origin);
    if (nextPage > 1) next.searchParams.set('pagina', String(nextPage));
    if (nextSearch) next.searchParams.set('busca', nextSearch);
    window.history.pushState({}, '', next);
    setPage(nextPage); setQuery(nextSearch);
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); navigate(1, search.trim()); }
  const totalPages = Math.ceil((catalog?.total ?? 0) / (catalog?.pageSize ?? 12));
  const pageHref = (nextPage: number) => { const next = new URL('/campanhas', window.location.origin); if (nextPage > 1) next.searchParams.set('pagina', String(nextPage)); if (query) next.searchParams.set('busca', query); return `${next.pathname}${next.search}`; };
  return <><Header /><main className="public-campaign-list container">
    <a className="public-campaign-breadcrumb" href="/">Início</a><span className="public-campaign-breadcrumb"> / Campanhas abertas</span>
    <header><span className="kicker">Campanhas abertas</span><h1>Encontre a sua turma.</h1><p>Veja as campanhas que estão recebendo pedidos e escolha a sua.</p></header>
    <div className="public-campaign-toolbar"><form onSubmit={submit}><label htmlFor="campaign-search">Buscar pelo nome da turma ou campanha</label><div><input id="campaign-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: Direito, BICT, Engenharia" maxLength={80} /><button type="submit">Buscar</button></div></form><span>{catalog ? `${catalog.total} campanhas abertas` : ''}</span></div>
    {error ? <p role="alert">Não foi possível carregar as campanhas. Tente novamente.</p> : catalog && catalog.campaigns.length === 0 ? <p>Nenhuma campanha pública encontrada.</p> : <div className="public-campaign-grid">{catalog?.campaigns.map((campaign) => <CampaignCard key={campaign.code} campaign={campaign} />)}</div>}
    {totalPages > 1 && <nav className="public-campaign-pagination" aria-label="Páginas das campanhas">
      {page > 1 && <a href={pageHref(page - 1)} onClick={(event) => { event.preventDefault(); navigate(page - 1); }}>← Anterior</a>}
      <span>Página {page} de {totalPages}</span>
      {page < totalPages && <a href={pageHref(page + 1)} onClick={(event) => { event.preventDefault(); navigate(page + 1); }}>Próxima →</a>}
    </nav>}
  </main></>;
}
