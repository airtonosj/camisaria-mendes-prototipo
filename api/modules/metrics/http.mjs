import { readJson } from '../../http/response.mjs';
import { requireStaff } from '../../http/auth.mjs';
import { recordEvent, salesMetrics } from './service.mjs';

export async function recordMetricEvent(request) { await recordEvent(await readJson(request)); return { accepted: true }; }
export async function getSalesMetrics(request, search) { await requireStaff(request); return salesMetrics(search); }
