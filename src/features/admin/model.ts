import { campaignPhases } from '../../../shared/domain.mjs';
import type { CampaignPhaseCode, CampaignCoupon, CampaignCouponStats, CampaignReceiverSummary, DeliveryStatusCode, PaymentStatusCode } from "../../api";
import type { SizeCode } from "../../data";

export type AdminSection = "overview" | "campaigns" | "orders" | "products" | "reports" | "account";

/**
 * `demo` só existe em desenvolvimento. No site publicado, uma API fora do ar leva a
 * `error`: o painel mostra o problema e um botão para tentar de novo, nunca campanhas
 * e pedidos inventados que a equipe possa confundir com os reais.
 */
export type PanelMode = "live" | "demo" | "error";

/* ------------------------------------------------------------------ */
/* Vocabulário do domínio                                              */
/* ------------------------------------------------------------------ */

export const phaseOrder: CampaignPhaseCode[] = [...campaignPhases];

/**
 * `label` nomeia a fase, `short` completa frases como "Avançar para ..." e `sentence`
 * é o estado atual escrito por extenso — sem isso, "está em" + "Em produção" viraria
 * "está em em produção".
 */
export const phaseMeta: Record<CampaignPhaseCode, { label: string; short: string; sentence: string; icon: string; tone: string }> = {
  receiving_orders: { label: "Recebendo pedidos", short: "recebendo pedidos", sentence: "A campanha está recebendo pedidos.", icon: "shopping_cart", tone: "receiving" },
  orders_closed: { label: "Pedidos encerrados", short: "pedidos encerrados", sentence: "Os pedidos da campanha estão encerrados.", icon: "fact_check", tone: "locked" },
  production: { label: "Em produção", short: "produção", sentence: "A campanha está em produção.", icon: "precision_manufacturing", tone: "production" },
  ready_for_delivery: { label: "Pronta para entrega", short: "pronta para entrega", sentence: "A campanha está pronta para entrega.", icon: "inventory_2", tone: "ready" },
  completed: { label: "Finalizada", short: "finalizada", sentence: "A campanha está finalizada.", icon: "check_circle", tone: "finished" },
};

export const paymentLabels: Record<PaymentStatusCode, string> = {
  pending: "Aguardando",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
};

export const deliveryLabels: Record<DeliveryStatusCode, string> = {
  waiting_campaign: "Aguardando campanha",
  ready: "A entregar",
  delivered: "Entregue",
  issue: "Ocorrência",
};

export const readyPhaseIndex = phaseOrder.indexOf("ready_for_delivery");

/** A campanha manda na entrega: nada é liberado antes de ela estar pronta. */
export function effectiveDelivery(order: PanelOrder, phase: CampaignPhaseCode): DeliveryStatusCode {
  if (order.paymentStatus !== "paid") return "waiting_campaign";
  if (order.deliveryStatus === "delivered" || order.deliveryStatus === "issue") return order.deliveryStatus;
  return phaseOrder.indexOf(phase) >= readyPhaseIndex ? "ready" : "waiting_campaign";
}

export type PanelCampaign = {
  basePrices?: Array<{ modelName: string; minPriceCents: number; maxPriceCents: number }>;
  code: string;
  title: string;
  subtitle?: string | null;
  phase: CampaignPhaseCode;
  deadlineLabel: string;
  representative: string;
  artFront: string;
  orderCount: number;
  paidTotalCents: number;
  canDelete: boolean;
  activeCoupon?: CampaignCoupon | null;
  couponHistory?: CampaignCouponStats[];
  receiver?: CampaignReceiverSummary | null;
};

export type PanelOrder = {
  couponCode?: string | null;
  subtotalCents?: number;
  discountCents?: number;
  number: string;
  customer: string;
  whatsapp: string;
  email?: string | null;
  model: string;
  color: string;
  colorHex: string;
  size: SizeCode;
  quantity: number;
  paymentStatus: PaymentStatusCode;
  paymentMethod?: string | null;
  deliveryStatus: DeliveryStatusCode;
  totalCents: number;
  createdAt?: string;
  /** Ausente nos dados de demonstração, que só têm pedidos ativos. */
  status?: "active" | "cancelled";
  cancellationReason?: string | null;
  items?: Array<{ model: string; color: string; colorHex: string; size: SizeCode; quantity: number; unitPriceCents: number; lineTotalCents?: number }>;
};

export function panelOrderItems(order: PanelOrder) {
  return order.items?.length ? order.items : [{
    model: order.model,
    color: order.color,
    colorHex: order.colorHex,
    size: order.size,
    quantity: order.quantity,
    unitPriceCents: order.quantity ? Math.round(order.totalCents / order.quantity) : order.totalCents,
  }];
}

export function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatOrderDateTime(value: string | undefined, compact = false) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const date = parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    ...(compact ? {} : { year: "numeric" as const }),
  });
  const time = parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return compact ? `${date} · ${time}` : `${date} às ${time}`;
}

export function formatDeadline(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Prazo definido pela camisaria";
  return `Pedidos até ${parsed.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
}

export function parseCampaignPrice(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function priceInput(cents: number | undefined) {
  return cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Data para o `input type="date"` lida no fuso local. O prazo é gravado como 23:59:59
 * local e vira o dia seguinte em UTC — usar a data ISO traria um dia a mais na tela.
 */
export function dateInput(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export const defaultPickupInstructions = "Retirada com o representante da turma";

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/* ------------------------------------------------------------------ */
/* Carga dos dados                                                     */
/* ------------------------------------------------------------------ */

export type PanelData = {
  mode: PanelMode;
  campaigns: PanelCampaign[];
  orders: Record<string, PanelOrder[]>;
  loading: boolean;
  error: string;
  /** Conta as recargas; quem depende dela refaz a própria busca ao "tentar novamente". */
  attempt: number;
  loadOrders: (code: string) => void;
  reload: () => void;
};
