import { shirtColors, shirtModels, sortSizes } from "./data";
import type { PrivateCampaign, ShirtColorName, ShirtColorOption, ShirtModelName, SizeCode } from "./data";

type ApiCampaignVariant = {
  id: number;
  model: { code: string; name: string };
  color: { name: string; hex: string };
  unitPriceCents: number;
};

type ApiCampaignSize = {
  model: { code: string; name: string };
  code: string;
  name: string;
  group: "standard" | "baby_look";
};

export type ApiCampaign = {
  code: string;
  title: string;
  subtitle: string | null;
  phase: string;
  deadlineAt: string;
  pickupInstructions: string;
  representativeName: string;
  representativeWhatsapp: string | null;
  artFrontUrl: string | null;
  artBackUrl: string | null;
  variants: ApiCampaignVariant[];
  sizes: ApiCampaignSize[];
};

/** Configuração pública servida pela API: nada disso fica fixo no bundle. */
export type ApiSettings = {
  payment: {
    provider: "infinitepay" | string;
    checkoutEnabled: boolean;
    methods: Array<"pix" | "credit_card" | string>;
  };
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
  status: "pending" | "confirmed" | "failed" | "ready" | "delivered" | "cancelled";
  cancellationReason: string | null;
  paymentStatus: string;
  totalCents: number;
  campaign: {
    code: string;
    title: string;
    representativeName: string;
    artFrontUrl: string | null;
    artBackUrl: string | null;
  };
  items: Array<{
    modelName: string;
    color: { name: string; hex: string };
    size: string;
    sizeGroup: "standard" | "baby_look";
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
  // O `.env.example` traz localhost para o desenvolvimento. Em um build de produção,
  // nunca deixe esse valor ser empacotado por engano: o Nginx publica site e API na
  // mesma origem, então produção usa `/api` sem qualquer override do Vite.
  if (import.meta.env.PROD) return `${window.location.origin}/api`;
  const configured = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    return "http://127.0.0.1:3333/api";
  }
  return `${window.location.origin}/api`;
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
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

export function assetUrl(value: string | null) {
  if (!value) return null;
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
  const origin = new URL(apiBase()).origin;
  return new URL(value, origin).toString();
}

function mapCampaign(campaign: ApiCampaign): PrivateCampaign {
  const prices = {} as Record<ShirtModelName, number>;
  const colors = {} as Record<ShirtModelName, ShirtColorOption[]>;
  const sizes = {} as Record<ShirtModelName, SizeCode[]>;
  const variantIds: NonNullable<PrivateCampaign["variantIds"]> = {};

  for (const model of shirtModels) {
    const variants = campaign.variants.filter((variant) => variant.model.name === model.name);
    prices[model.name] = (variants[0]?.unitPriceCents ?? 0) / 100;
    colors[model.name] = variants.map((variant) => {
      const known = shirtColors.find((color) => color.name === variant.color.name);
      return known ?? { name: variant.color.name, hex: variant.color.hex };
    });
    sizes[model.name] = sortSizes(
      campaign.sizes.filter((size) => size.model.name === model.name).map((size) => size.code as SizeCode),
    );
    variantIds[model.name] = Object.fromEntries(
      variants.map((variant) => [variant.color.name, variant.id]),
    );
  }

  const deadline = new Date(campaign.deadlineAt);
  return {
    code: campaign.code,
    title: campaign.title,
    subtitle: campaign.subtitle ?? "Campanha exclusiva para os alunos da turma",
    art: {
      front: assetUrl(campaign.artFrontUrl) ?? shirtModels[0].image,
      back: assetUrl(campaign.artBackUrl),
    },
    prices,
    sizes,
    deadline: Number.isNaN(deadline.getTime())
      ? "Prazo definido pela camisaria"
      : `Pedidos até ${deadline.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`,
    pickup: campaign.pickupInstructions,
    representative: campaign.representativeName,
    representativeWhatsapp: campaign.representativeWhatsapp,
    colors,
    variantIds,
  };
}

export async function fetchCampaignFromApi(code: string) {
  const payload = await request<{ campaign: ApiCampaign }>(`/campaigns/${encodeURIComponent(code)}`);
  return mapCampaign(payload.campaign);
}

export async function fetchSettings() {
  return request<ApiSettings>("/settings");
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

/* ------------------------------------------------------------------ */
/* Sessão da equipe                                                    */
/* ------------------------------------------------------------------ */

export const STAFF_TOKEN_KEY = "camisaria-mendes-staff-token";

export type StaffUser = { name: string; email: string; role: string; mustChangePassword?: boolean };

export function staffToken() {
  return sessionStorage.getItem(STAFF_TOKEN_KEY) ?? "";
}

export function setStaffToken(token: string | null) {
  if (token) sessionStorage.setItem(STAFF_TOKEN_KEY, token);
  else sessionStorage.removeItem(STAFF_TOKEN_KEY);
}

/** Toda rota do painel viaja com o token da sessão, nunca com a chave do servidor. */
function staffRequest<T>(path: string, init?: RequestInit, timeoutMs?: number) {
  const token = staffToken();
  if (!token) throw new ApiRequestError(401, "NO_SESSION", "Faça login para acessar o painel.");
  return request<T>(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } }, timeoutMs);
}

