import { shirtColors, shirtModels } from "./data";
import type { PrivateCampaign, ShirtColorName, ShirtColorOption, ShirtModelName } from "./data";

type ApiCampaignVariant = {
  id: number;
  model: { code: string; name: string };
  color: { name: string; hex: string };
  unitPriceCents: number;
  frontImageUrl: string | null;
  backImageUrl: string | null;
};

type ApiCampaign = {
  code: string;
  title: string;
  subtitle: string | null;
  phase: string;
  deadlineAt: string;
  pickupInstructions: string;
  representativeName: string;
  coverImageUrl: string | null;
  variants: ApiCampaignVariant[];
};

type CreateOrderInput = {
  campaignCode: string;
  customer: { name: string; whatsapp: string; email?: string };
  variantId: number;
  size: string;
  quantity: number;
  idempotencyKey: string;
};

export type TrackedOrder = {
  number: string;
  status: "pending" | "confirmed" | "failed" | "ready" | "delivered";
  paymentStatus: string;
  totalCents: number;
  campaign: { code: string; title: string; representativeName: string };
  items: Array<{
    modelName: string;
    color: { name: string; hex: string };
    size: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
};

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function apiBase() {
  const configured = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    return "http://127.0.0.1:3333/api";
  }
  return `${window.location.origin}/api`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiRequestError(
        response.status,
        payload?.error?.code ?? "REQUEST_FAILED",
        payload?.error?.message ?? "Não foi possível concluir a operação.",
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(0, "API_UNAVAILABLE", "Não foi possível conectar ao servidor. Tente novamente.");
  } finally {
    window.clearTimeout(timeout);
  }
}

function absoluteAssetUrl(value: string | null) {
  if (!value) return null;
  if (/^(data:|https?:\/\/)/i.test(value)) return value;
  const origin = new URL(apiBase()).origin;
  return new URL(value, origin).toString();
}

function mapCampaign(campaign: ApiCampaign): PrivateCampaign {
  const prices = {} as Record<ShirtModelName, number>;
  const colors = {} as Record<ShirtModelName, ShirtColorOption[]>;
  const modelImages = {} as Record<ShirtModelName, { front: string; back: string }>;
  const variantIds: NonNullable<PrivateCampaign["variantIds"]> = {};

  for (const model of shirtModels) {
    const variants = campaign.variants.filter((variant) => variant.model.name === model.name);
    const first = variants[0];
    prices[model.name] = (first?.unitPriceCents ?? 0) / 100;
    colors[model.name] = variants.map((variant) => {
      const known = shirtColors.find((color) => color.name === variant.color.name);
      return known ?? { name: variant.color.name as ShirtColorName, hex: variant.color.hex };
    });
    modelImages[model.name] = {
      front: absoluteAssetUrl(first?.frontImageUrl ?? null) ?? model.image,
      back: absoluteAssetUrl(first?.backImageUrl ?? null) ?? model.backImage,
    };
    variantIds[model.name] = Object.fromEntries(
      variants.map((variant) => [variant.color.name as ShirtColorName, variant.id]),
    );
  }

  const deadline = new Date(campaign.deadlineAt);
  return {
    code: campaign.code,
    title: campaign.title,
    subtitle: campaign.subtitle ?? "Campanha exclusiva para os alunos da turma",
    image: absoluteAssetUrl(campaign.coverImageUrl) ?? modelImages.Comum.front,
    prices,
    deadline: Number.isNaN(deadline.getTime())
      ? "Prazo definido pela camisaria"
      : `Pedidos até ${deadline.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`,
    pickup: campaign.pickupInstructions,
    representative: campaign.representativeName,
    modelImages,
    colors,
    variantIds,
  };
}

export async function fetchCampaignFromApi(code: string) {
  const payload = await request<{ campaign: ApiCampaign }>(`/campaigns/${encodeURIComponent(code)}`);
  return mapCampaign(payload.campaign);
}

export async function createOrderInApi(input: CreateOrderInput) {
  const payload = await request<{ order: { number: string; totalCents: number; paymentStatus: string } }>("/orders", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      campaignCode: input.campaignCode,
      customer: input.customer,
      items: [{ variantId: input.variantId, size: input.size, quantity: input.quantity }],
    }),
  });
  return payload.order;
}

export async function trackOrderInApi(orderNumber: string, whatsapp: string) {
  const query = new URLSearchParams({ whatsapp });
  const payload = await request<{ order: TrackedOrder }>(
    `/orders/${encodeURIComponent(orderNumber)}?${query.toString()}`,
  );
  return payload.order;
}
