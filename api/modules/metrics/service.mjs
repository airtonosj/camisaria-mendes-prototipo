import { pool } from '../../database.mjs';
import { ApiError } from '../../http/response.mjs';
import * as queries from './repository.mjs';

const eventNames = new Set(['campaign_view', 'cart_add', 'order_review', 'checkout_open']);
const sourcePattern = /^[a-z0-9_-]{1,48}$/;

function sourceOf(value) {
  const source = String(value ?? 'direct').trim().toLowerCase();
  return sourcePattern.test(source) ? source : 'direct';
}

export function metricSource(search) {
  const raw = search.get('utm_source') || search.get('source') || 'direct';
  return sourceOf(raw);
}

export async function recordEvent(body) {
  const campaignCode = String(body?.campaignCode ?? '').trim().toUpperCase();
  const eventName = String(body?.eventName ?? '');
  const anonymousSessionId = String(body?.anonymousSessionId ?? '');
  if (!/^[A-Z0-9-]{3,40}$/.test(campaignCode) || !eventNames.has(eventName) || !/^[0-9a-f-]{36}$/i.test(anonymousSessionId)) {
    throw new ApiError(422, 'METRIC_EVENT_INVALID', 'Evento de métricas inválido.');
  }
  const [campaignRows] = await queries.campaignIdByCode(pool, campaignCode);
  if (!campaignRows.length) throw new ApiError(404, 'CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.');
  await queries.insertEvent(pool, [campaignRows[0].id, anonymousSessionId, eventName, sourceOf(body.source)]);
}

function reportRange(search) {
  const now = new Date();
  const until = search.get('until') ? new Date(`${search.get('until')}T23:59:59.999Z`) : now;
  const since = search.get('since') ? new Date(`${search.get('since')}T00:00:00.000Z`) : new Date(until.getTime() - 6 * 86400000);
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || since > until) throw new ApiError(422, 'METRIC_PERIOD_INVALID', 'Período de métricas inválido.');
  return { since, until: new Date(until.getTime() + 1), sinceLabel: since.toISOString(), untilLabel: until.toISOString() };
}

export async function salesMetrics(search) {
  const { since, until, sinceLabel, untilLabel } = reportRange(search);
  const campaign = search.get('campaign')?.trim().toUpperCase() || null;
  const source = search.get('source') ? sourceOf(search.get('source')) : null;
  const values = [since, until, campaign, campaign, source, source];
  const [[eventRows], [paidRows]] = await Promise.all([queries.funnelRows(pool, values), queries.paidRows(pool, values)]);
  const counts = { campaign_view: 0, cart_add: 0, order_review: 0, checkout_open: 0, paid: 0 };
  const sources = new Map();
  for (const row of eventRows) {
    const total = Number(row.total);
    counts[row.event_name] += total;
    const item = sources.get(row.source) ?? { source: row.source, visits: 0, paid: 0 };
    if (row.event_name === 'campaign_view') item.visits += total;
    sources.set(row.source, item);
  }
  for (const row of paidRows) {
    const total = Number(row.total); counts.paid += total;
    const item = sources.get(row.source) ?? { source: row.source, visits: 0, paid: 0 };
    item.paid += total; sources.set(row.source, item);
  }
  return { since: sinceLabel, until: untilLabel, counts, sources: [...sources.values()].sort((a,b) => b.visits - a.visits || b.paid - a.paid) };
}