export async function loginStaff(email: string, password: string) {
  const payload = await request<{ token: string; expiresAt: string; user: StaffUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setStaffToken(payload.token);
  return payload;
}

export async function logoutStaff() {
  try {
    if (staffToken()) await staffRequest<void>("/auth/logout", { method: "POST" });
  } catch {
    // Encerrar a sessão local é o que importa; a do servidor expira por prazo.
  } finally {
    setStaffToken(null);
  }
}

export async function fetchStaffSession() {
  const payload = await staffRequest<{ user: StaffUser; expiresAt: string }>("/auth/session");
  return payload.user;
}

/* ------------------------------------------------------------------ */
/* Conta e recuperação de senha                                        */
/* ------------------------------------------------------------------ */

export type AccountUpdate = { name: string; email: string; currentPassword: string; newPassword?: string };

export async function updateStaffAccount(input: AccountUpdate) {
  const payload = await staffRequest<{ user: StaffUser; passwordChanged: boolean }>("/admin/account", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload;
}

/**
 * A API responde igual para e-mail cadastrado ou não. `delivery` diz apenas se o
 * envio por e-mail está disponível neste servidor — nunca se a conta existe.
 */
export async function requestPasswordReset(email: string) {
  const payload = await request<{ delivery: "email" | "unavailable" }>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  }, 30000);
  return payload.delivery;
}

export async function checkPasswordResetToken(token: string) {
  return request<{ email: string; name: string }>(`/auth/password/reset?token=${encodeURIComponent(token)}`);
}

