export const campaignPhases: readonly ['receiving_orders','orders_closed','production','ready_for_delivery','completed'];
export function suggestedCampaignCode(title: string, year?: number): string;
export function allocateCouponDiscount(items: Array<{variantId:number;size:string;quantity:number;unitDiscountCents:number}>, maximumDiscountQuantity: number|null): number[];

export function normalizeCouponText(value: unknown): string;
