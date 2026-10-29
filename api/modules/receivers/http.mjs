import * as service from './service.mjs';
import { readJson } from '../../http/response.mjs';
import { requireStaff } from '../../http/auth.mjs';
import { parsePositiveInteger } from '../../http/validation.mjs';

/** HTTP boundary: preserve authentication and body-read order. */
export async function listReceivers(request) {
  await requireStaff(request);
  return service.listReceivers();
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function createReceiver(request) {
  const staff = await requireStaff(request);
  const body = await readJson(request);
  return service.createReceiver({ staff, body });
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function updateReceiver(request, receiverId) {
  await requireStaff(request);
  const body = await readJson(request);
  return service.updateReceiver({ body }, parsePositiveInteger(receiverId, "receiverId"));
}
