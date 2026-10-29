import { allocateCouponDiscount } from '../../../shared/domain.mjs';
import type { PrivateCampaign, ShirtColorOption, ShirtModelName, SizeCode, VariantArtwork } from "../../data";
import { defaultCampaignColors, defaultCampaignSizes, shirtModels, sizeCatalog } from "../../data";

export type CampaignStep = "model" | "details" | "payment" | "received";

export type GalleryMedia =
  | { type: "mockup" }
  | { type: "video"; url: string; posterUrl?: string; durationSeconds?: number }
  | { type: "image"; url: string };

export type CartItem = {
  variantId: number;
  modelName: ShirtModelName;
  color: ShirtColorOption;
  size: SizeCode;
  quantity: number;
  unitPriceCents: number;
};

export const sizeGroupOf = new Map(sizeCatalog.map((item) => [item.code, item.group]));

export function campaignModels(campaign: PrivateCampaign) {
  if (campaign.models?.length) {
    return shirtModels.filter((model) => campaign.models?.includes(model.name));
  }
  if (campaign.variantIds) {
    return shirtModels.filter((model) => Object.keys(campaign.variantIds?.[model.name] ?? {}).length > 0);
  }
  // Compatibilidade somente com campanhas demonstrativas salvas antes deste campo existir.
  return shirtModels;
}

export function campaignSizes(campaign: PrivateCampaign, model: ShirtModelName) {
  const allowed = new Set(defaultCampaignSizes[model]);
  const configured = campaign.sizes?.[model]?.filter((size) => allowed.has(size));
  if (campaign.models || campaign.variantIds) return configured ?? [];
  return configured?.length ? configured : defaultCampaignSizes[model];
}

export function campaignColors(campaign: PrivateCampaign, model: ShirtModelName) {
  const configured = campaign.colors?.[model];
  if (campaign.models || campaign.variantIds) return configured ?? [];
  return configured?.length ? configured : defaultCampaignColors[model];
}

export function cartStorageKey(campaignCode: string) {
  return `camisaria-cart:${campaignCode}`;
}

export function itemKey(item: Pick<CartItem, "variantId" | "size">) {
  return `${item.variantId}:${item.size}`;
}

export function allocateCartCouponDiscount(items: CartItem[], discountsByModel: Partial<Record<ShirtModelName, number>>, maximumDiscountQuantity: number | null) {
 const quantities = allocateCouponDiscount(items.map(item=>({...item,unitDiscountCents:discountsByModel[item.modelName]??0})),maximumDiscountQuantity);
 const discountedQuantitiesByItem: Record<string,number> = {};
 let discountCents=0;
 items.forEach((item,index)=>{ if(quantities[index])discountedQuantitiesByItem[itemKey(item)]=quantities[index]; discountCents+=quantities[index]*(discountsByModel[item.modelName]??0); });
 return {discountedQuantitiesByItem,discountedUnits:quantities.reduce((a,b)=>a+b,0),discountCents};
}

export function artworkForVariant(campaign: PrivateCampaign, variantId: number): VariantArtwork {
  return campaign.variantArtworks?.[variantId] ?? {
    front: campaign.art.front ? { url: campaign.art.front, transform: campaign.art.frontTransform ?? { x: 0, y: 0, scale: 1, rotation: 0 } } : null,
    back: campaign.art.back ? { url: campaign.art.back, transform: campaign.art.backTransform ?? { x: 0, y: 0, scale: 1, rotation: 0 } } : null,
  };
}

export function readCart(campaign: PrivateCampaign): CartItem[] {
  try {
    const raw = sessionStorage.getItem(cartStorageKey(campaign.code));
    if (!raw) return [];
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) return [];
    const validated: CartItem[] = [];
    const availableModels = campaignModels(campaign);
    for (const candidate of stored) {
      const modelName = candidate?.modelName as ShirtModelName;
      if (!availableModels.some((model) => model.name === modelName)) continue;
      const color = campaignColors(campaign, modelName).find((option) => option.name === candidate?.color?.name);
      const size = candidate?.size as SizeCode;
      const variantId = campaign.variantIds?.[modelName]?.[color?.name ?? ""];
      const quantity = Number(candidate?.quantity);
      if (!color || !campaignSizes(campaign, modelName).includes(size)) continue;
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) continue;
      if (!variantId && !import.meta.env.DEV) continue;
      validated.push({
        variantId: variantId ?? Number(candidate.variantId),
        modelName,
        color,
        size,
        quantity,
        unitPriceCents: Math.round(campaign.prices[modelName] * 100),
      });
    }
    return validated.slice(0, 10);
  } catch {
    return [];
  }
}

export function formatCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
