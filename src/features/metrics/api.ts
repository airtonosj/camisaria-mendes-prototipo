import { staffRequest } from '../../lib/http';

export type SalesMetrics = {
  since: string; until: string;
  counts: { campaign_view: number; cart_add: number; order_review: number; checkout_open: number; paid: number };
  sources: Array<{ source: string; visits: number; paid: number }>;
};

export async function fetchSalesMetrics(input: { since: string; until: string; campaign?: string; source?: string }) {
  const query = new URLSearchParams({ since: input.since, until: input.until });
  if (input.campaign && input.campaign !== 'all') query.set('campaign', input.campaign);
  if (input.source && input.source !== 'all') query.set('source', input.source);
  const payload = await staffRequest<{ metrics: SalesMetrics }>(`/admin/metrics/sales?${query}`);
  return payload.metrics;
}
