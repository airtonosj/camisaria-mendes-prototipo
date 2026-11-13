import * as service from './service.mjs';
import { readJson } from '../../http/response.mjs';
import { requireStaff } from '../../http/auth.mjs';
import { requireText } from '../../http/validation.mjs';

/** HTTP boundary: preserve authentication and body-read order. */
export async function createOrder(request) {
  const idempotencyKey = requireText(request.headers["idempotency-key"], "Idempotency-Key", 128);
  const body = await readJson(request);
  return service.createOrder({ idempotencyKey, body });
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function changeDeliveryStatus(request, orderNumber) {
  const staff = await requireStaff(request);
  const body = await readJson(request);
  return service.changeDeliveryStatus({ staff, body }, orderNumber);
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function cancelOrder(request, orderNumber) {
  const staff = await requireStaff(request);
  const body = await readJson(request);
  return service.cancelOrder({ staff, body }, orderNumber);
}

/** HTTP boundary: preserve authentication and body-read order. */
export async function registerOrderRefund(request, orderNumber) {
  const staff = await requireStaff(request);
  const body = await readJson(request);
  return service.registerOrderRefund({ staff, body }, orderNumber);
}
