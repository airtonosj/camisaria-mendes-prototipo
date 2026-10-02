/** Runtime checks at the HTTP boundary. Extra fields remain compatible. */
import { campaignPhases } from './domain.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string';
const money = value => Number.isSafeInteger(value) && value >= 0;
const nullableString = value => value == null || string(value);
function adminCampaign(value) {
  if (!object(value)) return false;
  const receiver = value.receiver;
  return string(value.code) && string(value.title) && campaignPhases.includes(value.phase)
    && string(value.deadlineAt) && Number.isFinite(Date.parse(value.deadlineAt))
    && object(value.representative) && string(value.representative.name) && nullableString(value.representative.whatsapp)
    && nullableString(value.artFrontUrl) && nullableString(value.artBackUrl)
    && money(value.orderCount) && money(value.paidTotalCents) && typeof value.canDelete === 'boolean'
    && (receiver == null || (object(receiver) && Number.isSafeInteger(receiver.id) && receiver.id > 0
      && string(receiver.name) && string(receiver.infinitepayHandle) && typeof receiver.active === 'boolean'))
    && (value.activeCoupon == null || coupon(value.activeCoupon))
    && (value.couponHistory === undefined || (Array.isArray(value.couponHistory) && value.couponHistory.every(item =>
      object(item) && string(item.code) && typeof item.active === 'boolean'
      && ['usedCount', 'paidCount', 'pendingCount', 'cancelledCount', 'refundedCount', 'failedCount'].every(key => money(item[key])))));
}
function campaign(value) {
  return object(value) && string(value.code) && string(value.title) && string(value.deadlineAt)
    && Array.isArray(value.variants) && value.variants.every(v=>object(v)&&Number.isSafeInteger(v.id)&&object(v.model)&&string(v.model.code)&&string(v.model.name)&&object(v.color)&&string(v.color.name)&&money(v.unitPriceCents))
    && Array.isArray(value.sizes) && value.sizes.every(s=>object(s)&&string(s.code)&&object(s.model)&&string(s.model.code));
}
function coupon(value) {
  return object(value)&&string(value.code)&&Number.isInteger(value.minimumQuantity)
    && Array.isArray(value.discounts)&&value.discounts.every(d=>object(d)&&string(d.modelCode)&&money(d.discountCents));
}
/** @param {string} path @param {string} method @param {unknown} payload */
export function validApiResponse(path, method, payload) {
  if(!object(payload))return false;
  const route=path.split('?')[0];
  if(method==='GET'&&route==='/admin/campaigns')return Array.isArray(payload.campaigns)&&payload.campaigns.every(adminCampaign);
  if(method==='POST'&&route==='/orders')return object(payload.order)&&string(payload.order.number)&&money(payload.order.totalCents)&&string(payload.order.paymentStatus);
  if(route.endsWith('/checkout'))return object(payload.checkout)&&string(payload.checkout.url)&&typeof payload.checkout.reused==='boolean';
  if(method==='GET'&&/^\/orders\/[^/]+$/.test(route))return object(payload.order)&&string(payload.order.number)&&string(payload.order.status)&&Array.isArray(payload.order.items)&&money(payload.order.totalCents);
  if(method==='GET'&&/^\/(admin\/)?campaigns\/[^/]+$/.test(route))return campaign(payload.campaign);
  if(route.includes('/coupon')&&!route.includes('/admin/'))return coupon(payload.coupon);
  if(route==='/admin/reports/production')return Array.isArray(payload.rows)&&payload.rows.every(r=>object(r)&&string(r.campaignCode)&&Number.isFinite(r.quantity)&&object(r.color));
  if(route==='/admin/reports/delivery')return Array.isArray(payload.rows)&&payload.rows.every(r=>object(r)&&string(r.orderNumber)&&string(r.deliveryStatus)&&Number.isFinite(r.quantity));
  return true;
}
