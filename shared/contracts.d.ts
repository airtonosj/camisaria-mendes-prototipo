import type { ArtworkTransform, VariantArtwork } from "./artwork";

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

export type ApiCampaignVariant = {
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

export type CampaignCoupon = {
  code: string;
  discounts: Array<{ modelCode: string; modelName: string; discountCents: number }>;
  expiresAt: string | null;
  usageLimit?: number | null;
  minimumQuantity: number;
  maximumDiscountQuantity: number | null;
  usedCount?: number;
  remainingUses?: number | null;
};

export type CampaignCouponPayload = {
  code: string;
  discounts: Array<{ modelCode: string; discountCents: number }>;
  expiresAt: string | null;
  usageLimit: number | null;
  minimumQuantity: number;
  maximumDiscountQuantity: number | null;
};

export type ApiCampaignSize = {
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
  activeCoupon?: CampaignCoupon | null;
  /** Só no detalhe do painel; a página pública nunca recebe a conta de destino. */
  receiver?: CampaignReceiverSummary | null;
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

export type CreateOrderInput = {
  campaignCode: string;
  customer: { name: string; whatsapp: string; email: string };
  items: Array<{ variantId: number; size: string; quantity: number }>;
  couponCode?: string;
  idempotencyKey: string;
};

export type TrackedOrder = {
  number: string;
  status: "pending" | "confirmed" | "production" | "failed" | "ready" | "delivered" | "cancelled";
  cancellationReason: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
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
    unitDiscountCents: number;
    discountedQuantity: number;
    lineTotalCents: number;
    artwork: VariantArtwork;
  }>;
};

export type StaffUser = { name: string; email: string; role: string; mustChangePassword?: boolean };

/* ------------------------------------------------------------------ */
/* Conta e recuperação de senha                                        */
/* ------------------------------------------------------------------ */

export type AccountUpdate = { name: string; email: string; currentPassword: string; newPassword?: string };

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

export type CampaignCouponStats = {
  id: number;
  code: string;
  active: boolean;
  usedCount: number;
  paidCount: number;
  pendingCount: number;
  cancelledCount: number;
  refundedCount: number;
  failedCount: number;
  usageLimit: number | null;
};

export type ApiAdminCampaign = {
  basePrices?: Array<{ modelName: string; minPriceCents: number; maxPriceCents: number }>;
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
  activeCoupon: CampaignCoupon | null;
  couponHistory: CampaignCouponStats[];
  /** Conta InfinitePay de destino. `null` usa a conta padrão do servidor. */
  receiver: CampaignReceiverSummary | null;
};

export type CampaignReceiverSummary = { id: number; name: string; infinitepayHandle: string; active: boolean };

/** Recebedor de pagamento: só uma conta InfinitePay de destino, sem acesso ao painel. */
export type ApiPaymentReceiver = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  /** InfiniteTag sem o cifrão. */
  infinitepayHandle: string;
  active: boolean;
  campaigns: Array<{ code: string; title: string }>;
};

export type CreateReceiverPayload = { name: string; email?: string | null; phone?: string | null; infinitepayHandle: string };

export type UpdateReceiverPayload = Partial<CreateReceiverPayload> & { active?: boolean };

export type ApiCampaignOrder = {
  number: string;
  customer: { name: string; whatsapp: string; email: string | null };
  status: "active" | "cancelled";
  cancellationReason: string | null;
  paymentStatus: PaymentStatusCode;
  paymentMethod: string | null;
  deliveryStatus: DeliveryStatusCode;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  createdAt: string;
  items: Array<{
    modelName: string;
    color: { name: string; hex: string };
    size: string;
    sizeGroup: "standard" | "baby_look";
    quantity: number;
    unitPriceCents: number;
    unitDiscountCents: number;
    discountedQuantity: number;
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
  coupon?: CampaignCouponPayload | null;
  receiverId?: number | null;
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
  coupon?: CampaignCouponPayload | null;
  receiverId?: number | null;
  models?: CampaignModelPayload[];
};

export type PickupSettings = { instructions: string; representative: string; phone: string; groupUrl: string };

export type PickupInfo = { settings: PickupSettings; eligible: number; configured: boolean; history: Array<{ status: string; count: number }> };

export type PickupPreview = { batchId: string; count: number; subject: string; text: string };

export interface EmailHistoryItem {
  id: string; orderNumber: string; customerName: string; recipient: string; type: string;
  status: string; attempts: number; createdAt: string; sentAt: string | null;
  subject: string | null; text: string | null;
}

export interface EmailHistory {
  page: number; pages: number; total: number; items: EmailHistoryItem[];
  summary: { status: string; count: number }[];
}
