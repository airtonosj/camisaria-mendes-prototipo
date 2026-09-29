import * as service from './service.mjs';
import { readJson } from '../../http/response.mjs';
import { requireStaff } from '../../http/auth.mjs';

/** HTTP boundary: preserve authentication and body-read order. */
export async function createCampaign(request) {
  const staff = await requireStaff(request);
  const body = await readJson(request);
  return service.createCampaign({ staff, body });
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function updateCampaign(request, code) {
  await requireStaff(request);
  const body = await readJson(request);
  return service.updateCampaign({ body }, code);
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function deleteCampaign(request, code) {
  await requireStaff(request);
  return service.deleteCampaign(code);
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function changeCampaignPhase(request, code) {
  const staff = await requireStaff(request);
  const body = await readJson(request);
  return service.changeCampaignPhase({ staff, body }, code);
}
