import { emailHistory } from "../email-history.mjs";

import { deleteSession, resolvePasswordResetToken, resolveSession } from "../auth.mjs";
import { pickupInfo, previewPickup, confirmPickup, PickupError } from "../pickup-email.mjs";
import { createCheckoutForOrder, enqueueInfinitePayEvent } from "../infinitepay-payments.mjs";
import { applyLicenseCommand, getLicenseState } from "../license-control.mjs";
import { serveLicenseControlPage } from "../license-control-page.mjs";
import { rateLimitEntries } from "../runtime/constants.mjs";
import { ApiError, sendJson, applyCors, readJson } from "./response.mjs";
import { databaseReadiness, storageReadiness } from "../runtime/readiness.mjs";
import { requireText, normalizeWhatsapp } from "./validation.mjs";
import { bearerToken, requireStaff } from "./auth.mjs";
import { orderWindowMs, maxOrderAttempts, paymentEventWindowMs, maxPaymentEventAttempts, licenseControlWindowMs, maxLicenseControlAttempts, clientAddress, registerRateLimitedAttempt, assertRateLimitAllowed } from "./rate-limit.mjs";
import { assertLicenseControlEnabled, enforceLicenseState } from "./license.mjs";
import { login, updateAccount, requestPasswordReset, confirmPasswordReset } from '../modules/account/http.mjs';
import { publicSettings } from "./settings.mjs";
import { getCampaign, getPublicCampaignCoupon, listCampaigns } from '../modules/campaigns/service.mjs';
import { createCampaign, updateCampaign, deleteCampaign, changeCampaignPhase } from '../modules/campaigns/http.mjs';
import { trackOrder, listCampaignOrders } from '../modules/orders/service.mjs';
import { createOrder, changeDeliveryStatus, cancelOrder, registerOrderRefund } from '../modules/orders/http.mjs';
import { listSizes, uploadArtwork, uploadVideo, serveUpload, serveShareImage, serveFrontend } from "../modules/media/service.mjs";
import { productionReport, deliveryReport } from "../modules/reports/service.mjs";
import { listReceivers, createReceiver, updateReceiver } from '../modules/receivers/http.mjs';

import { buildVersion } from '../runtime/version.mjs';

