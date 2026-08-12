import { ChangeEvent, CSSProperties, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  assetUrl,
  cancelOrderInApi,
  changeCampaignPhaseInApi,
  changeOrderDeliveryInApi,
  createCampaignInApi,
  fetchAdminCampaigns,
  fetchCampaignDetail,
  updateCampaignInApi,
  fetchCampaignOrders,
  fetchDeliveryReport,
  fetchProductionReport,
  fetchStaffSession,
  logoutStaff,
  registerOrderRefundInApi,
  staffToken,
  updateStaffAccount,
  uploadCampaignArt,
} from "../api";
import type {
  ApiDeliveryRow,
  ApiProductionRow,
  CampaignPhaseCode,
  DeliveryStatusCode,
  PaymentStatusCode,
  StaffUser,
  UpdateCampaignPayload,
} from "../api";
import { buildRoute, STAFF_SESSION_KEY } from "../App";
import {
  defaultCampaignColors,
  defaultCampaignSizes,
  shirtColors,
  shirtModels,
  showcaseCampaigns,
  sizeGroupLabels,
  sizesInGroup,
  sortSizes,
} from "../data";
import type { ShirtColorName, ShirtColorOption, ShirtModelName, SizeCode, SizeGroup } from "../data";
import { Brand } from "./Brand";
import {
  buildProductionSheets,
  downloadProductionExcel,
  printProductionReport,
  ProductionReport,
} from "./ProductionReport";

type AdminSection = "overview" | "campaigns" | "orders" | "products" | "reports" | "account";

/**
 * `demo` só existe em desenvolvimento. No site publicado, uma API fora do ar leva a
 * `error`: o painel mostra o problema e um botão para tentar de novo, nunca campanhas
 * e pedidos inventados que a equipe possa confundir com os reais.
 */
type PanelMode = "live" | "demo" | "error";

const nav: Array<[AdminSection, string, string]> = [
  ["overview", "dashboard", "Visão geral"],
  ["campaigns", "campaign", "Campanhas"],
  ["orders", "receipt_long", "Pedidos"],
  ["products", "checkroom", "Produtos"],
  ["reports", "monitoring", "Relatórios"],
  ["account", "manage_accounts", "Conta"],
];

/* ------------------------------------------------------------------ */
/* Vocabulário do domínio                                              */
/* ------------------------------------------------------------------ */

const phaseOrder: CampaignPhaseCode[] = [
  "receiving_orders",
  "orders_closed",
  "production",
  "ready_for_delivery",
  "completed",
];

/**
 * `label` nomeia a fase, `short` completa frases como "Avançar para ..." e `sentence`
 * é o estado atual escrito por extenso — sem isso, "está em" + "Em produção" viraria
 * "está em em produção".
 */
const phaseMeta: Record<CampaignPhaseCode, { label: string; short: string; sentence: string; icon: string; tone: string }> = {
  receiving_orders: { label: "Recebendo pedidos", short: "recebendo pedidos", sentence: "A campanha está recebendo pedidos.", icon: "shopping_cart", tone: "receiving" },
  orders_closed: { label: "Pedidos encerrados", short: "pedidos encerrados", sentence: "Os pedidos da campanha estão encerrados.", icon: "fact_check", tone: "locked" },
  production: { label: "Em produção", short: "produção", sentence: "A campanha está em produção.", icon: "precision_manufacturing", tone: "production" },
  ready_for_delivery: { label: "Pronta para entrega", short: "pronta para entrega", sentence: "A campanha está pronta para entrega.", icon: "inventory_2", tone: "ready" },
  completed: { label: "Finalizada", short: "finalizada", sentence: "A campanha está finalizada.", icon: "check_circle", tone: "finished" },
};

const paymentLabels: Record<PaymentStatusCode, string> = {
  pending: "Aguardando",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
};

const deliveryLabels: Record<DeliveryStatusCode, string> = {
  waiting_campaign: "Aguardando campanha",
  ready: "A entregar",
  delivered: "Entregue",
  issue: "Ocorrência",
};

const readyPhaseIndex = phaseOrder.indexOf("ready_for_delivery");

/** A campanha manda na entrega: nada é liberado antes de ela estar pronta. */
function effectiveDelivery(order: PanelOrder, phase: CampaignPhaseCode): DeliveryStatusCode {
  if (order.paymentStatus !== "paid") return "waiting_campaign";
  if (order.deliveryStatus === "delivered" || order.deliveryStatus === "issue") return order.deliveryStatus;
  return phaseOrder.indexOf(phase) >= readyPhaseIndex ? "ready" : "waiting_campaign";
}

type PanelCampaign = {
  code: string;
  title: string;
  subtitle?: string | null;
  phase: CampaignPhaseCode;
  deadlineLabel: string;
  representative: string;
  artFront: string;
  orderCount: number;
  paidTotalCents: number;
};

type PanelOrder = {
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
  deliveryStatus: DeliveryStatusCode;
  totalCents: number;
  /** Ausente nos dados de demonstração, que só têm pedidos ativos. */
  status?: "active" | "cancelled";
  cancellationReason?: string | null;
  items?: Array<{ model: string; color: string; colorHex: string; size: SizeCode; quantity: number; unitPriceCents: number }>;
};

function panelOrderItems(order: PanelOrder) {
  return order.items?.length ? order.items : [{
    model: order.model,
    color: order.color,
    colorHex: order.colorHex,
    size: order.size,
    quantity: order.quantity,
    unitPriceCents: order.quantity ? Math.round(order.totalCents / order.quantity) : order.totalCents,
  }];
}

/* ------------------------------------------------------------------ */
/* Dados de demonstração, no mesmo formato que a API devolve            */
/* ------------------------------------------------------------------ */

const demoCampaigns: PanelCampaign[] = [
  { code: "MENDES-ENG-26", title: "Engenharia Civil — Turma 2026", subtitle: "Ficha de corte e confecção", phase: "production", deadlineLabel: "Pedidos até 31 de agosto de 2026", representative: "Lucas Pereira", artFront: showcaseCampaigns[0].image, orderCount: 6, paidTotalCents: 491180 },
  { code: "MENDES-ENF-26", title: "Enfermagem — 8º período", subtitle: "Ficha de corte e confecção", phase: "ready_for_delivery", deadlineLabel: "Pedidos encerrados em 18 de julho de 2026", representative: "Juliana Costa", artFront: showcaseCampaigns[1].image, orderCount: 3, paidTotalCents: 401330 },
  { code: "MENDES-ADM-26", title: "Administração — Noturno", subtitle: "Ficha de corte e confecção", phase: "completed", deadlineLabel: "Campanha concluída em 22 de julho de 2026", representative: "Rafael Lima", artFront: showcaseCampaigns[2].image, orderCount: 2, paidTotalCents: 305490 },
  { code: "MENDES-ADS-26", title: "Análise e Desenvolvimento de Sistemas — 2026.2", subtitle: "Ficha de corte e confecção", phase: "receiving_orders", deadlineLabel: "Pedidos até 12 de setembro de 2026", representative: "Carla Sousa", artFront: showcaseCampaigns[3].image, orderCount: 3, paidTotalCents: 59900 },
];

const demoOrders: Record<string, PanelOrder[]> = {
  "MENDES-ENG-26": [
    { number: "CM-2026-0151", customer: "Marina Azevedo", whatsapp: "98999990001", model: "Comum", color: "Azul Royal", colorHex: "#1468b8", size: "MB", quantity: 2, paymentStatus: "paid", deliveryStatus: "waiting_campaign", totalCents: 11980 },
    { number: "CM-2026-0150", customer: "João Pedro", whatsapp: "98999990002", model: "Comum", color: "Preto", colorHex: "#111315", size: "G", quantity: 1, paymentStatus: "paid", deliveryStatus: "waiting_campaign", totalCents: 5990 },
    { number: "CM-2026-0148", customer: "Ana Clara", whatsapp: "98999990003", model: "Oversized", color: "Branco", colorHex: "#f1f2f0", size: "M", quantity: 1, paymentStatus: "paid", deliveryStatus: "waiting_campaign", totalCents: 6990 },
    { number: "CM-2026-0147", customer: "Rafael Lima", whatsapp: "98999990004", model: "Comum", color: "Azul Marinho", colorHex: "#17365d", size: "GG", quantity: 2, paymentStatus: "paid", deliveryStatus: "waiting_campaign", totalCents: 11980 },
    { number: "CM-2026-0146", customer: "Luiza Martins", whatsapp: "98999990005", model: "Comum", color: "Preto", colorHex: "#111315", size: "PB", quantity: 1, paymentStatus: "paid", deliveryStatus: "waiting_campaign", totalCents: 5990 },
    { number: "CM-2026-0145", customer: "Pedro Henrique", whatsapp: "98999990006", model: "Comum", color: "Bordô", colorHex: "#6f1833", size: "G", quantity: 1, paymentStatus: "pending", deliveryStatus: "waiting_campaign", totalCents: 5990 },
  ],
  "MENDES-ENF-26": [
    { number: "CM-2026-0139", customer: "Juliana Reis", whatsapp: "98999990007", model: "Comum", color: "Branco", colorHex: "#f1f2f0", size: "MB", quantity: 2, paymentStatus: "paid", deliveryStatus: "ready", totalCents: 11980 },
    { number: "CM-2026-0138", customer: "Pedro Henrique", whatsapp: "98999990008", model: "Comum", color: "Verde", colorHex: "#27704b", size: "G", quantity: 1, paymentStatus: "paid", deliveryStatus: "delivered", totalCents: 5990 },
    { number: "CM-2026-0137", customer: "Larissa Melo", whatsapp: "98999990009", model: "Oversized", color: "Preto", colorHex: "#111315", size: "M", quantity: 1, paymentStatus: "paid", deliveryStatus: "issue", totalCents: 6990 },
  ],
  "MENDES-ADM-26": [
    { number: "CM-2026-0128", customer: "Amanda Costa", whatsapp: "98999990010", model: "Comum", color: "Branco", colorHex: "#f1f2f0", size: "M", quantity: 1, paymentStatus: "paid", deliveryStatus: "delivered", totalCents: 5790 },
    { number: "CM-2026-0127", customer: "Bruno Cardoso", whatsapp: "98999990011", model: "Oversized", color: "Preto", colorHex: "#111315", size: "G", quantity: 1, paymentStatus: "paid", deliveryStatus: "delivered", totalCents: 6790 },
  ],
  "MENDES-ADS-26": [
    { number: "CM-2026-0164", customer: "Camila Nunes", whatsapp: "98999990012", model: "Comum", color: "Preto", colorHex: "#111315", size: "M", quantity: 1, paymentStatus: "paid", deliveryStatus: "waiting_campaign", totalCents: 5990 },
    { number: "CM-2026-0163", customer: "Diego Sousa", whatsapp: "98999990013", model: "Oversized", color: "Azul Royal", colorHex: "#1468b8", size: "G", quantity: 2, paymentStatus: "pending", deliveryStatus: "waiting_campaign", totalCents: 13980 },
    { number: "CM-2026-0162", customer: "Renata Alves", whatsapp: "98999990014", model: "Comum", color: "Branco", colorHex: "#f1f2f0", size: "PB", quantity: 1, paymentStatus: "failed", deliveryStatus: "waiting_campaign", totalCents: 5990 },
  ],
};

/* ------------------------------------------------------------------ */
/* Agregações — as mesmas regras das views do banco                    */
/* ------------------------------------------------------------------ */

type ProductionGroup = {
  campaignCode: string;
  campaignTitle: string;
  modelName: string;
  colorName: string;
  sizes: Record<string, number>;
  total: number;
};

