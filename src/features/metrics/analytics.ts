import { apiBase } from '../../lib/http';

const sessionKey = 'camisaria-mendes-analytics-session';
const sourceKey = 'camisaria-mendes-analytics-source';

function sessionId() {
  let value = sessionStorage.getItem(sessionKey);
  if (!value) {
    value = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    sessionStorage.setItem(sessionKey, value);
  }
  return value;
}

export function captureAnalyticsSource(search = new URLSearchParams(window.location.search)) {
  const candidate = (search.get('utm_source') || search.get('source') || '').trim().toLowerCase();
  if (/^[a-z0-9_-]{1,48}$/.test(candidate)) sessionStorage.setItem(sourceKey, candidate);
  if (!sessionStorage.getItem(sourceKey)) sessionStorage.setItem(sourceKey, 'direct');
}

export function analyticsSource() { return sessionStorage.getItem(sourceKey) || 'direct'; }

/** Falha de telemetria nunca bloqueia a compra nem apresenta erro ao cliente. */
export function recordCampaignMetric(campaignCode: string, eventName: 'campaign_view' | 'cart_add' | 'order_review' | 'checkout_open') {
  void fetch(`${apiBase()}/metrics/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignCode, eventName, anonymousSessionId: sessionId(), source: analyticsSource() }),
    keepalive: true,
  }).catch(() => {});
}
