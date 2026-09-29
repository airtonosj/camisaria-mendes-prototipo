import { ApiError } from "../../http/response.mjs";

export function normalizeCampaignCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^MENDES-[A-Z0-9-]{2,32}$/.test(code)) {
    throw new ApiError(422, "INVALID_CAMPAIGN_CODE", "Use um código no formato MENDES-TURMA-26.");
  }
  return code;
}

export { suggestedCampaignCode } from '../../../shared/domain.mjs';

export function parseDeadline(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ApiError(422, "VALIDATION_ERROR", "Informe um prazo válido para a campanha.");
  return parsed;
}
