import { ChangeEvent, FormEvent, useState } from "react";
import { buildRoute, STAFF_SESSION_KEY } from "../App";
import { defaultCampaignColors, DEMO_CAMPAIGNS_STORAGE_KEY, privateCampaigns, shirtColors, shirtModels, showcaseCampaigns } from "../data";
import type { PrivateCampaign, ShirtColorName, ShirtColorOption, ShirtModelName } from "../data";
import { Brand } from "./Brand";

type AdminSection = "overview" | "campaigns" | "orders" | "products" | "reports";

const nav: Array<[AdminSection, string, string]> = [
  ["overview", "dashboard", "Visão geral"],
  ["campaigns", "campaign", "Campanhas"],
  ["orders", "receipt_long", "Pedidos"],
  ["products", "checkroom", "Produtos"],
  ["reports", "monitoring", "Relatórios"],
];

type CampaignStatus = "Ativa" | "Em produção" | "Encerrada";

type AdminCampaign = {
  name: string;
  count: number;
  status: CampaignStatus;
  deadline: string;
  revenue: string;
  code: string;
  representative: string;
  image: string;
  prices: Record<ShirtModelName, number>;
  modelImages: Record<ShirtModelName, { front: string; back: string }>;
  colors: Record<ShirtModelName, ShirtColorOption[]>;
};

function defaultModelImages(): Record<ShirtModelName, { front: string; back: string }> {
  return {
    Comum: { front: shirtModels[0].image, back: shirtModels[0].backImage },
    Oversized: { front: shirtModels[1].image, back: shirtModels[1].backImage },
    "Baby Look": { front: shirtModels[2].image, back: shirtModels[2].backImage },
  };
}

function defaultModelColorNames(): Record<ShirtModelName, ShirtColorName[]> {
  return {
    Comum: defaultCampaignColors.Comum.map((color) => color.name),
    Oversized: defaultCampaignColors.Oversized.map((color) => color.name),
    "Baby Look": defaultCampaignColors["Baby Look"].map((color) => color.name),
  };
}

function selectedCampaignColors(selection: Record<ShirtModelName, ShirtColorName[]>): Record<ShirtModelName, ShirtColorOption[]> {
  return {
    Comum: shirtColors.filter((color) => selection.Comum.includes(color.name)),
    Oversized: shirtColors.filter((color) => selection.Oversized.includes(color.name)),
    "Baby Look": shirtColors.filter((color) => selection["Baby Look"].includes(color.name)),
  };
}

const campaigns: AdminCampaign[] = [
  { name: "Engenharia Civil — Turma 2026", count: 82, status: "Ativa", deadline: "31 ago", revenue: "R$ 4.911,80", code: "MENDES-ENG-26", representative: "Lucas Pereira", image: showcaseCampaigns[0].image, prices: { Comum: 59.9, Oversized: 69.9, "Baby Look": 62.9 }, modelImages: defaultModelImages(), colors: privateCampaigns["MENDES-ENG-26"].colors ?? defaultCampaignColors },
  { name: "Enfermagem — 8º período", count: 67, status: "Em produção", deadline: "18 ago", revenue: "R$ 4.013,30", code: "MENDES-ENF-26", representative: "Juliana Costa", image: showcaseCampaigns[1].image, prices: { Comum: 59.9, Oversized: 69.9, "Baby Look": 62.9 }, modelImages: defaultModelImages(), colors: defaultCampaignColors },
  { name: "Administração — Noturno", count: 51, status: "Encerrada", deadline: "Concluída", revenue: "R$ 3.054,90", code: "MENDES-ADM-26", representative: "Rafael Lima", image: showcaseCampaigns[2].image, prices: { Comum: 57.9, Oversized: 67.9, "Baby Look": 60.9 }, modelImages: defaultModelImages(), colors: defaultCampaignColors },
];

const orders = [
  { id: "#CM-2026-0151", customer: "Marina Azevedo", campaign: "Engenharia Civil", model: "Baby Look · M", total: "R$ 59,90", status: "Entregue", tone: "delivered" },
  { id: "#CM-2026-0150", customer: "João Pedro", campaign: "Engenharia Civil", model: "Comum · G", total: "R$ 59,90", status: "Pronto", tone: "ready" },
  { id: "#CM-2026-0148", customer: "Ana Clara", campaign: "Engenharia Civil", model: "Oversized · M", total: "R$ 59,90", status: "Produção", tone: "production" },
  { id: "#CM-2026-0147", customer: "Lucas Henrique", campaign: "Engenharia Civil", model: "Comum · GG", total: "R$ 59,90", status: "Aguardando", tone: "pending" },
];

type CampaignPhase = "Recebendo pedidos" | "Pedidos encerrados" | "Em produção" | "Pronta para entrega" | "Finalizada";
type PaymentStatus = "Pago" | "Aguardando" | "Falhou" | "Reembolsado";
type DeliveryStatus = "A entregar" | "Entregue" | "Ocorrência";
type ProductionSize = "PP" | "P" | "M" | "G" | "GG" | "XG";

type FlowOrder = {
  id: string;
  customer: string;
  model: ShirtModelName;
  color: string;
  colorHex: string;
  size: string;
  quantity: number;
  payment: PaymentStatus;
  delivery: DeliveryStatus;
};

type ProductionRow = {
  model: ShirtModelName;
  color: string;
  sizes: Partial<Record<ProductionSize, number>>;
  total: number;
};

const productionSizes: ProductionSize[] = ["PP", "P", "M", "G", "GG", "XG"];

type OrderCampaign = {
  code: string;
  name: string;
  deadline: string;
  representative: string;
  image: string;
  initialPhase: CampaignPhase;
  orderCount: number;
  pieceCount: number;
  production: ProductionRow[];
  orders: FlowOrder[];
};

const campaignPhases: Array<{ label: CampaignPhase; icon: string }> = [
  { label: "Recebendo pedidos", icon: "shopping_cart" },
  { label: "Pedidos encerrados", icon: "fact_check" },
  { label: "Em produção", icon: "precision_manufacturing" },
  { label: "Pronta para entrega", icon: "inventory_2" },
  { label: "Finalizada", icon: "check_circle" },
];

