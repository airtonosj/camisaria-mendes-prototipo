import * as service from './service.mjs';
import { readJson } from '../../http/response.mjs';
import { requireSessionUser, bearerToken } from '../../http/auth.mjs';
import { clientAddress } from '../../http/rate-limit.mjs';

/** HTTP boundary: preserve authentication and body-read order. */
export async function login(request) {
  const body = await readJson(request);
  const requestAddress = clientAddress(request);
  return service.login({ body, requestAddress });
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function updateAccount(request) {
  const current = await requireSessionUser(request);
  const sessionToken = bearerToken(request);
  const body = await readJson(request);
  return service.updateAccount({ current, body, sessionToken });
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function requestPasswordReset(request) {
  const body = await readJson(request);
  const requestAddress = clientAddress(request);
  return service.requestPasswordReset({ body, requestAddress });
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function confirmPasswordReset(request) {
  const body = await readJson(request);
  return service.confirmPasswordReset({ body });
}
