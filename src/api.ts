import { shirtColors, shirtModels, sortSizes } from "./data";
import type { ArtworkTransform, PrivateCampaign, ShirtColorName, ShirtColorOption, ShirtModelName, SizeCode, VariantArtwork } from "./data";

export type ArtworkSource = "inherit" | "custom" | "none";
export type ArtworkSideConfig = {
  source: ArtworkSource;
  url?: string | null;
  transformOverride?: boolean;
  transform: ArtworkTransform;
};
export type VariantArtworkConfig = {
  modelCode: string;
  colorName: string;
  front: ArtworkSideConfig;
  back: ArtworkSideConfig;
};
export type CampaignArtworkConfig = {
  mode: "overlay" | "variant_mockup";
  base: {
    front: { url: string; transform: ArtworkTransform } | null;
    back: { url: string; transform: ArtworkTransform } | null;
  };
  variants: VariantArtworkConfig[];
};

type ApiCampaignVariant = {
  id: number;
  model: { code: string; name: string };
  color: { name: string; hex: string };
  unitPriceCents: number;
  artwork: VariantArtwork;
  artworkConfig?: {
    front: ArtworkSideConfig;
    back: ArtworkSideConfig;
  } | null;
  artworkConfigs?: Partial<Record<"overlay" | "variant_mockup", {
    front: ArtworkSideConfig;
    back: ArtworkSideConfig;
  }>>;
  realPhotoUrls?: string[];
};

export type CampaignRealPhotoConfig = { colorName: string; urls: string[] };
export type CampaignRealVideoConfig = { colorName: string; url: string; posterUrl?: string | null; durationSeconds?: number | null; bytes: number };
export type CampaignPresentationConfig = { mockupEnabled: boolean; realPhotosEnabled: boolean };

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
  artRenderMode: "overlay" | "variant_mockup" | "legacy_mockup";
  presentationConfig?: CampaignPresentationConfig;
  artworkConfig?: {
    mode: "overlay" | "variant_mockup" | "legacy_mockup";
    base: {
      front: { url: string; transform: ArtworkTransform } | null;
      back: { url: string; transform: ArtworkTransform } | null;
    };
  };
  realPhotos?: CampaignRealPhotoConfig[];
  realVideos?: CampaignRealVideoConfig[];
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
  customer: { name: string; whatsapp: string; email: string };
  items: Array<{ variantId: number; size: string; quantity: number }>;
  idempotencyKey: string;
};

export type TrackedOrder = {
  number: string;
  status: "pending" | "confirmed" | "production" | "failed" | "ready" | "delivered" | "cancelled";
  cancellationReason: string | null;
  paymentStatus: string;
  totalCents: number;
  campaign: {
    code: string;
    title: string;
    representativeName: string;
    artFrontUrl: string | null;
    artBackUrl: string | null;
    artRenderMode: "overlay" | "variant_mockup" | "legacy_mockup";
  };
  items: Array<{
    modelName: string;
    color: { name: string; hex: string };
    size: string;
    sizeGroup: "standard" | "baby_look";
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    artwork: VariantArtwork;
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
  const variantArtworks: NonNullable<PrivateCampaign["variantArtworks"]> = {};
  const realPhotos: NonNullable<PrivateCampaign["realPhotos"]> = {};
  const realVideos: NonNullable<PrivateCampaign["realVideos"]> = {};
  const models: ShirtModelName[] = [];

  for (const model of shirtModels) {
    const variants = campaign.variants.filter((variant) => variant.model.name === model.name);
    if (variants.length > 0) models.push(model.name);
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
    variants.forEach((variant) => {
      if (!variant.artwork) return;
      variantArtworks[variant.id] = {
        front: variant.artwork.front ? { ...variant.artwork.front, url: assetUrl(variant.artwork.front.url) ?? variant.artwork.front.url } : null,
        back: variant.artwork.back ? { ...variant.artwork.back, url: assetUrl(variant.artwork.back.url) ?? variant.artwork.back.url } : null,
      };
      if (variant.realPhotoUrls?.length && !realPhotos[variant.color.name]) {
        realPhotos[variant.color.name] = variant.realPhotoUrls.map((url) => assetUrl(url) ?? url);
      }
    });
  }
  for (const gallery of campaign.realPhotos ?? []) {
    realPhotos[gallery.colorName] = gallery.urls.map((url) => assetUrl(url) ?? url);
  }
  for (const video of campaign.realVideos ?? []) {
    realVideos[video.colorName] = {
      url: assetUrl(video.url) ?? video.url,
      posterUrl: assetUrl(video.posterUrl ?? null) ?? undefined,
      durationSeconds: video.durationSeconds ?? undefined,
      bytes: video.bytes,
    };
  }

  const deadline = new Date(campaign.deadlineAt);
  return {
    code: campaign.code,
    title: campaign.title,
    subtitle: campaign.subtitle ?? "Campanha exclusiva para os alunos da turma",
    art: {
      front: assetUrl(campaign.artFrontUrl) ?? shirtModels[0].image,
      back: assetUrl(campaign.artBackUrl),
      mode: campaign.artRenderMode,
      frontTransform: campaign.artworkConfig?.base.front?.transform,
      backTransform: campaign.artworkConfig?.base.back?.transform,
    },
    models,
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
    variantArtworks,
    realPhotos,
    realVideos,
    presentation: campaign.presentationConfig ?? { mockupEnabled: true, realPhotosEnabled: false },
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
      items: input.items,
    }),
  });
  return payload.order;
}