const orderCampaigns: OrderCampaign[] = [
  {
    code: "MENDES-ENG-26",
    name: "Engenharia Civil — Turma 2026",
    deadline: "Pedidos até 31 de agosto de 2026",
    representative: "Lucas Pereira",
    image: showcaseCampaigns[0].image,
    initialPhase: "Em produção",
    orderCount: 82,
    pieceCount: 96,
    production: [
      { model: "Baby Look", color: "Azul Royal", sizes: { P: 8, M: 22, G: 6, GG: 4 }, total: 40 },
      { model: "Comum", color: "Preto", sizes: { P: 6, M: 18, G: 10, GG: 6 }, total: 40 },
      { model: "Oversized", color: "Branco", sizes: { P: 4, M: 8, G: 2, GG: 2 }, total: 16 },
    ],
    orders: [
      { id: "CM-2026-0151", customer: "Marina Azevedo", model: "Baby Look", color: "Azul Royal", colorHex: "#1468b8", size: "M", quantity: 2, payment: "Pago", delivery: "A entregar" },
      { id: "CM-2026-0150", customer: "João Pedro", model: "Comum", color: "Preto", colorHex: "#111315", size: "G", quantity: 1, payment: "Pago", delivery: "A entregar" },
      { id: "CM-2026-0148", customer: "Ana Clara", model: "Oversized", color: "Branco", colorHex: "#f1f2f0", size: "M", quantity: 1, payment: "Pago", delivery: "A entregar" },
      { id: "CM-2026-0147", customer: "Rafael Lima", model: "Comum", color: "Azul Marinho", colorHex: "#17365d", size: "GG", quantity: 2, payment: "Pago", delivery: "A entregar" },
      { id: "CM-2026-0146", customer: "Luiza Martins", model: "Baby Look", color: "Preto", colorHex: "#111315", size: "P", quantity: 1, payment: "Pago", delivery: "A entregar" },
      { id: "CM-2026-0145", customer: "Pedro Henrique", model: "Comum", color: "Bordô", colorHex: "#6f1833", size: "G", quantity: 1, payment: "Aguardando", delivery: "A entregar" },
    ],
  },
  {
    code: "MENDES-ENF-26",
    name: "Enfermagem — 8º período",
    deadline: "Pedidos encerrados em 18 de julho de 2026",
    representative: "Juliana Costa",
    image: showcaseCampaigns[1].image,
    initialPhase: "Pronta para entrega",
    orderCount: 54,
    pieceCount: 63,
    production: [
      { model: "Baby Look", color: "Branco", sizes: { P: 7, M: 12, G: 4, GG: 1 }, total: 24 },
      { model: "Comum", color: "Verde", sizes: { P: 5, M: 14, G: 8, GG: 4 }, total: 31 },
      { model: "Oversized", color: "Preto", sizes: { P: 1, M: 4, G: 2, GG: 1 }, total: 8 },
    ],
    orders: [
      { id: "CM-2026-0139", customer: "Juliana Reis", model: "Baby Look", color: "Branco", colorHex: "#f1f2f0", size: "M", quantity: 2, payment: "Pago", delivery: "A entregar" },
      { id: "CM-2026-0138", customer: "Pedro Henrique", model: "Comum", color: "Verde", colorHex: "#27704b", size: "G", quantity: 1, payment: "Pago", delivery: "Entregue" },
      { id: "CM-2026-0137", customer: "Larissa Melo", model: "Oversized", color: "Preto", colorHex: "#111315", size: "M", quantity: 1, payment: "Pago", delivery: "Ocorrência" },
    ],
  },
  {
    code: "MENDES-ADM-26",
    name: "Administração — Noturno",
    deadline: "Campanha concluída em 22 de julho de 2026",
    representative: "Rafael Lima",
    image: showcaseCampaigns[2].image,
    initialPhase: "Finalizada",
    orderCount: 41,
    pieceCount: 48,
    production: [
      { model: "Comum", color: "Branco", sizes: { P: 4, M: 12, G: 8, GG: 3 }, total: 27 },
      { model: "Oversized", color: "Preto", sizes: { P: 2, M: 8, G: 7, GG: 4 }, total: 21 },
    ],
    orders: [
      { id: "CM-2026-0128", customer: "Amanda Costa", model: "Comum", color: "Branco", colorHex: "#f1f2f0", size: "M", quantity: 1, payment: "Pago", delivery: "Entregue" },
      { id: "CM-2026-0127", customer: "Bruno Cardoso", model: "Oversized", color: "Preto", colorHex: "#111315", size: "G", quantity: 1, payment: "Pago", delivery: "Entregue" },
    ],
  },
  {
    code: "MENDES-ADS-26",
    name: "ADS — 2026.2",
    deadline: "Pedidos até 12 de setembro de 2026",
    representative: "Carla Sousa",
    image: privateCampaigns["MENDES-ADS-26"].image,
    initialPhase: "Recebendo pedidos",
    orderCount: 27,
    pieceCount: 31,
    production: [
      { model: "Comum", color: "Preto", sizes: { P: 2, M: 7, G: 4, GG: 1 }, total: 14 },
      { model: "Oversized", color: "Azul Royal", sizes: { P: 1, M: 6, G: 4, GG: 2 }, total: 13 },
      { model: "Baby Look", color: "Branco", sizes: { P: 1, M: 2, G: 1, GG: 0 }, total: 4 },
    ],
    orders: [
      { id: "CM-2026-0164", customer: "Camila Nunes", model: "Comum", color: "Preto", colorHex: "#111315", size: "M", quantity: 1, payment: "Pago", delivery: "A entregar" },
      { id: "CM-2026-0163", customer: "Diego Sousa", model: "Oversized", color: "Azul Royal", colorHex: "#1468b8", size: "G", quantity: 2, payment: "Aguardando", delivery: "A entregar" },
      { id: "CM-2026-0162", customer: "Renata Alves", model: "Baby Look", color: "Branco", colorHex: "#f1f2f0", size: "P", quantity: 1, payment: "Falhou", delivery: "A entregar" },
    ],
  },
];

