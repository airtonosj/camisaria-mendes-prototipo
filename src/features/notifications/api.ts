import type { PickupSettings, PickupInfo, PickupPreview, EmailHistory } from "../../../shared/contracts";
import { staffRequest } from "../../lib/http";

export function fetchPickupInfo(code: string) {
  return staffRequest<PickupInfo>(`/admin/campaigns/${encodeURIComponent(code)}/pickup-email`);
}

export function previewPickupEmail(code: string, settings: PickupSettings) {
  return staffRequest<PickupPreview>(`/admin/campaigns/${encodeURIComponent(code)}/pickup-email/preview`, { method: 'POST', body: JSON.stringify(settings) }, 60000);
}

export function confirmPickupEmail(code: string, batchId: string) {
  return staffRequest<{ queued: number; skipped?: number; alreadyConfirmed?: boolean }>(`/admin/campaigns/${encodeURIComponent(code)}/pickup-email/confirm`, { method: 'POST', body: JSON.stringify({ batchId }) }, 60000);
}

export function fetchEmailHistory(code: string, search: string, status: string, page: number) {
  const params = new URLSearchParams({ search, status, page: String(page) });
  return staffRequest<EmailHistory>(`/admin/campaigns/${encodeURIComponent(code)}/pickup-email/history?${params}`);
}