export async function createInfinitePayCheckout(orderNumber: string, whatsapp: string) {
  const payload = await request<{ checkout: { url: string; reused: boolean } }>(
    `/orders/${encodeURIComponent(orderNumber)}/checkout`,
    { method: "POST", body: JSON.stringify({ whatsapp }) },
    15000,
  );
  return payload.checkout;
}

export async function requestInfinitePayReconciliation(input: {
  orderNsu: string;
  transactionNsu: string;
  invoiceSlug: string;
  receiptUrl?: string;
  captureMethod?: string;
}) {
  return request<{ accepted: boolean; duplicate: boolean }>("/payments/infinitepay/reconcile", {
    method: "POST",
    body: JSON.stringify({
      order_nsu: input.orderNsu,
      transaction_nsu: input.transactionNsu,
      slug: input.invoiceSlug,
      receipt_url: input.receiptUrl,
      capture_method: input.captureMethod,
    }),
  });
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
  artRenderMode: "overlay" | "variant_mockup" | "legacy_mockup";
  orderCount: number;
  paidTotalCents: number;
  canDelete: boolean;
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
  artFrontUrl?: string | null;
  artBackUrl?: string | null;
  artRenderMode?: "overlay" | "variant_mockup";
  artworkConfig?: CampaignArtworkConfig;
  presentationConfig: CampaignPresentationConfig;
  realPhotos?: CampaignRealPhotoConfig[];
  realVideos?: CampaignRealVideoConfig[];
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
  artRenderMode?: "overlay" | "variant_mockup" | "legacy_mockup";
  artworkConfig?: CampaignArtworkConfig;
  presentationConfig?: CampaignPresentationConfig;
  realPhotos?: CampaignRealPhotoConfig[];
  realVideos?: CampaignRealVideoConfig[];
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

/** XMLHttpRequest mantém o progresso real do corpo binário e permite cancelar o envio. */
export function uploadCampaignVideo(
  file: File,
  options: { onProgress?: (sent: number, total: number) => void; signal?: AbortSignal } = {},
) {
  const token = staffToken();
  if (!token) return Promise.reject(new ApiRequestError(401, "NO_SESSION", "Faça login para acessar o painel."));
  return new Promise<{ url: string; bytes: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open("POST", `${apiBase()}/admin/video-uploads`);
    xhr.timeout = 60000;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", "video/mp4");
    xhr.upload.onprogress = (event) => options.onProgress?.(event.loaded, event.lengthComputable ? event.total : file.size);
    xhr.onload = () => {
      options.signal?.removeEventListener("abort", abort);
      let payload: { url?: string; bytes?: number; error?: { code?: string; message?: string } } = {};
      try { payload = JSON.parse(xhr.responseText || "{}"); } catch { /* resposta inválida */ }
      if (xhr.status >= 200 && xhr.status < 300 && payload.url && typeof payload.bytes === "number") {
        resolve({ url: payload.url, bytes: payload.bytes });
      } else {
        reject(new ApiRequestError(xhr.status, payload.error?.code ?? "VIDEO_UPLOAD_FAILED", payload.error?.message ?? "Não foi possível enviar o vídeo."));
      }
    };
    xhr.onerror = () => reject(new ApiRequestError(0, "API_UNAVAILABLE", "Não foi possível conectar ao servidor."));
    xhr.ontimeout = () => reject(new ApiRequestError(0, "VIDEO_UPLOAD_TIMEOUT", "O envio do vídeo excedeu o tempo limite."));
    xhr.onabort = () => reject(new ApiRequestError(0, "VIDEO_UPLOAD_CANCELLED", "Envio cancelado."));
    if (options.signal?.aborted) return abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    xhr.send(file);
  });
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

export async function deleteCampaignInApi(code: string) {
  const payload = await staffRequest<{ campaign: { code: string; deleted: true } }>(
    `/admin/campaigns/${encodeURIComponent(code)}`,
    { method: "DELETE" },
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

export async function registerOrderRefundInApi(input: {
  orderNumber: string;
  amountCents: number;
  providerRefundId: string;
  reason: string;
  receiptUrl?: string;
}) {
  const payload = await staffRequest<{
    refund: { number: string; status: string; paymentStatus: "refunded"; amountCents: number };
  }>(`/admin/orders/${encodeURIComponent(input.orderNumber)}/refund`, {
    method: "POST",
    body: JSON.stringify({
      amountCents: input.amountCents,
      providerRefundId: input.providerRefundId,
      reason: input.reason,
      receiptUrl: input.receiptUrl || undefined,
    }),
  });
  return payload.refund;
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
