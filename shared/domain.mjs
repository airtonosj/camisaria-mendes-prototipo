/** Pure domain vocabulary and calculations. No persistence or browser dependencies. */
export const campaignPhases = ['receiving_orders', 'orders_closed', 'production', 'ready_for_delivery', 'completed'];

export function suggestedCampaignCode(title, year = new Date().getUTCFullYear()) {
  const stopWords = new Set(['A','AS','DA','DAS','DE','DO','DOS','E','O','OS']);
  const words = title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
    .replace(/[^A-Z0-9 ]/g,' ').split(/\s+/).filter(word=>word&&!stopWords.has(word));
  const initials=words.slice(0,4).map(word=>word[0]).join('')||'TURMA';
  return `MENDES-${initials}-${String(year).slice(-2)}`;
}

/** @param {{variantId:number,size:string,quantity:number,unitDiscountCents:number}[]} items
 * @param {number|null} maximumDiscountQuantity
 * @returns {number[]} Discounted quantities in original input order.
 */
export function allocateCouponDiscount(items, maximumDiscountQuantity) {
  const result=items.map(()=>0);
  let remaining=Math.min(items.reduce((total,item)=>total+item.quantity,0), maximumDiscountQuantity??Number.MAX_SAFE_INTEGER);
  for(const {item,index} of items.map((item,index)=>({item,index})).sort((a,b)=>b.item.unitDiscountCents-a.item.unitDiscountCents||a.item.variantId-b.item.variantId||a.item.size.localeCompare(b.item.size))) {
    if(remaining===0||item.unitDiscountCents===0)break;
    result[index]=Math.min(item.quantity,remaining); remaining-=result[index];
  }
  return result;
}

/** Canonical coupon text; business validity is checked by the server. */
export function normalizeCouponText(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
}