export async function confirmPasswordReset(token: string, password: string) {
  return request<{ email: string }>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

/* ------------------------------------------------------------------ */
/* Painel da camisaria                                                 */
/* ------------------------------------------------------------------ */

export type CampaignPhaseCode =
  | "receiving_orders"
  | "orders_closed"
  | "production"
  | "ready_for_delivery"
  | "completed";

export type PaymentStatusCode = "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
export type DeliveryStatusCode = "waiting_campaign" | "ready" | "delivered" | "issue";

export type ApiAdminCampaign = {
  code: string;
  title: string;
  subtitle: string | null;
  phase: CampaignPhaseCode;
  deadlineAt: string;
  pickupInstructions: string;
  representative: { name: string; whatsapp: string | null };
  artFrontUrl: string | null;
  artBackUrl: string | null;
  orderCount: number;
  paidTotalCents: number;
};

export type ApiCampaignOrder = {
  number: string;
  customer: { name: string; whatsapp: string; email: string | null };
  status: "active" | "cancelled";
  cancellationReason: string | null;
  paymentStatus: PaymentStatusCode;
  deliveryStatus: DeliveryStatusCode;
  totalCents: number;
  createdAt: string;
  item: {
    modelName: string;
    color: { name: string; hex: string };
    size: string;
    sizeGroup: "standard" | "baby_look";
    quantity: number;
    unitPriceCents: number;
  };
};

export type ApiProductionRow = {
  campaignCode: string;
  campaignTitle: string;
  modelName: string;
  color: { name: string; hex: string };
  size: string;
  sizeGroup: "standard" | "baby_look";
  /** Ordem configurada no catálogo de tamanhos; mantém novas grades dinâmicas. */
  sizeSortOrder?: number;
  quantity: number;
};

export type ApiDeliveryRow = {
  campaignCode: string;
  campaignTitle: string;
  representativeName: string;
  orderNumber: string;
  customerName: string;
  customerWhatsapp: string;
  modelName: string;
  colorName: string;
  size: string;
  quantity: number;
  deliveryStatus: DeliveryStatusCode;
};

export type CampaignColorPayload = { name: string; hex: string };
export type CampaignModelPayload = { modelCode: string; unitPriceCents: number; colors: CampaignColorPayload[]; sizes: string[] };

export type CreateCampaignPayload = {
  code?: string;
  title: string;
  subtitle?: string;
  deadlineAt: string;
  pickupInstructions: string;
  representative: { name: string; whatsapp: string };
  artFrontUrl: string;
  artBackUrl?: string | null;
  models: CampaignModelPayload[];
};

/**
 * Só o que foi enviado é alterado. `models` fica de fora quando a campanha já saiu de
 * "recebendo pedidos": a API recusaria, e a tela desabilita esses campos antes disso.
 */
export type UpdateCampaignPayload = {
  title?: string;
  subtitle?: string | null;
  deadlineAt?: string;
  pickupInstructions?: string;
  representative?: { name: string; whatsapp: string };
  artFrontUrl?: string;
  artBackUrl?: string | null;
  models?: CampaignModelPayload[];
};

export async function fetchAdminCampaigns() {
  const payload = await staffRequest<{ campaigns: ApiAdminCampaign[] }>("/admin/campaigns");
  return payload.campaigns;
}

export async function fetchCampaignOrders(code: string) {
  const payload = await staffRequest<{ orders: ApiCampaignOrder[] }>(
    `/admin/campaigns/${encodeURIComponent(code)}/orders`,
  );
  return payload.orders;
}

/** Envia o binário puro: a campanha guarda só a URL, porque um data URI não caberia. */
export async function uploadCampaignArt(file: File) {
  const payload = await staffRequest<{ url: string; bytes: number }>(
    "/admin/uploads",
    { method: "POST", headers: { "Content-Type": file.type }, body: file },
    30000,
  );
  return payload.url;
}

export async function createCampaignInApi(input: CreateCampaignPayload) {
  const payload = await staffRequest<{ campaign: { code: string } }>("/admin/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.campaign;
}

/** Campanha crua, como a API devolve, para preencher o formulário de edição. */
export async function fetchCampaignDetail(code: string) {
  const payload = await request<{ campaign: ApiCampaign }>(`/campaigns/${encodeURIComponent(code)}`);
  return payload.campaign;
}

export async function updateCampaignInApi(code: string, input: UpdateCampaignPayload) {
  const payload = await staffRequest<{ campaign: { code: string } }>(
    `/admin/campaigns/${encodeURIComponent(code)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return payload.campaign;
}

export async function cancelOrderInApi(orderNumber: string, reason: string) {
  const payload = await staffRequest<{ order: { number: string; status: string } }>(
    `/admin/orders/${encodeURIComponent(orderNumber)}/cancel`,
    { method: "PATCH", body: JSON.stringify({ reason }) },
  );
  return payload.order;
}

export async function changeCampaignPhaseInApi(code: string, targetPhase: CampaignPhaseCode, reason?: string) {
  const payload = await staffRequest<{ campaign: { phase: CampaignPhaseCode; previousPhase: CampaignPhaseCode } }>(
    `/admin/campaigns/${encodeURIComponent(code)}/phase`,
    { method: "PATCH", body: JSON.stringify({ targetPhase, reason }) },
  );
  return payload.campaign;
}

export async function changeOrderDeliveryInApi(orderNumber: string, status: "ready" | "delivered" | "issue", note?: string) {
  const payload = await staffRequest<{ order: { deliveryStatus: DeliveryStatusCode } }>(
    `/admin/orders/${encodeURIComponent(orderNumber)}/delivery`,
    { method: "PATCH", body: JSON.stringify({ status, note }) },
  );
  return payload.order;
}

function reportQuery(campaignCode?: string) {
  return campaignCode ? `?campaign=${encodeURIComponent(campaignCode)}` : "";
}

export async function fetchProductionReport(campaignCode?: string) {
  const payload = await staffRequest<{ rows: ApiProductionRow[] }>(`/admin/reports/production${reportQuery(campaignCode)}`);
  return payload.rows;
}

export async function fetchDeliveryReport(campaignCode?: string) {
  const payload = await staffRequest<{ rows: ApiDeliveryRow[] }>(`/admin/reports/delivery${reportQuery(campaignCode)}`);
  return payload.rows;
}
