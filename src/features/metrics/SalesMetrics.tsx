import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSalesMetrics } from './api';
import type { SalesMetrics as SalesMetricsData } from './api';
import type { PanelCampaign } from '../admin/model';

type Period = '1' | '7' | '30' | '365' | 'custom';
const periodLabels: Record<Exclude<Period, 'custom'>, string> = { '1': 'Hoje', '7': '7 dias', '30': '30 dias', '365': 'Este ano' };
const sourceLabels: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', direct: 'Direto / sem identificação' };
function isoDate(value: Date) { return value.toISOString().slice(0, 10); }
function rangeFor(period: Period, custom: { start: string; end: string }) {
  if (period === 'custom') return custom;
  const end = new Date(); const start = new Date(end);
  if (period === '365') start.setFullYear(end.getFullYear() - 1);
  else start.setDate(end.getDate() - (Number(period) - 1));
  return { start: isoDate(start), end: isoDate(end) };
}
function readableRange(range: { start: string; end: string }) {
  const format = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(range.start)} — ${format(range.end)}`;
}

export function SalesMetrics({ campaigns }: { campaigns: PanelCampaign[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [period, setPeriod] = useState<Period>('7');
  const [custom, setCustom] = useState(() => rangeFor('7', { start: '', end: '' }));
  const [draft, setDraft] = useState(custom);
  const [campaign, setCampaign] = useState('all');
  const [source, setSource] = useState('all');
  const [metrics, setMetrics] = useState<SalesMetricsData | null>(null);
  const [error, setError] = useState('');
  const range = useMemo(() => rangeFor(period, custom), [period, custom]);

  useEffect(() => {
    let live = true; setError('');
    fetchSalesMetrics({ since: range.start, until: range.end, campaign, source }).then((data) => { if (live) setMetrics(data); }).catch((reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as métricas.'); });
    return () => { live = false; };
  }, [range.start, range.end, campaign, source]);

  function choosePeriod(next: Period) {
    setPeriod(next);
    if (next === 'custom') { setDraft(custom); dialog.current?.showModal(); }
  }
  function applyCustom() { if (draft.start && draft.end && draft.start <= draft.end) { setCustom(draft); setPeriod('custom'); dialog.current?.close(); } }
  const counts = metrics?.counts ?? { campaign_view: 0, cart_add: 0, order_review: 0, checkout_open: 0, paid: 0 };
  const stages: Array<[string, keyof typeof counts]> = [['Visitaram a campanha', 'campaign_view'], ['Adicionaram ao carrinho', 'cart_add'], ['Revisaram o pedido', 'order_review'], ['Abriram o pagamento', 'checkout_open'], ['Pagamento confirmado', 'paid']];
  const drop = stages.slice(1).map(([label, key], index) => ({ label, rate: counts[stages[index][1]] ? 1 - counts[key] / counts[stages[index][1]] : 0 })).sort((a,b) => b.rate - a.rate)[0];
  return <div className="admin-content sales-metrics-page">
    <section className="admin-page-intro"><div><span className="kicker">DESEMPENHO DAS VENDAS</span><h2>Onde as vendas param.</h2><p>Tráfego, intenção de compra, pagamento confirmado e falhas por campanha.</p></div></section>
    <div className="sales-periods" role="group" aria-label="Período">{(['1', '7', '30', '365', 'custom'] as Period[]).map((item) => <button type="button" key={item} className={period === item ? 'is-active' : ''} onClick={() => choosePeriod(item)}>{item === 'custom' ? 'Personalizado' : periodLabels[item]}</button>)}</div>
    <section className="sales-filters"><label><span>Campanha</span><select value={campaign} onChange={(event) => setCampaign(event.target.value)}><option value="all">Todas as campanhas</option>{campaigns.map((item) => <option key={item.code} value={item.code}>{item.title}</option>)}</select></label><label><span>Origem</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">Todas as origens</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="direct">Direto / sem identificação</option></select></label>{period === 'custom' && <button type="button" className="sales-range-button" onClick={() => { setDraft(custom); dialog.current?.showModal(); }}><span>{readableRange(range)}</span><span className="material-symbols-rounded" aria-hidden="true">calendar_month</span></button>}</section>
    <dialog ref={dialog} className="sales-range-dialog"><form method="dialog"><h3>Escolher período</h3><div><label><span>Início</span><input type="date" value={draft.start} onChange={(event) => setDraft((value) => ({ ...value, start: event.target.value }))} /></label><label><span>Fim</span><input type="date" value={draft.end} onChange={(event) => setDraft((value) => ({ ...value, end: event.target.value }))} /></label></div><footer><button type="button" onClick={() => dialog.current?.close()}>Cancelar</button><button type="button" className="primary-action" onClick={applyCustom}>Aplicar</button></footer></form></dialog>
    <section className="sales-metric-row" aria-live="polite"><article><span>Visitas à campanha</span><strong>{counts.campaign_view}</strong><small>Tráfego observado</small></article><article><span>Adicionaram ao carrinho</span><strong>{counts.cart_add}</strong><small>{counts.campaign_view ? `${(counts.cart_add / counts.campaign_view * 100).toFixed(1).replace('.', ',')}% das visitas` : 'Sem visitas'}</small></article><article><span>Abriram o pagamento</span><strong>{counts.checkout_open}</strong><small>{counts.campaign_view ? `${(counts.checkout_open / counts.campaign_view * 100).toFixed(1).replace('.', ',')}% das visitas` : 'Sem visitas'}</small></article><article><span>Pedidos pagos</span><strong>{counts.paid}</strong><small>Confirmados pela InfinitePay</small></article></section>
    {error ? <p className="sales-metrics-error" role="alert">{error}</p> : <section className="sales-metrics-grid"><article className="sales-panel"><h3>Funil de compra</h3><p>Leitura por etapa, conversão e pessoas que avançaram.</p><div className="sales-funnel-utmify" role="img" aria-label="Funil de compra com conversão entre cada etapa">{stages.map(([label, key], index) => { const previous = index ? counts[stages[index - 1][1]] : counts.campaign_view; const conversion = previous ? counts[key] / previous : 0; const width = counts.campaign_view ? 38 + counts[key] / counts.campaign_view * 62 : 100; return <div className="sales-funnel-utmify-stage" key={key}><div className="sales-funnel-utmify-bar" style={{ width: `${width}%` }}><div><span>{label}</span><strong>{counts[key]}</strong></div>{index > 0 && <small>{(conversion * 100).toFixed(1).replace('.', ',')}% avançaram</small>}</div></div>; })}</div><p className="sales-insight">{counts.campaign_view ? `Maior queda: ${Math.round((drop?.rate ?? 0) * 100)}% antes de “${drop?.label}”.` : 'A coleta começa quando os acessos à campanha acontecerem.'}</p></article><article className="sales-panel"><h3>Origem das visitas</h3><p>UTM dos links compartilhados e acesso direto.</p><div className="sales-sources"><div><span>Origem</span><strong>Visitas</strong><strong>Pagos</strong></div>{metrics?.sources.map((item) => <div key={item.source}><span>{sourceLabels[item.source] ?? item.source}</span><strong>{item.visits}</strong><strong>{item.paid}</strong></div>)}</div><p className="sales-insight">A origem do pedido é registrada ao criar o pedido. A confirmação continua sendo do provedor.</p></article></section>}
  </div>;
}

export default SalesMetrics;