export async function route(request, response) {
  applyCors(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const path = decodeURIComponent(requestUrl.pathname).replace(/\/+$/, "") || "/";

  if ((request.method === "GET" || request.method === "HEAD") && path === "/controle-licenca") {
    assertLicenseControlEnabled();
    serveLicenseControlPage(request, response);
    return;
  }
  if (request.method === "GET" && path === "/api/license/control") {
    assertLicenseControlEnabled();
    sendJson(response, 200, { license: await getLicenseState() });
    return;
  }
  if (request.method === "POST" && path === "/api/license/control") {
    assertLicenseControlEnabled();
    const attemptKey = `license-control:${clientAddress(request)}`;
    assertRateLimitAllowed(
      attemptKey,
      maxLicenseControlAttempts,
      licenseControlWindowMs,
      "Muitas tentativas de controle de licença. Aguarde alguns minutos.",
    );
    registerRateLimitedAttempt(attemptKey, licenseControlWindowMs);
    const body = await readJson(request);
    const result = await applyLicenseCommand(requireText(body.token, "token", 8192));
    rateLimitEntries.delete(attemptKey);
    sendJson(response, 200, { license: result });
    return;
  }

  if (request.method === "GET" && path === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      version: buildVersion(),
      ...await databaseReadiness(),
      ...await storageReadiness(),
      license: await getLicenseState(),
    });
    return;
  }
  if (await enforceLicenseState(request, response, requestUrl, path)) return;
  const uploadMatch = path.match(/^\/uploads\/([^/]+)$/);
  if ((request.method === "GET" || request.method === "HEAD") && uploadMatch) {
    await serveUpload(request, response, uploadMatch[1]);
    return;
  }
  const shareImageMatch = path.match(/^\/compartilhar\/([^/]+)\.jpg$/);
  if ((request.method === "GET" || request.method === "HEAD") && shareImageMatch) {
    await serveShareImage(request, response, shareImageMatch[1]);
    return;
  }
  if (request.method === "GET" && path === "/api/settings") {
    sendJson(response, 200, publicSettings());
    return;
  }
  if (request.method === "POST" && path === "/api/auth/login") {
    sendJson(response, 200, await login(request));
    return;
  }
  if (request.method === "POST" && path === "/api/auth/password/forgot") {
    sendJson(response, 202, await requestPasswordReset(request));
    return;
  }
  if (request.method === "GET" && path === "/api/auth/password/reset") {
    const reset = await resolvePasswordResetToken(requestUrl.searchParams.get("token") ?? "");
    if (!reset) throw new ApiError(410, "RESET_TOKEN_INVALID", "Este link de redefinição expirou ou já foi usado.");
    sendJson(response, 200, { email: reset.email, name: reset.name });
    return;
  }
  if (request.method === "POST" && path === "/api/auth/password/reset") {
    sendJson(response, 200, await confirmPasswordReset(request));
    return;
  }
  if (request.method === "PATCH" && path === "/api/admin/account") {
    sendJson(response, 200, await updateAccount(request));
    return;
  }
  if (request.method === "POST" && path === "/api/auth/logout") {
    await deleteSession(bearerToken(request));
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === "GET" && path === "/api/auth/session") {
    const session = await resolveSession(bearerToken(request));
    if (!session) throw new ApiError(401, "UNAUTHORIZED", "Sessão expirada. Entre novamente.");
    sendJson(response, 200, { user: session.user, expiresAt: session.expiresAt });
    return;
  }
  if (request.method === "GET" && path === "/api/sizes") {
    sendJson(response, 200, { sizes: await listSizes() });
    return;
  }
  if (request.method === "POST" && path === "/api/admin/uploads") {
    sendJson(response, 201, await uploadArtwork(request));
    return;
  }
  if (request.method === "POST" && path === "/api/admin/video-uploads") {
    sendJson(response, 201, await uploadVideo(request));
    return;
  }
  const publicCouponMatch = path.match(/^\/api\/campaigns\/([^/]+)\/coupon$/);
  if (request.method === "GET" && publicCouponMatch) {
    sendJson(response, 200, {
      coupon: await getPublicCampaignCoupon(
        publicCouponMatch[1].toUpperCase(),
        requestUrl.searchParams.get("code") ?? "",
      ),
    });
    return;
  }
  const publicCampaignMatch = path.match(/^\/api\/campaigns\/([^/]+)$/);
  if (request.method === "GET" && publicCampaignMatch) {
    sendJson(response, 200, { campaign: await getCampaign(publicCampaignMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "POST" && path === "/api/orders") {
    const attemptKey = `order:${clientAddress(request)}`;
    assertRateLimitAllowed(
      attemptKey,
      maxOrderAttempts,
      orderWindowMs,
      "Muitos pedidos enviados em pouco tempo. Aguarde alguns minutos.",
    );
    registerRateLimitedAttempt(attemptKey, orderWindowMs);
    const result = await createOrder(request);
    sendJson(response, result.created ? 201 : 200, {
      order: {
        number: result.order.order_number,
        totalCents: result.order.total_cents,
        paymentStatus: result.order.payment_status,
      },
      idempotentReplay: !result.created,
    });
    return;
  }
  const checkoutMatch = path.match(/^\/api\/orders\/([^/]+)\/checkout$/);
  if (request.method === "POST" && checkoutMatch) {
    const body = await readJson(request);
    const whatsapp = normalizeWhatsapp(body.whatsapp);
    sendJson(response, 200, {
      checkout: await createCheckoutForOrder(checkoutMatch[1].toUpperCase(), whatsapp),
    });
    return;
  }
  if (request.method === "POST" && path === "/api/payments/infinitepay/webhook") {
    const attemptKey = `payment-event:${clientAddress(request)}`;
    assertRateLimitAllowed(
      attemptKey,
      maxPaymentEventAttempts,
      paymentEventWindowMs,
      "Muitos eventos de pagamento recebidos. Tente novamente em alguns minutos.",
    );
    registerRateLimitedAttempt(attemptKey, paymentEventWindowMs);
    const queued = await enqueueInfinitePayEvent(await readJson(request), "webhook");
    sendJson(response, 200, { success: true, message: null, ...queued });
    return;
  }
  if (request.method === "POST" && path === "/api/payments/infinitepay/reconcile") {
    const attemptKey = `payment-event:${clientAddress(request)}`;
    assertRateLimitAllowed(
      attemptKey,
      maxPaymentEventAttempts,
      paymentEventWindowMs,
      "Muitos eventos de pagamento recebidos. Tente novamente em alguns minutos.",
    );
    registerRateLimitedAttempt(attemptKey, paymentEventWindowMs);
    const queued = await enqueueInfinitePayEvent(await readJson(request), "browser_return");
    sendJson(response, 202, queued);
    return;
  }
  const trackingMatch = path.match(/^\/api\/orders\/([^/]+)$/);
  if (request.method === "GET" && trackingMatch) {
    sendJson(response, 200, { order: await trackOrder(requestUrl, trackingMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/receivers") {
    sendJson(response, 200, { receivers: await listReceivers(request) });
    return;
  }
  if (request.method === "POST" && path === "/api/admin/receivers") {
    sendJson(response, 201, { receiver: await createReceiver(request) });
    return;
  }
  const receiverMatch = path.match(/^\/api\/admin\/receivers\/([^/]+)$/);
  if (request.method === "PATCH" && receiverMatch) {
    sendJson(response, 200, { receiver: await updateReceiver(request, receiverMatch[1]) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/campaigns") {
    await requireStaff(request);
    sendJson(response, 200, { campaigns: await listCampaigns() });
    return;
  }
  if (request.method === "POST" && path === "/api/admin/campaigns") {
    sendJson(response, 201, { campaign: await createCampaign(request) });
    return;
  }
  const campaignMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)$/);
  if (request.method === "GET" && campaignMatch) {
    await requireStaff(request);
    sendJson(response, 200, { campaign: await getCampaign(campaignMatch[1].toUpperCase(), { includeCoupon: true, includeReceiver: true }) });
    return;
  }
  if (request.method === "PATCH" && campaignMatch) {
    sendJson(response, 200, { campaign: await updateCampaign(request, campaignMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "DELETE" && campaignMatch) {
    sendJson(response, 200, { campaign: await deleteCampaign(request, campaignMatch[1].toUpperCase()) });
    return;
  }
  const phaseMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/phase$/);
  if (request.method === "PATCH" && phaseMatch) {
    sendJson(response, 200, { campaign: await changeCampaignPhase(request, phaseMatch[1].toUpperCase()) });
    return;
  }
  const pickupMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/pickup-email(?:\/(preview|confirm|history))?$/);
  if (pickupMatch && ['GET', 'POST'].includes(request.method)) {
    const staff = await requireStaff(request);
    const code = pickupMatch[1].toUpperCase();
    try {
      let result;
      if (request.method === 'GET' && !pickupMatch[2]) result = await pickupInfo(code);
      else if (request.method === 'GET' && pickupMatch[2] === 'history') result = await emailHistory(code, requestUrl.searchParams);
      else if (request.method === 'POST' && pickupMatch[2] === 'preview') result = await previewPickup(code, await readJson(request), staff.id);
      else if (request.method === 'POST' && pickupMatch[2] === 'confirm') {
        const body = await readJson(request);
        result = await confirmPickup(code, requireText(body.batchId, 'batchId', 36), staff.id);
      } else throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
      sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof PickupError) throw new ApiError(error.status, 'PICKUP_EMAIL', error.message);
      throw error;
    }
    return;
  }
  const campaignOrdersMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/orders$/);
  if (request.method === "GET" && campaignOrdersMatch) {
    await requireStaff(request);
    sendJson(response, 200, { orders: await listCampaignOrders(campaignOrdersMatch[1].toUpperCase()) });
    return;
  }
  const cancelMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/cancel$/);
  if (request.method === "PATCH" && cancelMatch) {
    sendJson(response, 200, { order: await cancelOrder(request, cancelMatch[1].toUpperCase()) });
    return;
  }
  const refundMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/refund$/);
  if (request.method === "POST" && refundMatch) {
    sendJson(response, 201, { refund: await registerOrderRefund(request, refundMatch[1].toUpperCase()) });
    return;
  }
  const deliveryMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/delivery$/);
  if (request.method === "PATCH" && deliveryMatch) {
    sendJson(response, 200, { order: await changeDeliveryStatus(request, deliveryMatch[1].toUpperCase()) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/reports/production") {
    await requireStaff(request);
    sendJson(response, 200, { rows: await productionReport(requestUrl) });
    return;
  }
  if (request.method === "GET" && path === "/api/admin/reports/delivery") {
    await requireStaff(request);
    sendJson(response, 200, { rows: await deliveryReport(requestUrl) });
    return;
  }
  if ((request.method === "GET" || request.method === "HEAD") && !path.startsWith("/api/")) {
    await serveFrontend(request, response, path);
    return;
  }
  throw new ApiError(404, "ROUTE_NOT_FOUND", "Rota não encontrada.");
}
