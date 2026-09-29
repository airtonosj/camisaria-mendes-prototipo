import type { ApiProductionRow, ApiDeliveryRow } from "../../../shared/contracts";
import { staffRequest } from "../../lib/http";

export function reportQuery(campaignCode?: string) {
  return campaignCode ? `?campaign=${encodeURIComponent(campaignCode)}` : "";
}

export async function fetchProductionReport(campaignCode?: string) {
  const payload = await staffRequest<{ rows: ApiProductionRow[] }>(`/admin/reports/production${reportQuery(campaignCode)}`);
  return payload.rows;
}

export async function fetchDeliveryReport(campaignCode?: string) {
  const payload = await staffRequest<{ rows: ApiDeliveryRow[] }>(`/admin/reports/delivery${reportQuery(campaignCode)}`);
  return payload.rows;
}