export function AdminDashboard() {
  const [active, setActive] = useState<AdminSection>("overview");
  const activeLabel = active === "orders" ? "Campanhas em fluxo" : nav.find(([key]) => key === active)?.[2] ?? "Visão geral";

  function logout() {
    sessionStorage.removeItem(STAFF_SESSION_KEY);
    window.location.assign(buildRoute("acesso-camisaria"));
  }

  function navigate(section: AdminSection) {
    setActive(section);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand compact />
        <nav aria-label="Navegação do painel">
          {nav.map(([key, icon, label]) => (
            <button className={active === key ? "is-active" : ""} type="button" onClick={() => navigate(key)} key={key} aria-current={active === key ? "page" : undefined}>
              <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>
              <span className="admin-nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <button className="admin-logout" type="button" onClick={logout}><span className="material-symbols-rounded" aria-hidden="true">logout</span><span>Sair do painel</span></button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><small>Terça-feira, 4 de agosto de 2026</small><h1>{activeLabel}</h1></div>
          <div className="admin-user"><span className="material-symbols-rounded" aria-hidden="true">person</span><div><strong>Equipe Mendes</strong><small>Administrador</small></div></div>
        </header>

        {active === "overview" && <Overview onNavigate={navigate} />}
        {active === "campaigns" && <Campaigns />}
        {active === "orders" && <Orders />}
        {active === "products" && <Products />}
        {active === "reports" && <Reports />}
      </main>
    </div>
  );
}

function Overview({ onNavigate }: { onNavigate: (section: AdminSection) => void }) {
  const campaign = privateCampaigns["MENDES-ENG-26"];

  return (
    <div className="admin-content admin-overview">
      <section className="admin-page-intro">
        <div><span className="kicker">Operação de hoje</span><h2>Sua produção em um só lugar.</h2><p>Acompanhe o que vendeu, o que precisa produzir e o que já pode ser entregue.</p></div>
        <button className="primary-action" type="button" onClick={() => onNavigate("orders")}>Abrir pedidos<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
      </section>

      <section className="metric-row" aria-label="Resumo da operação">
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">campaign</span><div><span>Campanhas ativas</span><strong>3</strong><small>1 encerra nesta semana</small></div></article>
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">verified</span><div><span>Pedidos confirmados</span><strong>184</strong><small>Somente pagamentos validados</small></div></article>
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">inventory_2</span><div><span>Em produção</span><strong>96</strong><small>Peças nas campanhas atuais</small></div></article>
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">redeem</span><div><span>Prontos para retirada</span><strong>18</strong><small>12 entregues hoje</small></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="admin-campaign-focus">
          <div className="admin-campaign-focus-image"><img src={campaign.image} alt="Arte da campanha Engenharia Civil 2026" /><span>Campanha ativa</span></div>
          <div className="admin-campaign-focus-copy">
            <div className="panel-heading"><div><span className="kicker">Prazo mais próximo</span><h2>{campaign.title}</h2></div><button type="button" onClick={() => onNavigate("campaigns")}>Ver campanha</button></div>
            <p>{campaign.deadline} · Retirada com {campaign.representative}</p>
            <div className="campaign-progress-admin"><div><span>Meta de pedidos</span><strong>82 de 100</strong></div><progress max="100" value="82">82%</progress></div>
            <dl className="campaign-focus-stats"><div><dt>Confirmados</dt><dd>82</dd></div><div><dt>Em produção</dt><dd>46</dd></div><div><dt>Prontos</dt><dd>18</dd></div></dl>
          </div>
        </article>

        <article className="dashboard-panel production-summary">
          <div className="panel-heading"><div><span className="kicker">Produção</span><h2>Peças confirmadas</h2></div><span>82 no total</span></div>
          <div className="production-models">
            <div><div><strong>Comum</strong><span>42 peças</span></div><progress max="82" value="42">42</progress></div>
            <div><div><strong>Oversized</strong><span>25 peças</span></div><progress max="82" value="25">25</progress></div>
            <div><div><strong>Baby Look</strong><span>15 peças</span></div><progress max="82" value="15">15</progress></div>
          </div>
          <button className="admin-text-action" type="button" onClick={() => onNavigate("reports")}>Ver relatório de produção<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
        </article>

        <article className="dashboard-panel recent-orders">
          <div className="panel-heading"><div><span className="kicker">Últimos pedidos</span><h2>Movimentação recente</h2></div><button type="button" onClick={() => onNavigate("orders")}>Ver todos</button></div>
          <OrdersTable compact />
        </article>
      </section>
    </div>
  );
}

function OrdersTable({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`orders-table ${compact ? "is-compact" : ""}`}>
      <div className="orders-head"><span>Pedido</span><span>Cliente</span><span>Campanha</span><span>Modelo</span><span>Total</span><span>Status</span></div>
      {orders.map((order) => (
        <div className="order-row" key={order.id}>
          <strong>{order.id}</strong><span>{order.customer}</span><span>{order.campaign}</span><span>{order.model}</span><span>{order.total}</span><span className={`status status--${order.tone}`}>{order.status}</span>
        </div>
      ))}
    </div>
  );
}

function parseCampaignPrice(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function Campaigns() {
  const [campaignList, setCampaignList] = useState(campaigns);
  const [filter, setFilter] = useState<"Todas" | CampaignStatus>("Todas");
  const [creating, setCreating] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<AdminCampaign | null>(null);
  const [campaignName, setCampaignName] = useState("Análise e Desenvolvimento de Sistemas — 2026.2");
  const [representative, setRepresentative] = useState("Carla Sousa");
  const [representativePhone, setRepresentativePhone] = useState("(98) 98888-1234");
  const [deadline, setDeadline] = useState("2026-09-12");
  const [commonPrice, setCommonPrice] = useState("59,90");
  const [oversizedPrice, setOversizedPrice] = useState("69,90");
  const [babyLookPrice, setBabyLookPrice] = useState("62,90");
  const [artModel, setArtModel] = useState<ShirtModelName>("Comum");
  const [modelImages, setModelImages] = useState(defaultModelImages);
  const [artError, setArtError] = useState("");
  const [colorModel, setColorModel] = useState<ShirtModelName>("Comum");
  const [modelColors, setModelColors] = useState<Record<ShirtModelName, ShirtColorName[]>>(defaultModelColorNames);
  const [colorError, setColorError] = useState("");

  const filteredCampaigns = filter === "Todas" ? campaignList : campaignList.filter((campaign) => campaign.status === filter);

  function startCampaign() {
    setSelectedCampaign(null);
    setCreating(true);
    setArtError("");
    setColorError("");
    setColorModel("Comum");
    setModelColors(defaultModelColorNames());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleCampaignColor(model: ShirtModelName, color: ShirtColorName) {
    setModelColors((current) => {
      const selected = current[model];
      const next = selected.includes(color) ? selected.filter((item) => item !== color) : [...selected, color];
      return { ...current, [model]: next };
    });
    setColorError("");
  }

  function uploadArtwork(event: ChangeEvent<HTMLInputElement>, side: "front" | "back") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setArtError("Formato inválido. Envie uma imagem PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setArtError("A imagem ultrapassa 2 MB. Comprima o arquivo antes de enviar.");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setArtError("Não foi possível ler a imagem. Tente outro arquivo.");
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const preview = new Image();
      preview.onerror = () => setArtError("O arquivo não contém uma imagem válida.");
      preview.onload = () => {
        if (preview.width < 600 || preview.height < 800) {
          setArtError("A imagem precisa ter pelo menos 600 × 800 pixels.");
          return;
        }
        setModelImages((current) => ({ ...current, [artModel]: { ...current[artModel], [side]: reader.result as string } }));
        setArtError("");
      };
      preview.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const modelWithoutColor = shirtModels.find((item) => modelColors[item.name].length === 0);
    if (modelWithoutColor) {
      setColorModel(modelWithoutColor.name);
      setColorError(`Selecione pelo menos uma cor para o modelo ${modelWithoutColor.name}.`);
      return;
    }
    const colors = selectedCampaignColors(modelColors);
    const created: AdminCampaign = {
      name: campaignName,
      count: 0,
      status: "Ativa",
      deadline: "12 set",
      revenue: "R$ 0,00",
      code: "MENDES-ADS-26",
      representative,
      image: modelImages.Comum.front,
      prices: {
        Comum: parseCampaignPrice(commonPrice),
        Oversized: parseCampaignPrice(oversizedPrice),
        "Baby Look": parseCampaignPrice(babyLookPrice),
      },
      modelImages,
      colors,
    };
    const privateCampaign: PrivateCampaign = {
      code: created.code,
      title: created.name,
      subtitle: "Campanha exclusiva para os alunos da turma",
      image: created.image,
      prices: created.prices,
      deadline: formatCampaignDeadline(deadline),
      pickup: "Retirada com o representante da turma",
      representative: created.representative,
      modelImages: created.modelImages,
      colors: created.colors,
    };
    let saved: Record<string, PrivateCampaign> = {};
    try {
      saved = JSON.parse(localStorage.getItem(DEMO_CAMPAIGNS_STORAGE_KEY) ?? "{}") as Record<string, PrivateCampaign>;
    } catch {
      saved = {};
    }
    try {
      localStorage.setItem(DEMO_CAMPAIGNS_STORAGE_KEY, JSON.stringify({ ...saved, [created.code]: privateCampaign }));
    } catch {
      setArtError("As imagens ficaram grandes demais para esta demonstração. Comprima os arquivos e tente novamente.");
      return;
    }
    setCampaignList((current) => [created, ...current.filter((campaign) => campaign.code !== created.code)]);
    setCreating(false);
    setSelectedCampaign(created);
    setFilter("Todas");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="admin-content admin-campaigns-page">
      <div className="section-actions">
        <div><span className="kicker">Gestão</span><h2>Campanhas da camisaria</h2><p>Crie o acesso privado e acompanhe cada turma até a entrega.</p></div>
        <button className="primary-action" type="button" onClick={startCampaign}>Nova campanha<span className="material-symbols-rounded" aria-hidden="true">add</span></button>
      </div>

      {creating && (
        <section className="campaign-create-panel" aria-labelledby="campaign-create-title">
          <header><div><span className="kicker">Nova campanha</span><h3 id="campaign-create-title">Prepare o acesso da turma.</h3><p>Essas informações aparecem no link que será enviado ao representante.</p></div><button type="button" onClick={() => setCreating(false)} aria-label="Fechar criação"><span className="material-symbols-rounded" aria-hidden="true">close</span></button></header>
          <form onSubmit={createCampaign}>
            <label className="campaign-field campaign-field--wide"><span>Nome da campanha</span><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} minLength={5} required /></label>
            <label className="campaign-field"><span>Representante da turma</span><input value={representative} onChange={(event) => setRepresentative(event.target.value)} minLength={3} required /></label>
            <label className="campaign-field"><span>WhatsApp do representante</span><input type="tel" inputMode="tel" value={representativePhone} onChange={(event) => setRepresentativePhone(event.target.value)} minLength={10} required /></label>
            <label className="campaign-field"><span>Prazo final dos pedidos</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label>
            <fieldset className="campaign-model-pricing"><legend>Modelos e preços</legend><div>
              <article><span className="material-symbols-rounded" aria-hidden="true">check</span><strong>Comum</strong><small>Caimento tradicional</small><div className="campaign-price-field"><b>R$</b><input aria-label="Preço do modelo Comum" inputMode="decimal" value={commonPrice} onChange={(event) => setCommonPrice(event.target.value)} required /></div></article>
              <article><span className="material-symbols-rounded" aria-hidden="true">check</span><strong>Oversized</strong><small>Amplo e contemporâneo</small><div className="campaign-price-field"><b>R$</b><input aria-label="Preço do modelo Oversized" inputMode="decimal" value={oversizedPrice} onChange={(event) => setOversizedPrice(event.target.value)} required /></div></article>
              <article><span className="material-symbols-rounded" aria-hidden="true">check</span><strong>Baby Look</strong><small>Modelagem ajustada</small><div className="campaign-price-field"><b>R$</b><input aria-label="Preço do modelo Baby Look" inputMode="decimal" value={babyLookPrice} onChange={(event) => setBabyLookPrice(event.target.value)} required /></div></article>
            </div><small>A arte da campanha será fixa na frente e nas costas.</small></fieldset>
            <fieldset className="campaign-color-setup"><legend>Cores disponíveis por modelo</legend>
              <p>O aluno verá somente as cores liberadas aqui. Cada modelo precisa ter pelo menos uma opção.</p>
              <div className="campaign-color-tabs" role="group" aria-label="Modelo para configurar as cores">
                {shirtModels.map((item) => <button className={colorModel === item.name ? "is-active" : ""} type="button" aria-pressed={colorModel === item.name} onClick={() => { setColorModel(item.name); setColorError(""); }} key={item.name}>{item.name}<span>{modelColors[item.name].length}</span></button>)}
              </div>
              <div className="campaign-color-palette" aria-label={`Cores disponíveis para ${colorModel}`}>
                {shirtColors.map((color) => {
                  const checked = modelColors[colorModel].includes(color.name);
                  return <label className={checked ? "is-selected" : ""} key={color.name}><input type="checkbox" checked={checked} onChange={() => toggleCampaignColor(colorModel, color.name)} /><i style={{ backgroundColor: color.hex }} /><span>{color.name}</span><span className="material-symbols-rounded" aria-hidden="true">check</span></label>;
                })}
              </div>
              {colorError && <p className="campaign-color-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{colorError}</p>}
              <p className="campaign-color-summary"><span className="material-symbols-rounded" aria-hidden="true">palette</span><strong>{modelColors[colorModel].length}</strong> {modelColors[colorModel].length === 1 ? "cor liberada" : "cores liberadas"} para {colorModel}.</p>
            </fieldset>
            <fieldset className="campaign-artwork"><legend>Arte da campanha</legend>
              <div className="campaign-artwork-guidance"><span className="material-symbols-rounded" aria-hidden="true">info</span><div><strong>Como preparar as imagens</strong><p>Envie <b>PNG, JPG ou WEBP</b> com até <b>2 MB</b> por arquivo. Recomendamos <b>1200 × 1500 px</b>, proporção próxima de <b>4:5</b>, peça centralizada, fundo neutro ou transparente e sem cortes nas mangas. O mínimo aceito é <b>600 × 800 px</b>.</p></div></div>
              <div className="campaign-artwork-tabs" role="group" aria-label="Modelo para configurar a arte">{(["Comum", "Oversized", "Baby Look"] as ShirtModelName[]).map((item) => <button className={artModel === item ? "is-active" : ""} type="button" aria-pressed={artModel === item} onClick={() => { setArtModel(item); setArtError(""); }} key={item}>{item}<span className="material-symbols-rounded" aria-hidden="true">check_circle</span></button>)}</div>
              <div className="campaign-artwork-uploads">
                <label><span>Imagem de frente</span><div><img src={modelImages[artModel].front} alt={`Prévia de frente do modelo ${artModel}`} /><span className="material-symbols-rounded" aria-hidden="true">upload</span></div><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`Enviar imagem de frente do modelo ${artModel}`} onChange={(event) => uploadArtwork(event, "front")} /><small>Clique para selecionar ou trocar</small></label>
                <label><span>Imagem de costas</span><div><img src={modelImages[artModel].back} alt={`Prévia de costas do modelo ${artModel}`} /><span className="material-symbols-rounded" aria-hidden="true">upload</span></div><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`Enviar imagem de costas do modelo ${artModel}`} onChange={(event) => uploadArtwork(event, "back")} /><small>Clique para selecionar ou trocar</small></label>
              </div>
              {artError && <p className="campaign-artwork-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{artError}</p>}
              <p className="campaign-artwork-status"><span className="material-symbols-rounded" aria-hidden="true">verified</span>Frente e costas de <strong>{artModel}</strong> prontas para a campanha.</p>
            </fieldset>
            <div className="campaign-create-actions"><button className="outline-action" type="button" onClick={() => setCreating(false)}>Cancelar</button><button className="primary-action" type="submit">Criar campanha e gerar acesso<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button></div>
          </form>
        </section>
      )}

      {selectedCampaign && <CampaignSharePanel campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />}

      <section className="campaign-management" aria-label="Campanhas cadastradas">
        <div className="campaign-management-toolbar">
          <div className="campaign-filters" role="group" aria-label="Filtrar campanhas">
            {(["Todas", "Ativa", "Em produção", "Encerrada"] as const).map((status) => <button className={filter === status ? "is-active" : ""} type="button" onClick={() => setFilter(status)} key={status}>{status}<span>{status === "Todas" ? campaignList.length : campaignList.filter((campaign) => campaign.status === status).length}</span></button>)}
          </div>
          <span>{filteredCampaigns.length} {filteredCampaigns.length === 1 ? "campanha" : "campanhas"}</span>
        </div>

        <div className="campaign-admin-grid">
          {filteredCampaigns.map((campaign) => (
            <article className="campaign-admin-card" key={campaign.code}>
              <div className="campaign-admin-card-image"><img src={campaign.image} alt={`Arte da campanha ${campaign.name}`} /><span className={`campaign-state campaign-state--${campaign.status === "Ativa" ? "active" : campaign.status === "Em produção" ? "production" : "closed"}`}>{campaign.status}</span></div>
              <div className="campaign-admin-card-body"><small>{campaign.code}</small><h3>{campaign.name}</h3><p><span className="material-symbols-rounded" aria-hidden="true">person</span>{campaign.representative}</p><dl><div><dt>Pedidos</dt><dd>{campaign.count}</dd></div><div><dt>Vendas</dt><dd>{campaign.revenue}</dd></div><div><dt>Prazo</dt><dd>{campaign.deadline}</dd></div></dl><button type="button" onClick={() => { setCreating(false); setSelectedCampaign(campaign); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Ver e compartilhar<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CampaignSharePanel({ campaign, onClose }: { campaign: AdminCampaign; onClose: () => void }) {
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
      <header><div><span className="campaign-share-success"><span className="material-symbols-rounded" aria-hidden="true">check</span>Campanha pronta para divulgação</span><h3 id="campaign-share-title">{campaign.name}</h3><p>Envie uma destas opções somente ao representante da turma.</p></div><button type="button" onClick={onClose} aria-label="Fechar compartilhamento"><span className="material-symbols-rounded" aria-hidden="true">close</span></button></header>
      <div className="campaign-share-content">
        <div className="campaign-share-options">
          <article><span className="material-symbols-rounded" aria-hidden="true">password</span><div><small>Código da campanha</small><strong>{campaign.code}</strong></div><button type="button" onClick={() => copy(campaign.code, "code")}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></article>
          <article><span className="material-symbols-rounded" aria-hidden="true">link</span><div><small>Link privado</small><strong>{campaignLink}</strong></div><button type="button" onClick={() => copy(campaignLink, "link")}><span className="material-symbols-rounded" aria-hidden="true">content_copy</span>Copiar</button></article>
          <dl className="campaign-share-prices"><div><dt>Comum</dt><dd>{formatCampaignPrice(campaign.prices.Comum)}</dd></div><div><dt>Oversized</dt><dd>{formatCampaignPrice(campaign.prices.Oversized)}</dd></div><div><dt>Baby Look</dt><dd>{formatCampaignPrice(campaign.prices["Baby Look"])}</dd></div></dl>
          <dl className="campaign-share-colors">{shirtModels.map((model) => <div key={model.name}><dt>{model.name}</dt><dd>{campaign.colors[model.name].map((color) => color.name).join(", ")}</dd></div>)}</dl>
          <a href={campaignLink} target="_blank" rel="noreferrer">Abrir página da campanha<span className="material-symbols-rounded" aria-hidden="true">open_in_new</span></a>
          <p role="status" aria-live="polite">{copied === "code" ? "Código copiado." : copied === "link" ? "Link privado copiado." : "O acesso não aparece na página pública."}</p>
        </div>
        <figure><img src={qrUrl} alt={`QR Code de acesso à campanha ${campaign.name}`} /><figcaption><strong>QR Code da campanha</strong><span>O representante pode colocar este código nos materiais da turma.</span></figcaption></figure>
      </div>
    </section>
  );
}

function formatCampaignPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCampaignDeadline(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Prazo definido pela camisaria";
  return `Pedidos até ${parsed.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
}

function phaseTone(phase: CampaignPhase) {
  if (phase === "Recebendo pedidos") return "receiving";
  if (phase === "Pedidos encerrados") return "locked";
  if (phase === "Em produção") return "production";
  if (phase === "Pronta para entrega") return "ready";
  return "finished";
}

function nextPhaseLabel(phase: CampaignPhase) {
  if (phase === "Recebendo pedidos") return "Encerrar pedidos da campanha";
  if (phase === "Pedidos encerrados") return "Iniciar produção da campanha";
  if (phase === "Em produção") return "Avançar campanha para pronta para entrega";
  if (phase === "Pronta para entrega") return "Finalizar campanha";
  return "Campanha finalizada";
}

function previousPhaseLabel(phase: CampaignPhase) {
  if (phase === "Pedidos encerrados") return "Voltar para recebendo pedidos";
  if (phase === "Em produção") return "Voltar para pedidos encerrados";
  if (phase === "Pronta para entrega") return "Voltar para produção";
  if (phase === "Finalizada") return "Voltar para pronta para entrega";
  return "Etapa inicial";
}

function phaseSentence(phase: CampaignPhase) {
  if (phase === "Recebendo pedidos") return "A campanha está recebendo pedidos.";
  if (phase === "Pedidos encerrados") return "Os pedidos da campanha estão encerrados.";
  if (phase === "Em produção") return "A campanha está em produção.";
  if (phase === "Pronta para entrega") return "A campanha está pronta para entrega.";
  return "A campanha está finalizada.";
}

function deliveryForPhase(order: FlowOrder, phase: CampaignPhase) {
  if (order.payment !== "Pago") return "Aguardando pagamento";
  const phaseIndex = campaignPhases.findIndex((item) => item.label === phase);
  const readyIndex = campaignPhases.findIndex((item) => item.label === "Pronta para entrega");
  if (phaseIndex < readyIndex) return "Aguardando liberação";
  return order.delivery;
}

function Orders() {
  const [selectedCode, setSelectedCode] = useState(orderCampaigns[0].code);
  const [phases, setPhases] = useState<Record<string, CampaignPhase>>(() => Object.fromEntries(orderCampaigns.map((campaign) => [campaign.code, campaign.initialPhase])));
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"Todos" | PaymentStatus>("Todos");
  const [feedback, setFeedback] = useState("");
  const [confirmingReturn, setConfirmingReturn] = useState(false);

  const selectedCampaign = orderCampaigns.find((campaign) => campaign.code === selectedCode) ?? orderCampaigns[0];
  const selectedPhase = phases[selectedCampaign.code];
  const currentPhaseIndex = campaignPhases.findIndex((phase) => phase.label === selectedPhase);
  const filteredOrders = selectedCampaign.orders.filter((order) => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !query || [order.id, order.customer, order.model, order.color, order.size].some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query));
    const matchesPayment = paymentFilter === "Todos" || order.payment === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  function selectCampaign(code: string) {
    setSelectedCode(code);
    setSearch("");
    setPaymentFilter("Todos");
    setFeedback("");
    setConfirmingReturn(false);
  }

  function advanceCampaign() {
    const next = campaignPhases[currentPhaseIndex + 1]?.label;
    if (!next) return;
    setPhases((current) => ({ ...current, [selectedCampaign.code]: next }));
    setFeedback(`A campanha ${selectedCampaign.name} avançou para ${next}.`);
    setConfirmingReturn(false);
  }

  function returnCampaign() {
    const previous = campaignPhases[currentPhaseIndex - 1]?.label;
    if (!previous) return;
    setConfirmingReturn(true);
    setFeedback(`Confirme o retorno da campanha ${selectedCampaign.name} para ${previous}.`);
  }

  function confirmCampaignReturn() {
    const previous = campaignPhases[currentPhaseIndex - 1]?.label;
    if (!previous) return;
    setPhases((current) => ({ ...current, [selectedCampaign.code]: previous }));
    setFeedback(`A campanha ${selectedCampaign.name} voltou para ${previous}.`);
    setConfirmingReturn(false);
  }

  function cancelCampaignReturn() {
    setConfirmingReturn(false);
    setFeedback("Retorno cancelado. A fase da campanha não foi alterada.");
  }

  return (
    <div className="admin-content admin-orders-workspace">
      <section className="orders-flow-shell" aria-label="Pedidos organizados por campanha">
        <aside className="orders-campaign-rail">
          <header><span>Campanhas</span><small>{orderCampaigns.length} no fluxo</small></header>
          <div className="orders-campaign-list">
            {orderCampaigns.map((campaign) => {
              const campaignPhase = phases[campaign.code];
              return (
                <button className={campaign.code === selectedCampaign.code ? "is-selected" : ""} type="button" onClick={() => selectCampaign(campaign.code)} key={campaign.code} aria-pressed={campaign.code === selectedCampaign.code}>
                  <img src={campaign.image} alt="" />
                  <span className="orders-campaign-card-copy">
                    <strong>{campaign.name}</strong>
                    <em className={`campaign-flow-badge campaign-flow-badge--${phaseTone(campaignPhase)}`}>{campaignPhase}</em>
                    <span><b>{campaign.orderCount}</b> pedidos <b>{campaign.pieceCount}</b> peças</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button className="orders-all-campaigns" type="button" onClick={() => setFeedback("Todas as campanhas do painel já estão visíveis.")}>Ver todas as campanhas</button>
        </aside>

        <div className="orders-campaign-detail">
          <header className="orders-selected-header">
            <img src={selectedCampaign.image} alt={`Arte da campanha ${selectedCampaign.name}`} />
            <div><span>Campanha selecionada</span><h2>{selectedCampaign.name}</h2><p>{selectedCampaign.deadline} · Retirada com {selectedCampaign.representative}</p></div>
          </header>

          <ol className="campaign-phase-track" aria-label="Fase operacional da campanha">
            {campaignPhases.map((phase, index) => {
              const state = index < currentPhaseIndex ? "is-complete" : index === currentPhaseIndex ? "is-current" : "";
              return (
                <li className={state} key={phase.label} aria-current={index === currentPhaseIndex ? "step" : undefined}>
                  <span className="material-symbols-rounded" aria-hidden="true">{index < currentPhaseIndex ? "check" : phase.icon}</span>
                  <strong>{phase.label}</strong>
                </li>
              );
            })}
          </ol>

          <section className="campaign-phase-action" aria-label="Atualizar fase da campanha">
            <span className="material-symbols-rounded" aria-hidden="true">info</span>
            <div><strong>{phaseSentence(selectedPhase)}</strong><p>A fase é aplicada à campanha inteira e aos pedidos com pagamento confirmado.</p></div>
            <div className="campaign-phase-actions">
              {confirmingReturn ? (
                <>
                  <button className="campaign-phase-cancel" type="button" onClick={cancelCampaignReturn}>Cancelar</button>
                  <button className="campaign-phase-confirm" type="button" onClick={confirmCampaignReturn}><span className="material-symbols-rounded" aria-hidden="true">undo</span>Confirmar retorno</button>
                </>
              ) : (
                <>
                  <button className="campaign-phase-back" type="button" onClick={returnCampaign} disabled={currentPhaseIndex === 0}><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>{previousPhaseLabel(selectedPhase)}</button>
                  <button className="campaign-phase-next" type="button" onClick={advanceCampaign} disabled={selectedPhase === "Finalizada"}>{nextPhaseLabel(selectedPhase)}<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
                </>
              )}
            </div>
          </section>
          <p className="campaign-phase-feedback" role="status" aria-live="polite">{feedback}</p>

          <section className="campaign-production-table" aria-labelledby="production-summary-title">
            <header><div><h3 id="production-summary-title">Resumo de produção</h3><p>Somente peças de pedidos com pagamento confirmado.</p></div><strong>{selectedCampaign.pieceCount} peças no total</strong></header>
            <div className="campaign-production-scroll">
              <div className="campaign-production-head"><span>Modelo e cor</span>{productionSizes.map((size) => <span key={size}>{size}</span>)}<span>Total</span></div>
              {selectedCampaign.production.map((row) => (
                <div className="campaign-production-row" key={`${row.model}-${row.color}`}>
                  <span><strong>{row.model}</strong><small>{row.color}</small></span>
                  {productionSizes.map((size) => <span key={size}>{row.sizes[size] ?? 0}</span>)}<strong>{row.total}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="campaign-orders-table" aria-labelledby="campaign-orders-title">
            <header>
              <div><h3 id="campaign-orders-title">Pedidos da campanha</h3><p>{selectedCampaign.orderCount} pedidos registrados</p></div>
              <div className="campaign-order-filters">
                <label><span className="sr-only">Buscar pedido ou cliente</span><span className="material-symbols-rounded" aria-hidden="true">search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pedido ou cliente" /></label>
                <label><span className="sr-only">Filtrar por pagamento</span><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as "Todos" | PaymentStatus)}><option>Todos</option><option>Pago</option><option>Aguardando</option><option>Falhou</option><option>Reembolsado</option></select></label>
              </div>
            </header>
            <div className="campaign-orders-scroll">
              <div className="campaign-orders-head"><span>Pedido</span><span>Cliente</span><span>Modelo</span><span>Cor</span><span>Tam.</span><span>Qtd.</span><span>Pagamento</span><span>Entrega</span></div>
              {filteredOrders.map((order) => (
                <div className="campaign-orders-row" key={order.id}>
                  <strong>{order.id}</strong><span>{order.customer}</span><span>{order.model}</span><span className="campaign-order-color"><i style={{ backgroundColor: order.colorHex }} />{order.color}</span><span>{order.size}</span><span>{order.quantity}</span><span className={`order-payment order-payment--${order.payment.toLocaleLowerCase("pt-BR")}`}><i />{order.payment}</span><span className="order-delivery"><span className="material-symbols-rounded" aria-hidden="true">schedule</span>{deliveryForPhase(order, selectedPhase)}</span>
                </div>
              ))}
              {filteredOrders.length === 0 && <div className="campaign-orders-empty"><span className="material-symbols-rounded" aria-hidden="true">search_off</span><p>Nenhum pedido encontrado com esses filtros.</p></div>}
            </div>
            <footer><button type="button" disabled>Anterior</button><span>1–{filteredOrders.length} de {selectedCampaign.orderCount}</span><button type="button" disabled={filteredOrders.length === 0}>Próxima</button></footer>
          </section>
        </div>
      </section>
    </div>
  );
}

function Products() { return <div className="admin-content"><div className="section-actions"><div><span className="kicker">Catálogo</span><h2>Modelos e produtos</h2><p>Peças disponíveis para compor novas campanhas.</p></div><button className="primary-action" type="button">Adicionar produto<span className="material-symbols-rounded" aria-hidden="true">add</span></button></div><section className="simple-state"><span className="material-symbols-rounded" aria-hidden="true">checkroom</span><h3>3 modelos cadastrados</h3><p>Comum, Oversized e Baby Look estão disponíveis para novas campanhas.</p></section></div>; }

function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function reportStatusTone(status: string) {
  if (status === "Entregue") return "delivered";
  if (status === "A entregar") return "ready";
  if (status === "Ocorrência") return "issue";
  return "waiting";
}

function Reports() {
  const [report, setReport] = useState<"production" | "delivery">("production");
  const [campaignCode, setCampaignCode] = useState("Todas");
  const [deliveryFilter, setDeliveryFilter] = useState("Todos");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryOverrides, setDeliveryOverrides] = useState<Record<string, DeliveryStatus>>({});
  const [exportFeedback, setExportFeedback] = useState("");

  const reportCampaigns = campaignCode === "Todas" ? orderCampaigns : orderCampaigns.filter((campaign) => campaign.code === campaignCode);
  const productionRows = reportCampaigns.flatMap((campaign) => campaign.production.map((row) => ({ campaign, row })));
  const productionTotal = productionRows.reduce((total, item) => total + item.row.total, 0);
  const productionModels = new Set(productionRows.map((item) => item.row.model)).size;
  const productionColors = new Set(productionRows.map((item) => item.row.color)).size;
  const readyPhaseIndex = campaignPhases.findIndex((phase) => phase.label === "Pronta para entrega");
  const deliveryRows = reportCampaigns.flatMap((campaign) => campaign.orders.filter((order) => order.payment === "Pago").map((order) => {
    const key = `${campaign.code}-${order.id}`;
    const campaignPhaseIndex = campaignPhases.findIndex((phase) => phase.label === campaign.initialPhase);
    return { campaign, order, key, canDeliver: campaignPhaseIndex >= readyPhaseIndex, status: deliveryOverrides[key] ?? deliveryForPhase(order, campaign.initialPhase) };
  }));
  const normalizedSearch = deliverySearch.trim().toLocaleLowerCase("pt-BR");
  const filteredDeliveryRows = deliveryRows.filter(({ campaign, order, status }) => {
    const matchesStatus = deliveryFilter === "Todos" || status === deliveryFilter;
    const matchesSearch = !normalizedSearch || [campaign.name, order.id, order.customer, order.model, order.color, order.size].some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    return matchesStatus && matchesSearch;
  });
  const deliveryPending = deliveryRows.filter((item) => item.status === "A entregar").length;
  const deliveryCompleted = deliveryRows.filter((item) => item.status === "Entregue").length;

  function changeReport(next: "production" | "delivery") {
    setReport(next);
    setExportFeedback("");
  }

  function exportCurrentReport() {
    if (report === "production") {
      downloadCsv("relatorio-producao-camisaria.csv", ["Campanha", "Modelo", "Cor", ...productionSizes, "Total"], productionRows.map(({ campaign, row }) => [campaign.name, row.model, row.color, ...productionSizes.map((size) => row.sizes[size] ?? 0), row.total]));
      setExportFeedback("Relatório de produção exportado em CSV.");
      return;
    }
    downloadCsv("relatorio-entrega-representante.csv", ["Campanha", "Pedido", "Aluno", "Modelo", "Cor", "Tamanho", "Quantidade", "Entrega"], filteredDeliveryRows.map(({ campaign, order, status }) => [campaign.name, order.id, order.customer, order.model, order.color, order.size, order.quantity, status]));
    setExportFeedback("Checklist de entrega exportado em CSV.");
  }

  function markDelivered(key: string) {
    setDeliveryOverrides((current) => ({ ...current, [key]: "Entregue" }));
    setExportFeedback("Entrega confirmada no checklist desta sessão.");
  }

  return (
    <div className="admin-content reports-page">
      <section className="reports-intro">
        <div><span className="kicker">Operação</span><h2>Relatórios da camisaria</h2><p>Produção consolidada para a oficina e checklist nominal para o representante da turma.</p></div>
        <div className="reports-intro-actions"><button className="outline-action" type="button" onClick={() => window.print()}>Imprimir<span className="material-symbols-rounded" aria-hidden="true">print</span></button><button className="primary-action" type="button" onClick={exportCurrentReport}>Exportar CSV<span className="material-symbols-rounded" aria-hidden="true">download</span></button></div>
      </section>

      <div className="report-tabs" role="tablist" aria-label="Tipo de relatório">
        <button className={report === "production" ? "is-active" : ""} type="button" role="tab" aria-selected={report === "production"} onClick={() => changeReport("production")}><span className="material-symbols-rounded" aria-hidden="true">precision_manufacturing</span><span><strong>Produção</strong><small>Quantidades para fabricar</small></span></button>
        <button className={report === "delivery" ? "is-active" : ""} type="button" role="tab" aria-selected={report === "delivery"} onClick={() => changeReport("delivery")}><span className="material-symbols-rounded" aria-hidden="true">redeem</span><span><strong>Entrega</strong><small>Checklist do representante</small></span></button>
      </div>

      <section className="report-toolbar" aria-label="Filtros do relatório">
        <label><span>Campanha</span><select value={campaignCode} onChange={(event) => { setCampaignCode(event.target.value); setExportFeedback(""); }}><option value="Todas">Todas as campanhas</option>{orderCampaigns.map((campaign) => <option value={campaign.code} key={campaign.code}>{campaign.name}</option>)}</select></label>
        {report === "delivery" && <><label className="report-search"><span>Buscar aluno ou pedido</span><div><span className="material-symbols-rounded" aria-hidden="true">search</span><input value={deliverySearch} onChange={(event) => setDeliverySearch(event.target.value)} placeholder="Nome ou número do pedido" /></div></label><label><span>Situação da entrega</span><select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)}><option>Todos</option><option>Aguardando liberação</option><option>A entregar</option><option>Entregue</option><option>Ocorrência</option></select></label></>}
      </section>
      <p className="report-feedback" role="status" aria-live="polite">{exportFeedback}</p>

      {report === "production" ? (
        <>
          <section className="report-metrics" aria-label="Resumo da produção"><article><span>Peças confirmadas</span><strong>{productionTotal}</strong><small>Somente pedidos pagos</small></article><article><span>Campanhas</span><strong>{reportCampaigns.length}</strong><small>No filtro atual</small></article><article><span>Modelos</span><strong>{productionModels}</strong><small>Com produção confirmada</small></article><article><span>Cores</span><strong>{productionColors}</strong><small>Separadas para corte</small></article></section>
          <section className="production-report-card" aria-labelledby="production-report-title">
            <header><div><span className="material-symbols-rounded" aria-hidden="true">verified</span><div><h3 id="production-report-title">Ordem consolidada de produção</h3><p>Campanha → modelo → cor → tamanho. Pendentes, falhos e reembolsados ficam fora.</p></div></div><strong>{productionTotal} peças</strong></header>
            <div className="production-report-scroll"><div className="production-report-head"><span>Campanha</span><span>Modelo</span><span>Cor</span>{productionSizes.map((size) => <span key={size}>{size}</span>)}<span>Total</span></div>{productionRows.map(({ campaign, row }) => <div className="production-report-row" key={`${campaign.code}-${row.model}-${row.color}`}><span><strong>{campaign.name}</strong><small>{campaign.code}</small></span><span>{row.model}</span><span>{row.color}</span>{productionSizes.map((size) => <span key={size}>{row.sizes[size] ?? 0}</span>)}<strong>{row.total}</strong></div>)}</div>
          </section>
        </>
      ) : (
        <>
          <section className="report-metrics report-metrics--delivery" aria-label="Resumo da entrega"><article><span>Pedidos pagos</span><strong>{deliveryRows.length}</strong><small>Aptos ao fluxo de entrega</small></article><article><span>A entregar</span><strong>{deliveryPending}</strong><small>Disponíveis com representante</small></article><article><span>Entregues</span><strong>{deliveryCompleted}</strong><small>Confirmados no checklist</small></article><article><span>Exibidos</span><strong>{filteredDeliveryRows.length}</strong><small>Após busca e filtros</small></article></section>
          <section className="delivery-report-card" aria-labelledby="delivery-report-title"><header><div><h3 id="delivery-report-title">Checklist de entrega</h3><p>Somente pedidos com pagamento confirmado. A produção continua controlada pela campanha.</p></div><strong>{filteredDeliveryRows.length} pedidos</strong></header><div className="delivery-report-list"><div className="delivery-report-head"><span>Campanha</span><span>Pedido / aluno</span><span>Camisa</span><span>Qtd.</span><span>Entrega</span><span>Ação</span></div>{filteredDeliveryRows.map(({ campaign, order, key, canDeliver, status }) => <article className="delivery-report-row" key={key}><span data-label="Campanha"><strong>{campaign.name}</strong><small>{campaign.representative}</small></span><span data-label="Pedido / aluno"><strong>{order.id}</strong><small>{order.customer}</small></span><span data-label="Camisa"><strong>{order.model} · {order.color}</strong><small>Tamanho {order.size}</small></span><span data-label="Qtd."><strong>{order.quantity}</strong></span><span data-label="Entrega"><em className={`delivery-report-status delivery-report-status--${reportStatusTone(status)}`}>{status}</em></span><span data-label="Ação"><button type="button" onClick={() => markDelivered(key)} disabled={!canDeliver || status === "Entregue"}>{status === "Entregue" ? "Entregue" : canDeliver ? "Marcar entregue" : "Aguardar campanha"}</button></span></article>)}{filteredDeliveryRows.length === 0 && <div className="delivery-report-empty"><span className="material-symbols-rounded" aria-hidden="true">search_off</span><p>Nenhum pedido pago corresponde aos filtros.</p></div>}</div></section>
        </>
      )}
    </div>
  );
}