function groupProduction(rows: ApiProductionRow[]): ProductionGroup[] {
  const groups = new Map<string, ProductionGroup>();
  for (const row of rows) {
    const key = `${row.campaignCode}|${row.modelName}|${row.color.name}`;
    const group = groups.get(key) ?? {
      campaignCode: row.campaignCode,
      campaignTitle: row.campaignTitle,
      modelName: row.modelName,
      colorName: row.color.name,
      sizes: {},
      total: 0,
    };
    group.sizes[row.size] = (group.sizes[row.size] ?? 0) + row.quantity;
    group.total += row.quantity;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Só pedidos pagos e não cancelados entram na produção, como em `v_production_report`. */
function productionFromOrders(campaigns: PanelCampaign[], orders: Record<string, PanelOrder[]>): ApiProductionRow[] {
  return campaigns.flatMap((campaign) =>
    (orders[campaign.code] ?? [])
      .filter((order) => order.paymentStatus === "paid" && order.status !== "cancelled")
      .flatMap((order) => panelOrderItems(order).map((item) => ({
        campaignCode: campaign.code,
        campaignTitle: campaign.title,
        modelName: item.model,
        color: { name: item.color, hex: item.colorHex },
        size: item.size,
        sizeGroup: (item.size.endsWith("B") ? "baby_look" : "standard") as "standard" | "baby_look",
        quantity: item.quantity,
      }))),
  );
}

function deliveryFromOrders(campaigns: PanelCampaign[], orders: Record<string, PanelOrder[]>): ApiDeliveryRow[] {
  return campaigns.flatMap((campaign) =>
    (orders[campaign.code] ?? [])
      .filter((order) => order.paymentStatus === "paid" && order.status !== "cancelled")
      .flatMap((order) => panelOrderItems(order).map((item) => ({
        campaignCode: campaign.code,
        campaignTitle: campaign.title,
        representativeName: campaign.representative,
        orderNumber: order.number,
        customerName: order.customer,
        customerWhatsapp: order.whatsapp,
        modelName: item.model,
        colorName: item.color,
        size: item.size,
        quantity: item.quantity,
        deliveryStatus: effectiveDelivery(order, campaign.phase),
      }))),
  );
}

/** Abre só as colunas de tamanho com peça pedida: o catálogo tem 12 códigos. */
function usedSizes(groups: ProductionGroup[]) {
  const used = new Set<SizeCode>();
  for (const group of groups) {
    for (const [code, quantity] of Object.entries(group.sizes)) {
      if (quantity) used.add(code as SizeCode);
    }
  }
  return sortSizes([...used]);
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDeadline(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Prazo definido pela camisaria";
  return `Pedidos até ${parsed.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
}

function parseCampaignPrice(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function priceInput(cents: number | undefined) {
  return cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Data para o `input type="date"` lida no fuso local. O prazo é gravado como 23:59:59
 * local e vira o dia seguinte em UTC — usar a data ISO traria um dia a mais na tela.
 */
function dateInput(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

const defaultPickupInstructions = "Retirada com o representante da turma";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/* ------------------------------------------------------------------ */
/* Carga dos dados                                                     */
/* ------------------------------------------------------------------ */

type PanelData = {
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

function usePanelData(): PanelData {
  const hasSession = Boolean(staffToken());
  const offlineMode: PanelMode = import.meta.env.DEV ? "demo" : "error";
  const offlineCampaigns = import.meta.env.DEV ? demoCampaigns : [];
  const offlineOrders = import.meta.env.DEV ? demoOrders : {};
  const [mode, setMode] = useState<PanelMode>(hasSession ? "live" : offlineMode);
  const [campaigns, setCampaigns] = useState<PanelCampaign[]>(hasSession ? [] : offlineCampaigns);
  const [orders, setOrders] = useState<Record<string, PanelOrder[]>>(hasSession ? {} : offlineOrders);
  const [loading, setLoading] = useState(hasSession);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!hasSession) return;
    let active = true;
    // Não voltar a `loading` aqui é deliberado: um recarregamento após confirmar
    // pagamento ou mudar de fase atualiza os dados no lugar, sem desmontar a seção
    // e perder a campanha selecionada, os filtros e a mensagem de retorno.
    fetchAdminCampaigns()
      .then((list) => {
        if (!active) return;
        setCampaigns(
          list.map((campaign) => ({
            code: campaign.code,
            title: campaign.title,
            subtitle: campaign.subtitle,
            phase: campaign.phase,
            deadlineLabel: formatDeadline(campaign.deadlineAt),
            representative: campaign.representative.name,
            artFront: campaign.artFrontUrl ?? shirtModels[0].image,
            orderCount: campaign.orderCount,
            paidTotalCents: campaign.paidTotalCents,
          })),
        );
        setMode("live");
        setError("");
      })
      .catch((loadError) => {
        if (!active) return;
        // Sessão perdida ou servidor fora. Em desenvolvimento o painel segue navegável
        // com a demonstração; publicado, ele para e diz o que aconteceu.
        setMode(offlineMode);
        setCampaigns(offlineCampaigns);
        setOrders(offlineOrders);
        setError(errorMessage(loadError, "Não foi possível carregar as campanhas."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [hasSession, reloadCount]);

  const loadOrders = useCallback((code: string) => {
    if (mode !== "live") return;
    fetchCampaignOrders(code)
      .then((list) => {
        setOrders((current) => ({
          ...current,
          [code]: list.map((order) => {
            const first = order.items[0];
            return {
              number: order.number,
              customer: order.customer.name,
              whatsapp: order.customer.whatsapp,
              email: order.customer.email,
              model: first?.modelName ?? "—",
              color: first?.color.name ?? "—",
              colorHex: first?.color.hex ?? "#777f83",
              size: (first?.size ?? "M") as SizeCode,
              quantity: order.items.reduce((total, item) => total + item.quantity, 0),
              paymentStatus: order.paymentStatus,
              deliveryStatus: order.deliveryStatus,
              totalCents: order.totalCents,
              status: order.status,
              cancellationReason: order.cancellationReason,
              items: order.items.map((item) => ({ model: item.modelName, color: item.color.name, colorHex: item.color.hex, size: item.size as SizeCode, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
            };
          }),
        }));
      })
      .catch(() => {
        setOrders((current) => ({ ...current, [code]: current[code] ?? [] }));
      });
  }, [mode]);

  const reload = useCallback(() => setReloadCount((value) => value + 1), []);

  return { mode, campaigns, orders, loading, error, attempt: reloadCount, loadOrders, reload };
}

/* ------------------------------------------------------------------ */
/* Casca do painel                                                     */
/* ------------------------------------------------------------------ */

export function AdminDashboard() {
  const [active, setActive] = useState<AdminSection>("overview");
  const [user, setUser] = useState<StaffUser | null>(null);
  const data = usePanelData();
  const activeLabel = active === "orders" ? "Campanhas em fluxo" : nav.find(([key]) => key === active)?.[2] ?? "Visão geral";
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const mustChangePassword = Boolean(user?.mustChangePassword);

  // Refeita a cada "tentar novamente": sem isso, uma falha de rede no primeiro carregamento
  // deixaria o painel sem saber que a senha ainda é a provisória.
  useEffect(() => {
    if (!staffToken()) return;
    let active = true;
    fetchStaffSession()
      .then((session) => { if (active) setUser(session); })
      .catch(() => { /* A carga das campanhas já reporta sessão perdida. */ });
    return () => { active = false; };
  }, [data.attempt]);

  // A senha provisória do cadastro inicial não pode sobreviver ao primeiro acesso:
  // enquanto ela estiver valendo, o painel abre direto na conta e não sai de lá.
  useEffect(() => {
    if (mustChangePassword) setActive("account");
  }, [mustChangePassword]);

  async function logout() {
    await logoutStaff();
    sessionStorage.removeItem(STAFF_SESSION_KEY);
    window.location.assign(buildRoute("acesso-camisaria"));
  }

  function navigate(section: AdminSection) {
    if (mustChangePassword && section !== "account") return;
    setActive(section);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand compact />
        <nav aria-label="Navegação do painel">
          {nav.map(([key, icon, label]) => (
            <button className={active === key ? "is-active" : ""} type="button" onClick={() => navigate(key)} key={key} disabled={mustChangePassword && key !== "account"} aria-current={active === key ? "page" : undefined}>
              <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>
              <span className="admin-nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <button className="admin-logout" type="button" onClick={logout}><span className="material-symbols-rounded" aria-hidden="true">logout</span><span>Sair do painel</span></button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><small>{today}</small><h1>{activeLabel}</h1></div>
          <div className="admin-user"><span className="material-symbols-rounded" aria-hidden="true">person</span><div><strong>{user?.name ?? "Equipe Mendes"}</strong><small>{user?.email ?? "Sessão do painel"}</small></div></div>
        </header>

        {data.mode === "demo" && (
          <p className="admin-mode-banner" role="status">
            <span className="material-symbols-rounded" aria-hidden="true">science</span>
            <span>Dados de demonstração, disponíveis apenas em desenvolvimento. {data.error || "Entre com uma sessão válida para operar as campanhas reais."}</span>
          </p>
        )}
        {mustChangePassword && (
          <p className="admin-mode-banner admin-mode-banner--alert" role="alert">
            <span className="material-symbols-rounded" aria-hidden="true">lock_reset</span>
            <span>Este acesso ainda usa a senha provisória do cadastro inicial. Troque a senha para liberar o painel.</span>
          </p>
        )}
        {data.loading ? (
          <p className="admin-loading" aria-live="polite"><span className="material-symbols-rounded" aria-hidden="true">progress_activity</span>Carregando dados da camisaria...</p>
        ) : data.mode === "error" && active !== "account" ? (
          <div className="admin-content">
            <section className="simple-state">
              <span className="material-symbols-rounded" aria-hidden="true">cloud_off</span>
              <h3>Não foi possível carregar os dados</h3>
              <p>{data.error || "O servidor da camisaria não respondeu."}</p>
              <button className="primary-action" type="button" onClick={data.reload}>Tentar novamente<span className="material-symbols-rounded" aria-hidden="true">refresh</span></button>
            </section>
          </div>
        ) : (
          <>
            {active === "overview" && <Overview data={data} onNavigate={navigate} />}
            {active === "campaigns" && <Campaigns data={data} />}
            {active === "orders" && <Orders data={data} />}
            {active === "products" && <Products />}
            {active === "reports" && <Reports data={data} />}
            {active === "account" && <Account user={user} onSaved={setUser} />}
          </>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conta da equipe                                                     */
/* ------------------------------------------------------------------ */

/**
 * Troca de e-mail e senha do próprio acesso. É o caminho previsto para tirar do ar o
 * cadastro inicial (`gustavo@mendes` com senha provisória) sem passar por linha de
 * comando. A senha atual é sempre exigida, mesmo já havendo sessão aberta.
 */
function Account({ user, onSaved }: { user: StaffUser | null; onSaved: (user: StaffUser) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user?.email, user?.name]);

  if (!user) {
    return (
      <div className="admin-content">
        <section className="simple-state">
          <span className="material-symbols-rounded" aria-hidden="true">manage_accounts</span>
          <h3>Conta indisponível</h3>
          <p>Entre no painel com uma sessão do servidor para alterar e-mail e senha.</p>
        </section>
      </div>
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    if (newPassword && newPassword.length < 8) {
      setError("A nova senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (newPassword && newPassword !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateStaffAccount({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        currentPassword,
        newPassword: newPassword || undefined,
      });
      onSaved(result.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setFeedback(result.passwordChanged
        ? "Dados salvos e senha trocada. As outras sessões abertas foram encerradas."
        : "Dados da conta salvos.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Não foi possível salvar a conta."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-content admin-account-page">
      <div className="section-actions">
        <div><span className="kicker">Acesso</span><h2>Conta da camisaria</h2><p>Troque o e-mail e a senha usados para entrar no painel.</p></div>
      </div>

      <section className="admin-account-card" aria-labelledby="account-form-title">
        <header>
          <div><h3 id="account-form-title">Dados de acesso</h3><p>A senha atual confirma que é você quem está alterando.</p></div>
          <span className={`admin-account-role admin-account-role--${user.role}`}>{user.role === "camisaria" ? "Camisaria" : "Representante"}</span>
        </header>
        <form onSubmit={save}>
          <label className="campaign-field"><span>Nome</span><input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} minLength={3} maxLength={160} required /></label>
          <label className="campaign-field"><span>E-mail de acesso</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="username" required /></label>
          <label className="campaign-field campaign-field--wide"><span>Senha atual</span><input type="password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setError(""); }} autoComplete="current-password" required /></label>
          <label className="campaign-field"><span>Nova senha</span><input type="password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError(""); }} autoComplete="new-password" minLength={8} placeholder="Deixe vazio para manter a atual" /></label>
          <label className="campaign-field"><span>Repita a nova senha</span><input type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} autoComplete="new-password" minLength={8} /></label>
          {error && <p className="campaign-form-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{error}</p>}
          <div className="campaign-create-actions">
            <p className="admin-account-feedback" role="status" aria-live="polite">{feedback}</p>
            <button className="primary-action" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}<span className="material-symbols-rounded" aria-hidden="true">check</span></button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Visão geral                                                         */
/* ------------------------------------------------------------------ */

function Overview({ data, onNavigate }: { data: PanelData; onNavigate: (section: AdminSection) => void }) {
  const { campaigns, orders, loadOrders } = data;
  const receiving = campaigns.filter((campaign) => campaign.phase === "receiving_orders");
  const focus = receiving[0] ?? campaigns[0];

  useEffect(() => {
    if (focus) loadOrders(focus.code);
  }, [focus?.code, loadOrders]);

  const focusOrders = focus ? orders[focus.code] ?? [] : [];
  const totalOrders = campaigns.reduce((total, campaign) => total + campaign.orderCount, 0);
  const paidTotal = campaigns.reduce((total, campaign) => total + campaign.paidTotalCents, 0);
  const inProduction = campaigns.filter((campaign) => campaign.phase === "production").length;
  const readyCampaigns = campaigns.filter((campaign) => campaign.phase === "ready_for_delivery").length;

  const focusProduction = focus ? groupProduction(productionFromOrders([focus], orders)) : [];
  const focusPieces = focusProduction.reduce((total, group) => total + group.total, 0);
  const byModel = shirtModels.map((model) => ({
    name: model.name,
    pieces: focusProduction.filter((group) => group.modelName === model.name).reduce((total, group) => total + group.total, 0),
  }));

  if (!focus) {
    return (
      <div className="admin-content">
        <section className="simple-state">
          <span className="material-symbols-rounded" aria-hidden="true">campaign</span>
          <h3>Nenhuma campanha cadastrada</h3>
          <p>Crie a primeira campanha para gerar o acesso da turma.</p>
          <button className="primary-action" type="button" onClick={() => onNavigate("campaigns")}>Nova campanha<span className="material-symbols-rounded" aria-hidden="true">add</span></button>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-content admin-overview">
      <section className="admin-page-intro">
        <div><span className="kicker">Operação de hoje</span><h2>Sua produção em um só lugar.</h2><p>Acompanhe o que vendeu, o que precisa produzir e o que já pode ser entregue.</p></div>
        <button className="primary-action" type="button" onClick={() => onNavigate("orders")}>Abrir pedidos<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
      </section>

      <section className="metric-row" aria-label="Resumo da operação">
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">campaign</span><div><span>Recebendo pedidos</span><strong>{receiving.length}</strong><small>{campaigns.length} campanhas no total</small></div></article>
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">verified</span><div><span>Pedidos registrados</span><strong>{totalOrders}</strong><small>{formatCents(paidTotal)} confirmados</small></div></article>
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">inventory_2</span><div><span>Campanhas em produção</span><strong>{inProduction}</strong><small>Fase aplicada à turma inteira</small></div></article>
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">redeem</span><div><span>Prontas para entrega</span><strong>{readyCampaigns}</strong><small>Liberadas ao representante</small></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="admin-campaign-focus">
          <div className="admin-campaign-focus-image"><img src={focus.artFront} alt={`Arte da campanha ${focus.title}`} /><span>{phaseMeta[focus.phase].label}</span></div>
          <div className="admin-campaign-focus-copy">
            <div className="panel-heading"><div><span className="kicker">Prazo mais próximo</span><h2>{focus.title}</h2></div><button type="button" onClick={() => onNavigate("campaigns")}>Ver campanha</button></div>
            <p>{focus.deadlineLabel} · Retirada com {focus.representative}</p>
            <dl className="campaign-focus-stats"><div><dt>Pedidos</dt><dd>{focus.orderCount}</dd></div><div><dt>Peças pagas</dt><dd>{focusPieces}</dd></div><div><dt>Vendas</dt><dd>{formatCents(focus.paidTotalCents)}</dd></div></dl>
          </div>
        </article>

        <article className="dashboard-panel production-summary">
          <div className="panel-heading"><div><span className="kicker">Produção</span><h2>Peças confirmadas</h2></div><span>{focusPieces} no total</span></div>
          <div className="production-models">
            {byModel.map((model) => (
              <div key={model.name}>
                <div><strong>{model.name}</strong><span>{model.pieces} {model.pieces === 1 ? "peça" : "peças"}</span></div>
                <progress max={Math.max(focusPieces, 1)} value={model.pieces}>{model.pieces}</progress>
              </div>
            ))}
          </div>
          <button className="admin-text-action" type="button" onClick={() => onNavigate("reports")}>Ver relatório de produção<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
        </article>

        <article className="dashboard-panel recent-orders">
          <div className="panel-heading"><div><span className="kicker">Últimos pedidos</span><h2>{focus.title}</h2></div><button type="button" onClick={() => onNavigate("orders")}>Ver todos</button></div>
          <div className="orders-table is-compact">
            <div className="orders-head"><span>Pedido</span><span>Cliente</span><span>Peça</span><span>Total</span><span>Pagamento</span></div>
            {focusOrders.slice(0, 4).map((order) => (
              <div className="order-row" key={order.number}>
                <strong>#{order.number}</strong><span>{order.customer}</span><span>{order.model} · {order.size}</span><span>{formatCents(order.totalCents)}</span>
                <span className={`status status--${order.status === "cancelled" ? "cancelled" : order.paymentStatus}`}>{order.status === "cancelled" ? "Cancelado" : paymentLabels[order.paymentStatus]}</span>
              </div>
            ))}
            {focusOrders.length === 0 && <p className="orders-table-empty">Nenhum pedido registrado nesta campanha.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campanhas                                                           */
/* ------------------------------------------------------------------ */

function defaultModelColorNames(): Record<ShirtModelName, ShirtColorName[]> {
  return {
    Comum: defaultCampaignColors.Comum.map((color) => color.name),
    Oversized: defaultCampaignColors.Oversized.map((color) => color.name),
  };
}

function defaultModelSizes(): Record<ShirtModelName, SizeCode[]> {
  return { Comum: [...defaultCampaignSizes.Comum], Oversized: [...defaultCampaignSizes.Oversized] };
}

function colorKey(name: string) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

function mergeCampaignColors(...groups: ShirtColorOption[][]) {
  const colors = new Map<string, ShirtColorOption>();
  groups.flat().forEach((color) => colors.set(colorKey(color.name), { name: color.name, hex: color.hex.toUpperCase() }));
  return [...colors.values()];
}

function validHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/**
 * Espelha `suggestedCampaignCode` da API para mostrar o código antes de salvar.
 * A API continua sendo a autoridade: se o campo vier vazio, ela gera o dela.
 */
function suggestCode(title: string) {
  const stopWords = new Set(["A", "AS", "DA", "DAS", "DE", "DO", "DOS", "E", "O", "OS"]);
  const words = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !stopWords.has(word));
  const initials = words.slice(0, 4).map((word) => word[0]).join("") || "TURMA";
  return `MENDES-${initials}-${String(new Date().getUTCFullYear()).slice(-2)}`;
}

type ArtDraft = { file: File | null; preview: string };

function Campaigns({ data }: { data: PanelData }) {
  const { campaigns, mode, reload } = data;
  const [phaseFilter, setPhaseFilter] = useState<"all" | CampaignPhaseCode>("all");
  const [creating, setCreating] = useState(false);
  const [shared, setShared] = useState<PanelCampaign | null>(null);
  const [notice, setNotice] = useState("");

  /** Fora de `null`, o formulário está editando a campanha deste código. */
  const [editing, setEditing] = useState<{ code: string; phase: CampaignPhaseCode; hadBackArt: boolean } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [existingArt, setExistingArt] = useState<{ front: string; back: string }>({ front: "", back: "" });
  const [campaignName, setCampaignName] = useState("");
  const [campaignCodeInput, setCampaignCodeInput] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [pickup, setPickup] = useState(defaultPickupInstructions);
  const [representative, setRepresentative] = useState("");
  const [representativePhone, setRepresentativePhone] = useState("");
  const [deadline, setDeadline] = useState("");
  const [commonPrice, setCommonPrice] = useState("59,90");
  const [oversizedPrice, setOversizedPrice] = useState("69,90");
  const [selectedModels, setSelectedModels] = useState<Record<ShirtModelName, boolean>>({ Comum: true, Oversized: true });
  const [front, setFront] = useState<ArtDraft>({ file: null, preview: "" });
  const [back, setBack] = useState<ArtDraft>({ file: null, preview: "" });
  const [artError, setArtError] = useState("");
  const [colorModel, setColorModel] = useState<ShirtModelName>("Comum");
  const [campaignColorOptions, setCampaignColorOptions] = useState<ShirtColorOption[]>(() => mergeCampaignColors(shirtColors));
  const [modelColors, setModelColors] = useState<Record<ShirtModelName, ShirtColorName[]>>(defaultModelColorNames);
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#808080");
  const [colorError, setColorError] = useState("");
  const [sizeModel, setSizeModel] = useState<ShirtModelName>("Comum");
  const [modelSizes, setModelSizes] = useState<Record<ShirtModelName, SizeCode[]>>(defaultModelSizes);
  const [sizeError, setSizeError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const filtered = phaseFilter === "all" ? campaigns : campaigns.filter((campaign) => campaign.phase === phaseFilter);

  /**
   * Preço, cores e tamanhos ficam travados assim que a campanha sai de "recebendo
   * pedidos": alterá-los com pedido pago no meio desalinharia produção e cobrança. Os
   * campos continuam visíveis, desabilitados, com o motivo à vista.
   */
  const variantsLocked = editing !== null && editing.phase !== "receiving_orders";

  function resetForm() {
    setCampaignName("");
    setCampaignCodeInput("");
    setSubtitle("");
    setPickup(defaultPickupInstructions);
    setRepresentative("");
    setRepresentativePhone("");
    setDeadline("");
    setFront({ file: null, preview: "" });
    setBack({ file: null, preview: "" });
    setExistingArt({ front: "", back: "" });
    setArtError("");
    setCampaignColorOptions(mergeCampaignColors(shirtColors));
    setCustomColorName("");
    setCustomColorHex("#808080");
    setColorError("");
    setColorModel("Comum");
    setSizeError("");
    setSizeModel("Comum");
    setSelectedModels({ Comum: true, Oversized: true });
    setFormError("");
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setLoadingDetail(false);
  }

  function startCampaign() {
    setShared(null);
    setNotice("");
    setEditing(null);
    setCreating(true);
    resetForm();
    setCommonPrice("59,90");
    setOversizedPrice("69,90");
    setModelColors(defaultModelColorNames());
    setModelSizes(defaultModelSizes());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Abre o mesmo formulário já preenchido com o que a campanha tem hoje. */
  async function startEdit(campaign: PanelCampaign) {
    setShared(null);
    setNotice("");
    setCreating(true);
    setEditing({ code: campaign.code, phase: campaign.phase, hadBackArt: false });
    setLoadingDetail(true);
    resetForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const detail = await fetchCampaignDetail(campaign.code);
      setEditing({ code: detail.code, phase: campaign.phase, hadBackArt: Boolean(detail.artBackUrl) });
      setCampaignName(detail.title);
      setCampaignCodeInput(detail.code);
      setSubtitle(detail.subtitle ?? "");
      setPickup(detail.pickupInstructions);
      setRepresentative(detail.representativeName);
      setRepresentativePhone(detail.representativeWhatsapp ?? "");
      setDeadline(dateInput(detail.deadlineAt));
      setExistingArt({ front: assetUrl(detail.artFrontUrl) ?? "", back: assetUrl(detail.artBackUrl) ?? "" });
      const priceOf = (model: ShirtModelName) => detail.variants.find((variant) => variant.model.name === model)?.unitPriceCents;
      setCommonPrice(priceInput(priceOf("Comum")) || "59,90");
      setOversizedPrice(priceInput(priceOf("Oversized")) || "69,90");
      const colorsFromCampaign = detail.variants.map((variant) => ({ name: variant.color.name, hex: variant.color.hex }));
      setCampaignColorOptions(mergeCampaignColors(shirtColors, colorsFromCampaign));
      const colorsOf = (model: ShirtModelName) => detail.variants
        .filter((variant) => variant.model.name === model)
        .map((variant) => variant.color.name);
      setModelColors({ Comum: colorsOf("Comum"), Oversized: colorsOf("Oversized") });
      const sizesOf = (model: ShirtModelName) => sortSizes(
        detail.sizes.filter((size) => size.model.name === model).map((size) => size.code as SizeCode),
      );
      setModelSizes({ Comum: sizesOf("Comum"), Oversized: sizesOf("Oversized") });
      const availableModels = new Set(detail.variants.map((variant) => variant.model.name as ShirtModelName));
      const nextSelectedModels = { Comum: availableModels.has("Comum"), Oversized: availableModels.has("Oversized") };
      setSelectedModels(nextSelectedModels);
      const firstAvailableModel = shirtModels.find((model) => nextSelectedModels[model.name])?.name ?? "Comum";
      setColorModel(firstAvailableModel);
      setSizeModel(firstAvailableModel);
    } catch (detailError) {
      setFormError(errorMessage(detailError, "Não foi possível carregar a campanha para edição."));
    } finally {
      setLoadingDetail(false);
    }
  }

  function toggleCampaignModel(model: ShirtModelName) {
    const currentlySelected = selectedModels[model];
    const selectedCount = shirtModels.filter((item) => selectedModels[item.name]).length;
    if (currentlySelected && selectedCount === 1) {
      setFormError("A campanha precisa manter pelo menos um corte disponível.");
      return;
    }

    const nextSelected = !currentlySelected;
    setSelectedModels((current) => ({ ...current, [model]: nextSelected }));
    setFormError("");

    if (nextSelected) {
      setModelColors((current) => current[model].length > 0
        ? current
        : { ...current, [model]: defaultCampaignColors[model].map((color) => color.name) });
      setModelSizes((current) => current[model].length > 0
        ? current
        : { ...current, [model]: [...defaultCampaignSizes[model]] });
      setColorModel(model);
      setSizeModel(model);
      return;
    }

    const remainingModel = shirtModels.find((item) => item.name !== model && selectedModels[item.name])?.name;
    if (remainingModel) {
      if (colorModel === model) setColorModel(remainingModel);
      if (sizeModel === model) setSizeModel(remainingModel);
    }
  }

  function toggleCampaignColor(model: ShirtModelName, color: ShirtColorName) {
    setModelColors((current) => {
      const selected = current[model];
      const next = selected.includes(color) ? selected.filter((item) => item !== color) : [...selected, color];
      return { ...current, [model]: next };
    });
    setColorError("");
  }

  function addCustomCampaignColor() {
    const name = customColorName.trim().replace(/\s+/g, " ");
    const hex = customColorHex.trim().toUpperCase();
    if (name.length < 2 || name.length > 80) {
      setColorError("Informe um nome de cor entre 2 e 80 caracteres.");
      return;
    }
    if (!validHexColor(hex)) {
      setColorError("Informe o código HEX completo no formato #RRGGBB.");
      return;
    }
    const existing = campaignColorOptions.find((color) => colorKey(color.name) === colorKey(name));
    if (existing && existing.hex.toUpperCase() !== hex) {
      setColorError(`${existing.name} já está cadastrada como ${existing.hex.toUpperCase()}. Use outro nome para ${hex}.`);
      return;
    }
    if (modelColors[colorModel].length >= 12 && !modelColors[colorModel].some((color) => colorKey(color) === colorKey(name))) {
      setColorError(`O corte ${colorModel} já atingiu o limite de 12 cores.`);
      return;
    }
    if (!existing) setCampaignColorOptions((current) => [...current, { name, hex }]);
    const selectedName = existing?.name ?? name;
    setModelColors((current) => current[colorModel].includes(selectedName)
      ? current
      : { ...current, [colorModel]: [...current[colorModel], selectedName] });
    setCustomColorName("");
    setCustomColorHex("#808080");
    setColorError("");
  }

  function removeCustomCampaignColor(name: string) {
    if (shirtColors.some((color) => colorKey(color.name) === colorKey(name))) return;
    setCampaignColorOptions((current) => current.filter((color) => colorKey(color.name) !== colorKey(name)));
    setModelColors((current) => ({
      Comum: current.Comum.filter((color) => colorKey(color) !== colorKey(name)),
      Oversized: current.Oversized.filter((color) => colorKey(color) !== colorKey(name)),
    }));
    setColorError("");
  }

  function toggleCampaignSize(model: ShirtModelName, size: SizeCode) {
    setModelSizes((current) => {
      const selected = current[model];
      const next = selected.includes(size) ? selected.filter((item) => item !== size) : sortSizes([...selected, size]);
      return { ...current, [model]: next };
    });
    setSizeError("");
  }

  function toggleSizeGroup(model: ShirtModelName, group: SizeGroup) {
    const groupSizes = sizesInGroup(group);
    setModelSizes((current) => {
      const selected = current[model];
      const allSelected = groupSizes.every((size) => selected.includes(size));
      const next = allSelected
        ? selected.filter((size) => !groupSizes.includes(size))
        : sortSizes([...new Set([...selected, ...groupSizes])]);
      return { ...current, [model]: next };
    });
    setSizeError("");
  }

  function chooseArt(event: ChangeEvent<HTMLInputElement>, side: "front" | "back") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setArtError("Formato inválido. Envie uma imagem PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setArtError("A imagem ultrapassa 2 MB. Comprima o arquivo antes de enviar.");
      return;
    }
    const preview = new Image();
    const url = URL.createObjectURL(file);
    preview.onerror = () => { URL.revokeObjectURL(url); setArtError("O arquivo não contém uma imagem válida."); };
    preview.onload = () => {
      if (preview.width < 600 || preview.height < 800) {
        URL.revokeObjectURL(url);
        setArtError("A imagem precisa ter pelo menos 600 × 800 pixels.");
        return;
      }
      const setter = side === "front" ? setFront : setBack;
      setter((current) => {
        if (current.preview) URL.revokeObjectURL(current.preview);
        return { file, preview: url };
      });
      setArtError("");
    };
    preview.src = url;
  }

  function removeBackArt() {
    setBack((current) => {
      if (current.preview) URL.revokeObjectURL(current.preview);
      return { file: null, preview: "" };
    });
    setExistingArt((current) => ({ ...current, back: "" }));
    setArtError("");
  }

  function campaignModels() {
    return shirtModels.filter((model) => selectedModels[model.name]).map((model) => ({
      modelCode: model.code,
      unitPriceCents: Math.round(parseCampaignPrice(model.name === "Comum" ? commonPrice : oversizedPrice) * 100),
      colors: modelColors[model.name].map((name) => {
        const color = campaignColorOptions.find((option) => colorKey(option.name) === colorKey(name));
        return { name, hex: color?.hex.toUpperCase() ?? "" };
      }),
      sizes: modelSizes[model.name],
    }));
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!editing && !front.file) {
      setArtError("Envie a arte da campanha antes de criar o acesso.");
      return;
    }
    if (!variantsLocked) {
      const selectedCampaignModels = shirtModels.filter((item) => selectedModels[item.name]);
      if (selectedCampaignModels.length === 0) {
        setFormError("Selecione pelo menos um corte para a campanha.");
        return;
      }
      const modelWithoutColor = selectedCampaignModels.find((item) => modelColors[item.name].length === 0);
      if (modelWithoutColor) {
        setColorModel(modelWithoutColor.name);
        setColorError(`Selecione pelo menos uma cor para o corte ${modelWithoutColor.name}.`);
        return;
      }
      const modelWithoutSize = selectedCampaignModels.find((item) => modelSizes[item.name].length === 0);
      if (modelWithoutSize) {
        setSizeModel(modelWithoutSize.name);
        setSizeError(`Selecione pelo menos um tamanho para o corte ${modelWithoutSize.name}.`);
        return;
      }
    }
    if (mode !== "live") {
      setFormError("Sem sessão no servidor, a campanha não pode ser gravada. Entre novamente para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        const payload: UpdateCampaignPayload = {
          title: campaignName,
          subtitle: subtitle.trim() || null,
          deadlineAt: new Date(`${deadline}T23:59:59`).toISOString(),
          pickupInstructions: pickup,
          representative: { name: representative, whatsapp: representativePhone },
        };
        // Arte só viaja quando um arquivo novo foi escolhido; a antiga fica onde está.
        if (front.file) payload.artFrontUrl = await uploadCampaignArt(front.file);
        if (back.file) payload.artBackUrl = await uploadCampaignArt(back.file);
        else if (editing.hadBackArt && !existingArt.back) payload.artBackUrl = null;
        if (!variantsLocked) payload.models = campaignModels();

        await updateCampaignInApi(editing.code, payload);
        closeForm();
        reload();
        setNotice(`Campanha ${editing.code} atualizada.`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const artFrontUrl = await uploadCampaignArt(front.file!);
      const artBackUrl = back.file ? await uploadCampaignArt(back.file) : null;
      const created = await createCampaignInApi({
        code: campaignCodeInput.trim() || undefined,
        title: campaignName,
        subtitle: subtitle.trim() || undefined,
        deadlineAt: new Date(`${deadline}T23:59:59`).toISOString(),
        pickupInstructions: pickup,
        representative: { name: representative, whatsapp: representativePhone },
        artFrontUrl,
        artBackUrl,
        models: campaignModels(),
      });
      closeForm();
      reload();
      setShared({
        code: created.code,
        title: campaignName,
        phase: "receiving_orders",
        deadlineLabel: formatDeadline(new Date(`${deadline}T23:59:59`).toISOString()),
        representative,
        artFront: front.preview,
        orderCount: 0,
        paidTotalCents: 0,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setFormError(errorMessage(submitError, editing ? "Não foi possível salvar a campanha." : "Não foi possível criar a campanha."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-content admin-campaigns-page">
      <div className="section-actions">
        <div><span className="kicker">Gestão</span><h2>Campanhas da camisaria</h2><p>Crie o acesso privado e acompanhe cada turma até a entrega.</p></div>
        <button className="primary-action" type="button" onClick={startCampaign}>Nova campanha<span className="material-symbols-rounded" aria-hidden="true">add</span></button>
      </div>

      {creating && (
        <section className="campaign-create-panel" aria-labelledby="campaign-create-title">
          <header>
            <div>
              <span className="kicker">{editing ? "Editar campanha" : "Nova campanha"}</span>
              <h3 id="campaign-create-title">{editing ? `Ajustar ${editing.code}.` : "Prepare o acesso da turma."}</h3>
              <p>{editing ? "O link e o código já entregues à turma continuam valendo." : "Essas informações aparecem no link que será enviado ao representante."}</p>
            </div>
            <button type="button" onClick={closeForm} aria-label="Fechar formulário"><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
          </header>
          {loadingDetail ? (
            <p className="admin-loading" aria-live="polite"><span className="material-symbols-rounded" aria-hidden="true">progress_activity</span>Carregando a campanha...</p>
          ) : (
          <form onSubmit={submitCampaign}>
            {variantsLocked && (
              <p className="campaign-locked-note" role="status">
                <span className="material-symbols-rounded" aria-hidden="true">lock</span>
                <span>Esta campanha está em <b>{phaseMeta[editing.phase].short}</b>. Preço, cores e tamanhos ficam travados a partir daqui, porque mudá-los com pedido pago no meio desalinha a produção e a cobrança. Título, prazo, retirada, representante e arte continuam editáveis.</span>
              </p>
            )}
            <label className="campaign-field campaign-field--wide"><span>Nome da campanha</span><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Engenharia Civil — Turma 2026" minLength={5} required /></label>
            <label className="campaign-field campaign-field--wide"><span>Subtítulo</span><input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="Campanha exclusiva para os alunos da turma" maxLength={255} /><small>Aparece abaixo do nome na página do aluno. Pode ficar vazio.</small></label>
            <label className="campaign-field campaign-field--wide"><span>Código da campanha</span><input value={campaignCodeInput} onChange={(event) => setCampaignCodeInput(event.target.value.toUpperCase())} placeholder={suggestCode(campaignName)} autoCapitalize="characters" spellCheck={false} disabled={Boolean(editing)} /><small>{editing ? "O código não muda depois de criado: ele está no link e no QR Code que a turma já recebeu." : <>É o que o aluno digita para entrar. Deixe vazio para usar <b>{suggestCode(campaignName)}</b>.</>}</small></label>
            <label className="campaign-field"><span>Representante da turma</span><input value={representative} onChange={(event) => setRepresentative(event.target.value)} placeholder="Nome do representante" minLength={3} required /></label>
            <label className="campaign-field"><span>WhatsApp do representante</span><input type="tel" inputMode="tel" value={representativePhone} onChange={(event) => setRepresentativePhone(event.target.value)} placeholder="(98) 98888-1234" minLength={10} required /></label>
            <label className="campaign-field"><span>Prazo final dos pedidos</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label>
            <label className="campaign-field"><span>Instruções de retirada</span><input value={pickup} onChange={(event) => setPickup(event.target.value)} maxLength={255} required /></label>

            <fieldset className="campaign-model-pricing" disabled={variantsLocked}><legend>Cortes e preços</legend><div>
              {shirtModels.map((model) => {
                const selected = selectedModels[model.name];
                const price = model.name === "Comum" ? commonPrice : oversizedPrice;
                const setPrice = model.name === "Comum" ? setCommonPrice : setOversizedPrice;
                return <article className={selected ? "is-selected" : ""} key={model.name}>
                  <label className="campaign-model-toggle">
                    <input type="checkbox" checked={selected} onChange={() => toggleCampaignModel(model.name)} />
                    <span className="material-symbols-rounded" aria-hidden="true">{selected ? "check" : "add"}</span>
                    <span><strong>{model.name === "Comum" ? "Padrão" : model.name}</strong><small>{model.description}</small></span>
                  </label>
                  <div className="campaign-price-field"><b>R$</b><input aria-label={`Preço do corte ${model.name}`} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required={selected} disabled={!selected || variantsLocked} /></div>
                </article>;
              })}
            </div><small>Marque somente os cortes que a campanha oferecerá. {editing && !variantsLocked ? "Trocar o preço vale para os próximos pedidos; os já registrados guardam o valor da compra." : "O preço vale para todos os tamanhos do corte, inclusive os baby look."}</small></fieldset>

            <fieldset className="campaign-color-setup" disabled={variantsLocked}><legend>Cores disponíveis por corte</legend>
              <p>O aluno verá somente as cores liberadas aqui. Use uma das cinco opções padrão ou cadastre uma cor pelo nome e código HEX.</p>
              <div className="campaign-color-tabs" role="group" aria-label="Corte para configurar as cores">
                {shirtModels.filter((item) => selectedModels[item.name]).map((item) => <button className={colorModel === item.name ? "is-active" : ""} type="button" aria-pressed={colorModel === item.name} onClick={() => { setColorModel(item.name); setColorError(""); }} key={item.name}>{item.name === "Comum" ? "Padrão" : item.name}<span>{modelColors[item.name].length}</span></button>)}
              </div>
              <div className="campaign-color-palette" aria-label={`Cores disponíveis para ${colorModel}`}>
                {campaignColorOptions.map((color) => {
                  const checked = modelColors[colorModel].includes(color.name);
                  return <label className={checked ? "is-selected" : ""} key={color.name}><input type="checkbox" checked={checked} onChange={() => toggleCampaignColor(colorModel, color.name)} /><i style={{ backgroundColor: color.hex }} /><span>{color.name}</span><span className="material-symbols-rounded" aria-hidden="true">check</span></label>;
                })}
              </div>
              <div className="campaign-custom-color">
                <div className="campaign-custom-color-heading"><span className="material-symbols-rounded" aria-hidden="true">add_circle</span><div><strong>Adicionar cor personalizada</strong><small>Ela será selecionada automaticamente para o corte {colorModel}.</small></div></div>
                <div className="campaign-custom-color-fields">
                  <label><span>Nome da cor</span><input value={customColorName} onChange={(event) => { setCustomColorName(event.target.value); setColorError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomCampaignColor(); } }} placeholder="Ex.: Lilás lavanda" maxLength={80} /></label>
                  <label><span>Código HEX</span><div className="campaign-custom-hex"><input type="color" aria-label="Selecionar cor personalizada" value={validHexColor(customColorHex) ? customColorHex : "#808080"} onChange={(event) => { setCustomColorHex(event.target.value.toUpperCase()); setColorError(""); }} /><input aria-label="Código HEX da cor personalizada" value={customColorHex} onChange={(event) => { setCustomColorHex(event.target.value.toUpperCase()); setColorError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomCampaignColor(); } }} placeholder="#8B5CF6" maxLength={7} spellCheck={false} /></div></label>
                  <button type="button" onClick={addCustomCampaignColor}><span className="material-symbols-rounded" aria-hidden="true">add</span>Adicionar cor</button>
                </div>
                {campaignColorOptions.some((color) => !shirtColors.some((standard) => colorKey(standard.name) === colorKey(color.name))) && (
                  <div className="campaign-custom-color-list" aria-label="Cores personalizadas desta campanha">
                    {campaignColorOptions.filter((color) => !shirtColors.some((standard) => colorKey(standard.name) === colorKey(color.name))).map((color) => <div key={color.name}><i style={{ backgroundColor: color.hex }} /><span><strong>{color.name}</strong><small>{color.hex.toUpperCase()}</small></span><button type="button" onClick={() => removeCustomCampaignColor(color.name)} aria-label={`Remover a cor personalizada ${color.name}`}><span className="material-symbols-rounded" aria-hidden="true">close</span></button></div>)}
                  </div>
                )}
              </div>
              {colorError && <p className="campaign-color-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{colorError}</p>}
              <p className="campaign-color-summary"><span className="material-symbols-rounded" aria-hidden="true">palette</span><strong>{modelColors[colorModel].length}</strong> {modelColors[colorModel].length === 1 ? "cor liberada" : "cores liberadas"} para {colorModel === "Comum" ? "Padrão" : colorModel}.</p>
            </fieldset>

            <fieldset className="campaign-size-setup" disabled={variantsLocked}><legend>Tamanhos disponíveis por corte</legend>
              <p>{editing ? "Um tamanho que já tenha pedido não pode sair: o painel avisa qual pedido trava." : "Já vem pré-marcado. Desmarque só o que a turma não vai pedir."} Os tamanhos com <b>B</b> são de modelagem baby look.</p>
              <div className="campaign-size-tabs" role="group" aria-label="Corte para configurar os tamanhos">
                {shirtModels.filter((item) => selectedModels[item.name]).map((item) => <button className={sizeModel === item.name ? "is-active" : ""} type="button" aria-pressed={sizeModel === item.name} onClick={() => { setSizeModel(item.name); setSizeError(""); }} key={item.name}>{item.name === "Comum" ? "Padrão" : item.name}<span>{modelSizes[item.name].length}</span></button>)}
              </div>
              {(["standard", "baby_look"] as SizeGroup[]).map((group) => {
                const groupSizes = sizesInGroup(group);
                const allSelected = groupSizes.every((size) => modelSizes[sizeModel].includes(size));
                return (
                  <div className="campaign-size-setup-group" key={group}>
                    <div className="campaign-size-setup-heading">
                      <span>{sizeGroupLabels[group]}</span>
                      <button type="button" onClick={() => toggleSizeGroup(sizeModel, group)}>{allSelected ? "desmarcar todos" : "marcar todos"}</button>
                    </div>
                    <div className="campaign-size-palette" aria-label={`Tamanhos ${sizeGroupLabels[group]} para ${sizeModel}`}>
                      {groupSizes.map((size) => {
                        const checked = modelSizes[sizeModel].includes(size);
                        return <label className={checked ? "is-selected" : ""} key={size}><input type="checkbox" checked={checked} onChange={() => toggleCampaignSize(sizeModel, size)} /><span>{size}</span></label>;
                      })}
                    </div>
                  </div>
                );
              })}
              {sizeError && <p className="campaign-size-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{sizeError}</p>}
              <p className="campaign-size-summary"><span className="material-symbols-rounded" aria-hidden="true">straighten</span><strong>{modelSizes[sizeModel].length}</strong> {modelSizes[sizeModel].length === 1 ? "tamanho liberado" : "tamanhos liberados"} para {sizeModel === "Comum" ? "Padrão" : sizeModel}.</p>
            </fieldset>

            <fieldset className="campaign-artwork"><legend>Arte da campanha</legend>
              <div className="campaign-artwork-guidance"><span className="material-symbols-rounded" aria-hidden="true">info</span><div><strong>Uma imagem só</strong><p>A mesma arte vale para todos os cortes e tamanhos. Envie <b>PNG, JPG ou WEBP</b> com até <b>2 MB</b>. Recomendamos <b>1200 × 1500 px</b>, proporção próxima de <b>4:5</b>, peça centralizada e fundo neutro ou transparente. O mínimo aceito é <b>600 × 800 px</b>.</p></div></div>
              <div className="campaign-artwork-uploads">
                <label className="campaign-artwork-main">
                  <span>Frente<b>obrigatória</b></span>
                  <div>
                    {front.preview || existingArt.front ? <img src={front.preview || existingArt.front} alt="Prévia da arte de frente da campanha" /> : <span className="campaign-artwork-empty"><span className="material-symbols-rounded" aria-hidden="true">add_photo_alternate</span>Selecionar arquivo</span>}
                    <span className="material-symbols-rounded" aria-hidden="true">upload</span>
                  </div>
                  <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Enviar a arte de frente da campanha" onChange={(event) => chooseArt(event, "front")} />
                  <small>{front.preview ? "Arte nova selecionada" : existingArt.front ? "Arte atual. Clique para trocar" : "Clique para selecionar"}</small>
                </label>
                <label className="campaign-artwork-optional">
                  <span>Costas<b>opcional</b></span>
                  <div>
                    {back.preview || existingArt.back ? <img src={back.preview || existingArt.back} alt="Prévia da arte de costas da campanha" /> : <span className="campaign-artwork-empty"><span className="material-symbols-rounded" aria-hidden="true">add</span>Só se a arte tiver costas</span>}
                    <span className="material-symbols-rounded" aria-hidden="true">upload</span>
                  </div>
                  <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Enviar a arte de costas da campanha" onChange={(event) => chooseArt(event, "back")} />
                  <small>{back.preview ? "Arte nova selecionada" : existingArt.back ? "Arte atual. Clique para trocar" : "Sem esta imagem, o aluno vê só a frente"}</small>
                </label>
              </div>
              {(back.preview || existingArt.back) && <button className="campaign-artwork-remove" type="button" onClick={removeBackArt}><span className="material-symbols-rounded" aria-hidden="true">delete</span>Remover a imagem de costas</button>}
              {artError && <p className="campaign-artwork-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{artError}</p>}
              <p className="campaign-artwork-status">
                <span className="material-symbols-rounded" aria-hidden="true">{front.preview || existingArt.front ? "verified" : "pending"}</span>
                {front.preview
                  ? `Arte nova pronta para os ${shirtModels.length} cortes da campanha. A anterior é apagada ao salvar.`
                  : existingArt.front
                    ? "A campanha já tem arte. Envie um arquivo só se quiser trocá-la."
                    : "Envie a arte de frente para liberar a campanha."}
              </p>
            </fieldset>

            {formError && <p className="campaign-form-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{formError}</p>}
            <div className="campaign-create-actions">
              <button className="outline-action" type="button" onClick={closeForm}>Cancelar</button>
              <button className="primary-action" type="submit" disabled={submitting}>
                {submitting
                  ? (editing ? "Salvando..." : "Enviando arte e criando...")
                  : (editing ? "Salvar alterações" : "Criar campanha e gerar acesso")}
                <span className="material-symbols-rounded" aria-hidden="true">{editing ? "check" : "arrow_forward"}</span>
              </button>
            </div>
          </form>
          )}
        </section>
      )}

      {notice && <p className="campaign-notice" role="status"><span className="material-symbols-rounded" aria-hidden="true">check_circle</span>{notice}</p>}

      {shared && <CampaignSharePanel campaign={shared} onClose={() => setShared(null)} />}

      <section className="campaign-management" aria-label="Campanhas cadastradas">
        <div className="campaign-management-toolbar">
          <div className="campaign-filters" role="group" aria-label="Filtrar campanhas">
            <button className={phaseFilter === "all" ? "is-active" : ""} type="button" onClick={() => setPhaseFilter("all")}>Todas<span>{campaigns.length}</span></button>
            {phaseOrder.map((phase) => {
              const count = campaigns.filter((campaign) => campaign.phase === phase).length;
              if (count === 0 && phaseFilter !== phase) return null;
              return <button className={phaseFilter === phase ? "is-active" : ""} type="button" onClick={() => setPhaseFilter(phase)} key={phase}>{phaseMeta[phase].label}<span>{count}</span></button>;
            })}
          </div>
          <span>{filtered.length} {filtered.length === 1 ? "campanha" : "campanhas"}</span>
        </div>

        <div className="campaign-admin-grid">
          {filtered.map((campaign) => (
            <article className="campaign-admin-card" key={campaign.code}>
              <div className="campaign-admin-card-image"><img src={campaign.artFront} alt={`Arte da campanha ${campaign.title}`} /><span className={`campaign-state campaign-state--${phaseMeta[campaign.phase].tone}`}>{phaseMeta[campaign.phase].label}</span></div>
              <div className="campaign-admin-card-body"><small>{campaign.code}</small><h3>{campaign.title}</h3><p><span className="material-symbols-rounded" aria-hidden="true">person</span>{campaign.representative}</p><dl><div><dt>Pedidos</dt><dd>{campaign.orderCount}</dd></div><div><dt>Vendas</dt><dd>{formatCents(campaign.paidTotalCents)}</dd></div><div><dt>Prazo</dt><dd>{campaign.deadlineLabel.replace("Pedidos até ", "")}</dd></div></dl><div className="campaign-admin-card-actions"><button className="campaign-card-action campaign-card-action--edit" type="button" onClick={() => startEdit(campaign)}><span className="material-symbols-rounded" aria-hidden="true">edit</span><span>Editar</span></button><button className="campaign-card-action campaign-card-action--share" type="button" onClick={() => { closeForm(); setNotice(""); setShared(campaign); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span>Ver e compartilhar</span><span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button></div></div>
            </article>
          ))}
          {filtered.length === 0 && (
            <section className="simple-state">
              <span className="material-symbols-rounded" aria-hidden="true">filter_alt_off</span>
              <h3>Nenhuma campanha nesse filtro</h3>
              <p>Escolha outra fase para ver as campanhas cadastradas.</p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function CampaignSharePanel({ campaign, onClose }: { campaign: PanelCampaign; onClose: () => void }) {
  const [copied, setCopied] = useState<"" | "code" | "link">("");
  const campaignLink = buildRoute(undefined, campaign.code);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(campaignLink)}`;

  async function copy(value: string, type: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
    } catch {
      setCopied("");
    }
  }

  return (
    <section className="campaign-share-panel" aria-labelledby="campaign-share-title">
      <header><div><span className="campaign-share-success"><span className="material-symbols-rounded" aria-hidden="true">check</span>Campanha pronta para divulgação</span><h3 id="campaign-share-title">{campaign.title}</h3><p>Envie uma destas opções somente ao representante da turma.</p></div><button type="button" onClick={onClose} aria-label="Fechar compartilhamento"><span className="material-symbols-rounded" aria-hidden="true">close</span></button></header>
      <div className="campaign-share-content">
        <div className="campaign-share-options">
          <article><span className="material-symbols-rounded" aria-hidden="true">password</span><div><small>Código da campanha</small><strong>{campaign.code}</strong></div><button type="button" onClick={() => copy(campaign.code, "code")}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></article>
          <article><span className="material-symbols-rounded" aria-hidden="true">link</span><div><small>Link privado</small><strong>{campaignLink}</strong></div><button type="button" onClick={() => copy(campaignLink, "link")}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></article>
          <dl className="campaign-share-sizes">
            <div><dt>Fase</dt><dd>{phaseMeta[campaign.phase].label}</dd></div>
            <div><dt>Prazo</dt><dd>{campaign.deadlineLabel}</dd></div>
            <div><dt>Representante</dt><dd>{campaign.representative}</dd></div>
          </dl>
          <a href={campaignLink} target="_blank" rel="noreferrer">Abrir página da campanha<span className="material-symbols-rounded" aria-hidden="true">open_in_new</span></a>
          <p role="status" aria-live="polite">{copied === "code" ? "Código copiado." : copied === "link" ? "Link privado copiado." : "O acesso não aparece na página pública."}</p>
        </div>
        <figure><img src={qrUrl} alt={`QR Code de acesso à campanha ${campaign.title}`} /><figcaption><strong>QR Code da campanha</strong><span>O representante pode colocar este código nos materiais da turma.</span></figcaption></figure>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pedidos por campanha                                                */
/* ------------------------------------------------------------------ */

function Orders({ data }: { data: PanelData }) {
  const { campaigns, orders, mode, loadOrders, reload } = data;
  const [selectedCode, setSelectedCode] = useState(campaigns[0]?.code ?? "");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentStatusCode>("all");
  const [feedback, setFeedback] = useState("");
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [cancellingOrder, setCancellingOrder] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [refundingOrder, setRefundingOrder] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundReceipt, setRefundReceipt] = useState("");
  const [viewingOrderNumber, setViewingOrderNumber] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = campaigns.find((campaign) => campaign.code === selectedCode) ?? campaigns[0];

  useEffect(() => {
    if (selected) loadOrders(selected.code);
  }, [selected?.code, loadOrders]);

  const campaignOrders = selected ? orders[selected.code] ?? [] : [];
  const viewingOrder = campaignOrders.find((order) => order.number === viewingOrderNumber);
  const currentPhaseIndex = selected ? phaseOrder.indexOf(selected.phase) : 0;
  const production = useMemo(
    () => (selected ? groupProduction(productionFromOrders([selected], orders)) : []),
    [selected, orders],
  );
  const productionColumns = usedSizes(production);
  const pieceCount = production.reduce((total, group) => total + group.total, 0);

  const filteredOrders = campaignOrders.filter((order) => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !query || [order.number, order.customer, ...panelOrderItems(order).flatMap((item) => [item.model, item.color, item.size])].some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query));
    const matchesPayment = paymentFilter === "all" || order.paymentStatus === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  function selectCampaign(code: string) {
    setSelectedCode(code);
    setSearch("");
    setPaymentFilter("all");
    setFeedback("");
    setConfirmingReturn(false);
    setReturnReason("");
    setCancellingOrder("");
    setCancellationReason("");
    setRefundingOrder("");
    setRefundReference("");
    setRefundReason("");
    setRefundReceipt("");
    setViewingOrderNumber("");
  }

  useEffect(() => {
    if (!viewingOrderNumber) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewingOrderNumber("");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [viewingOrderNumber]);

  async function movePhase(target: CampaignPhaseCode, reason?: string) {
    if (!selected) return;
    if (mode !== "live") {
      setFeedback("Sem sessão no servidor, a fase não pode ser alterada.");
      return;
    }
    setBusy(true);
    try {
      await changeCampaignPhaseInApi(selected.code, target, reason);
      setFeedback(`Fase atualizada: ${phaseMeta[target].label}.`);
      setConfirmingReturn(false);
      setReturnReason("");
      reload();
      loadOrders(selected.code);
    } catch (phaseError) {
      setFeedback(errorMessage(phaseError, "Não foi possível alterar a fase."));
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder(orderNumber: string) {
    if (!selected) return;
    if (mode !== "live") {
      setFeedback("Sem sessão no servidor, o pedido não pode ser cancelado.");
      return;
    }
    const reason = cancellationReason.trim();
    if (reason.length < 3) {
      setFeedback("Informe um motivo com pelo menos 3 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await cancelOrderInApi(orderNumber, reason);
      setFeedback(`Pedido ${orderNumber} cancelado. Ele foi retirado da produção e da entrega.`);
      setCancellingOrder("");
      setCancellationReason("");
      reload();
      loadOrders(selected.code);
    } catch (cancellationError) {
      setFeedback(errorMessage(cancellationError, "Não foi possível cancelar o pedido."));
    } finally {
      setBusy(false);
    }
  }

  async function registerRefund(orderNumber: string) {
    if (!selected) return;
    if (mode !== "live") {
      setFeedback("Sem sessão no servidor, o reembolso não pode ser registrado.");
      return;
    }
    const order = campaignOrders.find((candidate) => candidate.number === orderNumber);
    if (!order) return;
    const providerRefundId = refundReference.trim();
    const reason = refundReason.trim();
    if (providerRefundId.length < 3 || reason.length < 3) {
      setFeedback("Informe a referência da InfinitePay e o motivo do reembolso.");
      return;
    }
    setBusy(true);
    try {
      await registerOrderRefundInApi({
        orderNumber,
        amountCents: order.totalCents,
        providerRefundId,
        reason,
        receiptUrl: refundReceipt.trim() || undefined,
      });
      setFeedback(`Reembolso integral de ${formatCents(order.totalCents)} registrado; o pedido ${orderNumber} foi cancelado.`);
      setRefundingOrder("");
      setRefundReference("");
      setRefundReason("");
      setRefundReceipt("");
      reload();
      loadOrders(selected.code);
    } catch (refundError) {
      setFeedback(errorMessage(refundError, "Não foi possível registrar o reembolso."));
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <div className="admin-content">
        <section className="simple-state">
          <span className="material-symbols-rounded" aria-hidden="true">receipt_long</span>
          <h3>Nenhuma campanha em fluxo</h3>
          <p>Crie uma campanha para acompanhar os pedidos por aqui.</p>
        </section>
      </div>
    );
  }

  const nextPhase = phaseOrder[currentPhaseIndex + 1];
  const previousPhase = phaseOrder[currentPhaseIndex - 1];

  return (
    <div className="admin-content admin-orders-workspace">
      <section className="orders-flow-shell" aria-label="Pedidos organizados por campanha">
        <aside className="orders-campaign-rail">
          <header><span>Campanhas</span><small>{campaigns.length} no fluxo</small></header>
          <div className="orders-campaign-list">
            {campaigns.map((campaign) => (
              <button className={campaign.code === selected.code ? "is-selected" : ""} type="button" onClick={() => selectCampaign(campaign.code)} key={campaign.code} aria-pressed={campaign.code === selected.code}>
                <img src={campaign.artFront} alt="" />
                <span className="orders-campaign-card-copy">
                  <strong>{campaign.title}</strong>
                  <em className={`campaign-flow-badge campaign-flow-badge--${phaseMeta[campaign.phase].tone}`}>{phaseMeta[campaign.phase].label}</em>
                  <span><b>{campaign.orderCount}</b> pedidos <b>{formatCents(campaign.paidTotalCents)}</b> pagos</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="orders-campaign-detail">
          <header className="orders-selected-header">
            <img src={selected.artFront} alt={`Arte da campanha ${selected.title}`} />
            <div><span>Campanha selecionada</span><h2>{selected.title}</h2><p>{selected.deadlineLabel} · Retirada com {selected.representative}</p></div>
          </header>

          <ol className="campaign-phase-track" aria-label="Fase operacional da campanha">
            {phaseOrder.map((phase, index) => {
              const state = index < currentPhaseIndex ? "is-complete" : index === currentPhaseIndex ? "is-current" : "";
              return (
                <li className={state} key={phase} aria-current={index === currentPhaseIndex ? "step" : undefined}>
                  <span className="material-symbols-rounded" aria-hidden="true">{index < currentPhaseIndex ? "check" : phaseMeta[phase].icon}</span>
                  <strong>{phaseMeta[phase].label}</strong>
                </li>
              );
            })}
          </ol>

          <section className="campaign-phase-action" aria-label="Atualizar fase da campanha">
            <span className="material-symbols-rounded" aria-hidden="true">info</span>
            <div><strong>{phaseMeta[selected.phase].sentence}</strong><p>A fase é aplicada à campanha inteira e aos pedidos com pagamento confirmado.</p></div>
            <div className="campaign-phase-actions">
              {confirmingReturn && previousPhase ? (
                <>
                  <label className="campaign-phase-reason">
                    <span>Motivo do retorno</span>
                    <input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Ex.: arte precisou de ajuste" minLength={3} />
                  </label>
                  <button className="campaign-phase-cancel" type="button" onClick={() => { setConfirmingReturn(false); setReturnReason(""); setFeedback("Retorno cancelado. A fase da campanha não foi alterada."); }}>Cancelar</button>
                  <button className="campaign-phase-confirm" type="button" disabled={busy || returnReason.trim().length < 3} onClick={() => movePhase(previousPhase, returnReason.trim())}><span className="material-symbols-rounded" aria-hidden="true">undo</span>Confirmar retorno</button>
                </>
              ) : (
                <>
                  <button className="campaign-phase-back" type="button" disabled={!previousPhase || busy} onClick={() => { setConfirmingReturn(true); setFeedback(`Informe o motivo para voltar a campanha para ${phaseMeta[previousPhase!].short}.`); }}><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>{previousPhase ? `Voltar para ${phaseMeta[previousPhase].short}` : "Etapa inicial"}</button>
                  <button className="campaign-phase-next" type="button" disabled={!nextPhase || busy} onClick={() => movePhase(nextPhase)}>{nextPhase ? `Avançar para ${phaseMeta[nextPhase].short}` : "Campanha finalizada"}<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
                </>
              )}
            </div>
          </section>
          <p className="campaign-phase-feedback" role="status" aria-live="polite">{feedback}</p>

          <section className="campaign-production-table" aria-labelledby="production-summary-title">
            <header><div><h3 id="production-summary-title">Resumo de produção</h3><p>Somente peças de pedidos com pagamento confirmado.</p></div><strong>{pieceCount} {pieceCount === 1 ? "peça" : "peças"} no total</strong></header>
            {production.length === 0 ? (
              <p className="campaign-production-empty"><span className="material-symbols-rounded" aria-hidden="true">hourglass_empty</span>Nenhum pagamento confirmado nesta campanha ainda.</p>
            ) : (
              <div className="campaign-production-scroll" style={{ "--size-columns": productionColumns.length } as CSSProperties}>
                <div className="campaign-production-head"><span>Corte e cor</span>{productionColumns.map((size) => <span key={size}>{size}</span>)}<span>Total</span></div>
                {production.map((group) => (
                  <div className="campaign-production-row" key={`${group.modelName}-${group.colorName}`}>
                    <span><strong>{group.modelName}</strong><small>{group.colorName}</small></span>
                    {productionColumns.map((size) => <span key={size}>{group.sizes[size] ?? 0}</span>)}<strong>{group.total}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="campaign-orders-table" aria-labelledby="campaign-orders-title">
            <header>
              <div><h3 id="campaign-orders-title">Pedidos da campanha</h3><p>{campaignOrders.length} {campaignOrders.length === 1 ? "linha registrada" : "linhas registradas"}</p></div>
              <div className="campaign-order-filters">
                <label><span className="sr-only">Buscar pedido ou cliente</span><span className="material-symbols-rounded" aria-hidden="true">search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pedido ou cliente" /></label>
                <label><span className="sr-only">Filtrar por pagamento</span>
                  <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as "all" | PaymentStatusCode)}>
                    <option value="all">Todos</option>
                    {(Object.keys(paymentLabels) as PaymentStatusCode[]).map((status) => <option value={status} key={status}>{paymentLabels[status]}</option>)}
                  </select>
                </label>
              </div>
            </header>
            {cancellingOrder && (
              <section className="order-cancellation-form" aria-label={`Cancelar pedido ${cancellingOrder}`}>
                <div>
                  <span className="material-symbols-rounded" aria-hidden="true">cancel</span>
                  <div><strong>Cancelar {cancellingOrder}</strong><p>O pedido permanecerá no histórico, mas sairá da produção e da entrega.</p></div>
                </div>
                <label><span>Motivo do cancelamento</span><input autoFocus value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Ex.: pedido duplicado informado pelo cliente" minLength={3} maxLength={500} /></label>
                <div className="order-cancellation-actions">
                  <button type="button" disabled={busy} onClick={() => { setCancellingOrder(""); setCancellationReason(""); setFeedback("Cancelamento descartado. O pedido não foi alterado."); }}>Manter pedido</button>
                  <button type="button" disabled={busy || cancellationReason.trim().length < 3} onClick={() => cancelOrder(cancellingOrder)}>Confirmar cancelamento</button>
                </div>
              </section>
            )}
            {refundingOrder && (
              <section className="order-refund-form" aria-label={`Registrar reembolso do pedido ${refundingOrder}`}>
                <div className="order-refund-heading">
                  <span className="material-symbols-rounded" aria-hidden="true">currency_exchange</span>
                  <div><strong>Reembolso integral de {refundingOrder}</strong><p>Faça primeiro o estorno no app InfinitePay. Este registro não movimenta dinheiro; ele guarda a referência e cancela o pedido local.</p></div>
                </div>
                <label><span>Referência do estorno na InfinitePay</span><input autoFocus value={refundReference} onChange={(event) => setRefundReference(event.target.value)} placeholder="Código ou identificação exibida pelo provedor" minLength={3} maxLength={190} /></label>
                <label><span>Motivo</span><input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Ex.: desistência solicitada pelo cliente" minLength={3} maxLength={500} /></label>
                <label><span>Link HTTPS do comprovante (opcional)</span><input type="url" value={refundReceipt} onChange={(event) => setRefundReceipt(event.target.value)} placeholder="https://..." maxLength={2048} /></label>
                <div className="order-refund-actions">
                  <button type="button" disabled={busy} onClick={() => { setRefundingOrder(""); setRefundReference(""); setRefundReason(""); setRefundReceipt(""); setFeedback("Registro descartado. Nenhum estado foi alterado."); }}>Voltar</button>
                  <button type="button" disabled={busy || refundReference.trim().length < 3 || refundReason.trim().length < 3} onClick={() => registerRefund(refundingOrder)}>Confirmar registro e cancelar</button>
                </div>
              </section>
            )}
            <div className="campaign-orders-scroll">
              <div className="campaign-orders-head"><span>Pedido</span><span>Cliente</span><span>Corte</span><span>Cor</span><span>Tam.</span><span>Qtd.</span><span>Pagamento</span><span>Entrega</span><span>Ação</span></div>
              {filteredOrders.map((order) => (
                <div className="campaign-orders-row" key={order.number}>
                  <button className="campaign-order-number" type="button" title={`Ver detalhes do pedido ${order.number}`} onClick={() => setViewingOrderNumber(order.number)}><strong>#{order.number}</strong><small className={order.status === "cancelled" ? "is-cancelled" : ""}>{order.status === "cancelled" ? "Cancelado" : "Ver detalhes"}</small></button><span>{order.customer}</span><span>{panelOrderItems(order).length === 1 ? order.model : `${panelOrderItems(order).length} combinações`}</span>
                  <span className="campaign-order-color">{panelOrderItems(order).length === 1 ? <><i style={{ backgroundColor: order.colorHex }} />{order.color}</> : <small className="campaign-order-items-summary">{panelOrderItems(order).map((item) => `${item.color} ${item.size}`).join(" · ")}</small>}</span>
                  <span>{panelOrderItems(order).length === 1 ? order.size : "Vários"}</span><span>{order.quantity}</span>
                  <span className={`order-payment order-payment--${order.paymentStatus}`}>
                    <i />{paymentLabels[order.paymentStatus]}
                  </span>
                  {order.status === "cancelled" ? (
                    <span className="order-delivery order-delivery--cancelled" title={order.cancellationReason ?? undefined}><span className="material-symbols-rounded" aria-hidden="true">cancel</span>Cancelado</span>
                  ) : (
                    <span className="order-delivery"><span className="material-symbols-rounded" aria-hidden="true">schedule</span>{deliveryLabels[effectiveDelivery(order, selected.phase)]}</span>
                  )}
                  <span className="order-row-action">
                    {order.status === "cancelled"
                      ? <small title={order.cancellationReason ?? undefined}>No histórico</small>
                      : order.paymentStatus === "paid"
                        ? <button className="order-refund-action" type="button" disabled={busy} onClick={() => { setCancellingOrder(""); setRefundingOrder(order.number); setRefundReference(""); setRefundReason(""); setRefundReceipt(""); setFeedback(`Faça o estorno integral na InfinitePay e registre a referência do pedido ${order.number}.`); }}>Reembolsar</button>
                        : order.paymentStatus === "partially_refunded"
                          ? <small>Atendimento manual</small>
                          : <button type="button" disabled={busy} onClick={() => { setRefundingOrder(""); setCancellingOrder(order.number); setCancellationReason(""); setFeedback(`Informe o motivo para cancelar o pedido ${order.number}.`); }}>Cancelar</button>}
                  </span>
                </div>
              ))}
              {filteredOrders.length === 0 && <div className="campaign-orders-empty"><span className="material-symbols-rounded" aria-hidden="true">search_off</span><p>Nenhum pedido encontrado com esses filtros.</p></div>}
            </div>
            {viewingOrder && (
              <div className="order-detail-modal">
                <button className="order-detail-backdrop" type="button" aria-label="Fechar detalhes do pedido" onClick={() => setViewingOrderNumber("")} />
                <section className="order-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
                  <header>
                    <div><span>Detalhes do pedido</span><h3 id="order-detail-title">#{viewingOrder.number}</h3></div>
                    <button type="button" aria-label="Fechar detalhes" onClick={() => setViewingOrderNumber("")}><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
                  </header>
                  <div className="order-detail-summary">
                    <article><span>Cliente</span><strong>{viewingOrder.customer}</strong><small>{viewingOrder.whatsapp}</small>{viewingOrder.email && <small>{viewingOrder.email}</small>}</article>
                    <article><span>Pagamento</span><strong className={`order-payment order-payment--${viewingOrder.paymentStatus}`}><i />{paymentLabels[viewingOrder.paymentStatus]}</strong><small>{viewingOrder.status === "cancelled" ? "Pedido cancelado" : deliveryLabels[effectiveDelivery(viewingOrder, selected.phase)]}</small></article>
                    <article><span>Resumo</span><strong>{viewingOrder.quantity} {viewingOrder.quantity === 1 ? "peça" : "peças"}</strong><small>{panelOrderItems(viewingOrder).length} {panelOrderItems(viewingOrder).length === 1 ? "combinação" : "combinações"}</small></article>
                    <article><span>Total do pedido</span><strong>{formatCents(viewingOrder.totalCents)}</strong><small>Valor único da compra</small></article>
                  </div>
                  {viewingOrder.cancellationReason && <p className="order-detail-cancellation"><span className="material-symbols-rounded" aria-hidden="true">cancel</span><span><strong>Motivo do cancelamento</strong>{viewingOrder.cancellationReason}</span></p>}
                  <div className="order-detail-items">
                    <div className="order-detail-items-head"><span>Peça</span><span>Cor</span><span>Tamanho</span><span>Qtd.</span><span>Unitário</span><span>Subtotal</span></div>
                    {panelOrderItems(viewingOrder).map((item, index) => (
                      <article key={`${item.model}-${item.color}-${item.size}-${index}`}>
                        <span data-label="Peça"><strong>{item.model}</strong></span>
                        <span className="campaign-order-color" data-label="Cor"><i style={{ backgroundColor: item.colorHex }} />{item.color}</span>
                        <span data-label="Tamanho"><strong>{item.size}</strong></span>
                        <span data-label="Quantidade">{item.quantity}</span>
                        <span data-label="Unitário">{formatCents(item.unitPriceCents)}</span>
                        <span data-label="Subtotal"><strong>{formatCents(item.unitPriceCents * item.quantity)}</strong></span>
                      </article>
                    ))}
                  </div>
                  <footer><span>Somente pedidos pagos entram no relatório oficial de produção.</span><button type="button" onClick={() => setViewingOrderNumber("")}>Fechar</button></footer>
                </section>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function Products() {
  return (
    <div className="admin-content">
      <div className="section-actions">
        <div><span className="kicker">Catálogo</span><h2>Cortes e tamanhos</h2><p>Peças e medidas disponíveis para compor novas campanhas.</p></div>
      </div>
      <section className="simple-state">
        <span className="material-symbols-rounded" aria-hidden="true">checkroom</span>
        <h3>2 cortes e 12 tamanhos</h3>
        <p>Comum e Oversized estão disponíveis para novas campanhas. Baby look é um grupo de tamanhos ({sizesInGroup("baby_look").join(", ")}), não um corte.</p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Relatórios                                                          */
/* ------------------------------------------------------------------ */

function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function deliveryTone(status: DeliveryStatusCode) {
  if (status === "delivered") return "delivered";
  if (status === "ready") return "ready";
  if (status === "issue") return "issue";
  return "waiting";
}

function Reports({ data }: { data: PanelData }) {
  const { campaigns, orders, mode, loadOrders, reload } = data;
  const [report, setReport] = useState<"production" | "delivery">("production");
  const [campaignCode, setCampaignCode] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | DeliveryStatusCode>("all");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveProduction, setLiveProduction] = useState<ApiProductionRow[]>([]);
  const [liveDelivery, setLiveDelivery] = useState<ApiDeliveryRow[]>([]);
  const [loadCount, setLoadCount] = useState(0);

  const scoped = useMemo(
    () => (campaignCode === "all" ? campaigns : campaigns.filter((campaign) => campaign.code === campaignCode)),
    [campaigns, campaignCode],
  );

  // Na demonstração as mesmas regras das views do banco são aplicadas localmente,
  // para as duas fontes produzirem exatamente o mesmo formato.
  const demoProduction = useMemo(() => productionFromOrders(scoped, orders), [scoped, orders]);
  const demoDelivery = useMemo(() => deliveryFromOrders(scoped, orders), [scoped, orders]);

  useEffect(() => {
    if (mode !== "live") return;
    let active = true;
    const filter = campaignCode === "all" ? undefined : campaignCode;
    Promise.all([fetchProductionReport(filter), fetchDeliveryReport(filter)])
      .then(([production, delivery]) => {
        if (!active) return;
        setLiveProduction(production);
        setLiveDelivery(delivery);
        setFeedback("Relatórios sincronizados com os pagamentos confirmados.");
      })
      .catch((reportError) => {
        if (active) setFeedback(errorMessage(reportError, "Não foi possível carregar os relatórios."));
      });
    return () => { active = false; };
  }, [mode, campaignCode, loadCount]);

  useEffect(() => {
    if (mode !== "live") return;
    const timer = window.setInterval(() => setLoadCount((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, [mode]);

  const productionRows = mode === "live" ? liveProduction : demoProduction;
  const deliveryRows = mode === "live" ? liveDelivery : demoDelivery;
  const productionGroups = groupProduction(productionRows);
  const productionColumns = usedSizes(productionGroups);
  const productionTotal = productionGroups.reduce((total, group) => total + group.total, 0);
  const productionModels = new Set(productionGroups.map((group) => group.modelName)).size;
  const productionColors = new Set(productionGroups.map((group) => group.colorName)).size;
  const reportGeneratedAt = useMemo(() => new Date(), [campaignCode, loadCount, mode]);
  const productionSheets = useMemo(
    () => buildProductionSheets(productionRows, scoped, reportGeneratedAt),
    [productionRows, scoped, reportGeneratedAt],
  );
  const productionFilename = `ordem-producao-${campaignCode === "all" ? "todas-campanhas" : campaignCode.toLocaleLowerCase("pt-BR")}`;

  const normalizedSearch = deliverySearch.trim().toLocaleLowerCase("pt-BR");
  const filteredDelivery = deliveryRows.filter((row) => {
    const matchesStatus = deliveryFilter === "all" || row.deliveryStatus === deliveryFilter;
    const matchesSearch = !normalizedSearch || [row.campaignTitle, row.orderNumber, row.customerName, row.modelName, row.colorName, row.size].some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    return matchesStatus && matchesSearch;
  });
  const deliveryPending = deliveryRows.filter((row) => row.deliveryStatus === "ready").length;
  const deliveryDone = deliveryRows.filter((row) => row.deliveryStatus === "delivered").length;

  function exportCurrentReport() {
    if (report === "production") {
      if (productionSheets.length === 0) {
        setFeedback("Não há pedidos pagos para exportar no filtro atual.");
        return;
      }
      downloadProductionExcel(productionSheets, `${productionFilename}.xls`);
      setFeedback("Relatório de produção exportado para Excel.");
      return;
    }
    downloadCsv(
      "relatorio-entrega-representante.csv",
      ["Campanha", "Pedido", "Aluno", "Corte", "Cor", "Tamanho", "Quantidade", "Entrega"],
      filteredDelivery.map((row) => [row.campaignTitle, row.orderNumber, row.customerName, row.modelName, row.colorName, row.size, row.quantity, deliveryLabels[row.deliveryStatus]]),
    );
    setFeedback("Checklist de entrega exportado em CSV.");
  }

  function generateProductionPdf() {
    if (productionSheets.length === 0) {
      setFeedback("Não há pedidos pagos para gerar o PDF no filtro atual.");
      return;
    }
    setFeedback("Na janela de impressão, escolha “Salvar como PDF”.");
    printProductionReport(`${productionFilename}.pdf`);
  }

  async function markDelivered(orderNumber: string) {
    if (mode !== "live") {
      setFeedback("Sem sessão no servidor, a entrega não pode ser registrada.");
      return;
    }
    setBusy(true);
    try {
      await changeOrderDeliveryInApi(orderNumber, "delivered", "Entrega registrada no painel");
      setFeedback(`Entrega do pedido ${orderNumber} registrada.`);
      setLoadCount((value) => value + 1);
      reload();
      for (const campaign of scoped) loadOrders(campaign.code);
    } catch (deliveryError) {
      setFeedback(errorMessage(deliveryError, "Não foi possível registrar a entrega."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-content reports-page">
      <section className="reports-intro">
        <div><span className="kicker">Operação</span><h2>Relatórios da camisaria</h2><p>Produção consolidada para a oficina e checklist nominal para o representante da turma.</p></div>
        <div className="reports-intro-actions">
          <button className="outline-action" type="button" onClick={() => { setFeedback("Atualizando dados confirmados..."); setLoadCount((value) => value + 1); reload(); }}>Atualizar dados<span className="material-symbols-rounded" aria-hidden="true">refresh</span></button>
          <button className="outline-action" type="button" onClick={report === "production" ? generateProductionPdf : () => window.print()}>{report === "production" ? "Gerar PDF" : "Imprimir"}<span className="material-symbols-rounded" aria-hidden="true">{report === "production" ? "picture_as_pdf" : "print"}</span></button>
          <button className="primary-action" type="button" onClick={exportCurrentReport}>{report === "production" ? "Exportar Excel" : "Exportar CSV"}<span className="material-symbols-rounded" aria-hidden="true">download</span></button>
        </div>
      </section>

      <div className="report-tabs" role="tablist" aria-label="Tipo de relatório">
        <button className={report === "production" ? "is-active" : ""} type="button" role="tab" aria-selected={report === "production"} onClick={() => { setReport("production"); setFeedback(""); }}><span className="material-symbols-rounded" aria-hidden="true">precision_manufacturing</span><span><strong>Produção</strong><small>Quantidades para fabricar</small></span></button>
        <button className={report === "delivery" ? "is-active" : ""} type="button" role="tab" aria-selected={report === "delivery"} onClick={() => { setReport("delivery"); setFeedback(""); }}><span className="material-symbols-rounded" aria-hidden="true">redeem</span><span><strong>Entrega</strong><small>Checklist do representante</small></span></button>
      </div>

      <section className="report-toolbar" aria-label="Filtros do relatório">
        <label><span>Campanha</span>
          <select value={campaignCode} onChange={(event) => { setCampaignCode(event.target.value); setFeedback(""); }}>
            <option value="all">Todas as campanhas</option>
            {campaigns.map((campaign) => <option value={campaign.code} key={campaign.code}>{campaign.title}</option>)}
          </select>
        </label>
        {report === "delivery" && (
          <>
            <label className="report-search"><span>Buscar aluno ou pedido</span><div><span className="material-symbols-rounded" aria-hidden="true">search</span><input value={deliverySearch} onChange={(event) => setDeliverySearch(event.target.value)} placeholder="Nome ou número do pedido" /></div></label>
            <label><span>Situação da entrega</span>
              <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value as "all" | DeliveryStatusCode)}>
                <option value="all">Todos</option>
                {(Object.keys(deliveryLabels) as DeliveryStatusCode[]).map((status) => <option value={status} key={status}>{deliveryLabels[status]}</option>)}
              </select>
            </label>
          </>
        )}
      </section>
      <p className="report-feedback" role="status" aria-live="polite">{feedback}</p>

      {report === "production" ? (
        <>
          <section className="report-metrics" aria-label="Resumo da produção"><article><span>Peças confirmadas</span><strong>{productionTotal}</strong><small>Somente pedidos pagos</small></article><article><span>Campanhas</span><strong>{new Set(productionGroups.map((group) => group.campaignCode)).size}</strong><small>Com produção confirmada</small></article><article><span>Cortes</span><strong>{productionModels}</strong><small>Com produção confirmada</small></article><article><span>Cores</span><strong>{productionColors}</strong><small>Separadas para corte</small></article></section>
          <section className="production-report-card" aria-labelledby="production-report-title">
            <header><div><span className="material-symbols-rounded" aria-hidden="true">verified</span><div><h3 id="production-report-title">Ordem consolidada de produção</h3><p>Campanha → corte → cor → tamanho. Pendentes, falhos e reembolsados ficam fora.</p></div></div><strong>{productionTotal} {productionTotal === 1 ? "peça" : "peças"}</strong></header>
            {productionGroups.length === 0 ? (
              <p className="campaign-production-empty"><span className="material-symbols-rounded" aria-hidden="true">hourglass_empty</span>Nenhum pedido pago no filtro atual. Confirme os pagamentos em Pedidos para a produção aparecer aqui.</p>
            ) : (
              <div className="production-report-scroll" style={{ "--size-columns": productionColumns.length } as CSSProperties}>
                <div className="production-report-head"><span>Campanha</span><span>Corte</span><span>Cor</span>{productionColumns.map((size) => <span key={size}>{size}</span>)}<span>Total</span></div>
                {productionGroups.map((group) => (
                  <div className="production-report-row" key={`${group.campaignCode}-${group.modelName}-${group.colorName}`}>
                    <span><strong>{group.campaignTitle}</strong><small>{group.campaignCode}</small></span>
                    <span>{group.modelName}</span><span>{group.colorName}</span>
                    {productionColumns.map((size) => <span key={size}>{group.sizes[size] ?? 0}</span>)}<strong>{group.total}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
          <ProductionReport rows={productionRows} campaigns={scoped} generatedAt={reportGeneratedAt} />
        </>
      ) : (
        <>
          <section className="report-metrics report-metrics--delivery" aria-label="Resumo da entrega"><article><span>Pedidos pagos</span><strong>{deliveryRows.length}</strong><small>Aptos ao fluxo de entrega</small></article><article><span>A entregar</span><strong>{deliveryPending}</strong><small>Disponíveis com representante</small></article><article><span>Entregues</span><strong>{deliveryDone}</strong><small>Confirmados no checklist</small></article><article><span>Exibidos</span><strong>{filteredDelivery.length}</strong><small>Após busca e filtros</small></article></section>
          <section className="delivery-report-card" aria-labelledby="delivery-report-title">
            <header><div><h3 id="delivery-report-title">Checklist de entrega</h3><p>Somente pedidos com pagamento confirmado. A produção continua controlada pela campanha.</p></div><strong>{filteredDelivery.length} {filteredDelivery.length === 1 ? "pedido" : "pedidos"}</strong></header>
            <div className="delivery-report-list">
              <div className="delivery-report-head"><span>Campanha</span><span>Pedido / aluno</span><span>Camisa</span><span>Qtd.</span><span>Entrega</span><span>Ação</span></div>
              {filteredDelivery.map((row) => {
                const canDeliver = row.deliveryStatus === "ready";
                return (
                  <article className="delivery-report-row" key={`${row.orderNumber}-${row.size}-${row.colorName}`}>
                    <span data-label="Campanha"><strong>{row.campaignTitle}</strong><small>{row.representativeName}</small></span>
                    <span data-label="Pedido / aluno"><strong>{row.orderNumber}</strong><small>{row.customerName}</small></span>
                    <span data-label="Camisa"><strong>{row.modelName} · {row.colorName}</strong><small>Tamanho {row.size}</small></span>
                    <span data-label="Qtd."><strong>{row.quantity}</strong></span>
                    <span data-label="Entrega"><em className={`delivery-report-status delivery-report-status--${deliveryTone(row.deliveryStatus)}`}>{deliveryLabels[row.deliveryStatus]}</em></span>
                    <span data-label="Ação"><button type="button" disabled={busy || !canDeliver} onClick={() => markDelivered(row.orderNumber)}>{row.deliveryStatus === "delivered" ? "Entregue" : canDeliver ? "Marcar entregue" : "Aguardar campanha"}</button></span>
                  </article>
                );
              })}
              {filteredDelivery.length === 0 && <div className="delivery-report-empty"><span className="material-symbols-rounded" aria-hidden="true">search_off</span><p>Nenhum pedido pago corresponde aos filtros.</p></div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
