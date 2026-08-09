import campaignAdmin from "../assets/campaign-admin-v2.png";
import campaignEngineering from "../assets/campaign-engineering-v2.png";
import campaignLaw from "../assets/campaign-law.png";
import campaignNursing from "../assets/campaign-nursing-v2.png";
import shirtBabyLook from "../assets/shirt-babylook.png";
import shirtCommon from "../assets/shirt-common.png";
import shirtCommonBack from "../assets/shirt-common-back.png";
import shirtOversized from "../assets/shirt-oversized.png";
import shirtOversizedBack from "../assets/shirt-oversized-back.png";

export type ShowcaseCampaign = {
  course: string;
  group: string;
  image: string;
  quantity: string;
  description: string;
  year: string;
};

/** O corte da peça. Baby look não é corte: é um grupo de tamanhos. */
export type ShirtModelName = "Comum" | "Oversized";
/** O nome vem do cadastro da campanha: além das opções padrão, a camisaria pode criar outras. */
export type ShirtColorName = string;
export type ShirtColorOption = { name: ShirtColorName; hex: string };
export type SizeGroup = "standard" | "baby_look";
export type SizeCode = "PP" | "P" | "M" | "G" | "GG" | "XG" | "PPB" | "PB" | "MB" | "GB" | "GGB" | "XGB";

/** A arte da campanha. Uma imagem de frente serve para todos os cortes; costas é opcional. */
export type CampaignArt = { front: string; back: string | null };

export type PrivateCampaign = {
  code: string;
  title: string;
  subtitle: string;
  art: CampaignArt;
  prices: Record<ShirtModelName, number>;
  sizes: Record<ShirtModelName, SizeCode[]>;
  deadline: string;
  pickup: string;
  representative: string;
  /** Contato do representante para dúvidas e retirada. Vem da campanha no banco. */
  representativeWhatsapp?: string | null;
  colors?: Record<ShirtModelName, ShirtColorOption[]>;
  variantIds?: Partial<Record<ShirtModelName, Partial<Record<ShirtColorName, number>>>>;
};

export const shirtColors: ShirtColorOption[] = [
  { name: "Branco", hex: "#f3f3ef" },
  { name: "Preto", hex: "#111315" },
  { name: "Off-white", hex: "#e8e1d4" },
  { name: "Azul", hex: "#1468b8" },
  { name: "Bordô", hex: "#6f1833" },
];

export const sizeCatalog: Array<{ code: SizeCode; group: SizeGroup }> = [
  { code: "PP", group: "standard" },
  { code: "P", group: "standard" },
  { code: "M", group: "standard" },
  { code: "G", group: "standard" },
  { code: "GG", group: "standard" },
  { code: "XG", group: "standard" },
  { code: "PPB", group: "baby_look" },
  { code: "PB", group: "baby_look" },
  { code: "MB", group: "baby_look" },
  { code: "GB", group: "baby_look" },
  { code: "GGB", group: "baby_look" },
  { code: "XGB", group: "baby_look" },
];

export const sizeGroupLabels: Record<SizeGroup, string> = {
  standard: "Tradicional",
  baby_look: "Baby look",
};

export function sizesInGroup(group: SizeGroup) {
  return sizeCatalog.filter((size) => size.group === group).map((size) => size.code);
}

/** Ordena qualquer lista de tamanhos pela ordem do catálogo, não pela ordem de clique. */
export function sortSizes(codes: SizeCode[]) {
  const order = new Map(sizeCatalog.map((size, index) => [size.code, index]));
  return [...codes].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

function colorsByName(names: ShirtColorName[]) {
  return names.map((name) => shirtColors.find((color) => color.name === name) as ShirtColorOption);
}

export const defaultCampaignColors: Record<ShirtModelName, ShirtColorOption[]> = {
  Comum: colorsByName(["Branco", "Preto", "Off-white", "Azul", "Bordô"]),
  Oversized: colorsByName(["Branco", "Preto", "Off-white", "Azul", "Bordô"]),
};

/**
 * Pré-seleção usada ao criar campanha: o corte Comum recebe tradicional e baby look,
 * o Oversized fica só com os tradicionais. A camisaria só desmarca o que não vai vender.
 */
export const defaultCampaignSizes: Record<ShirtModelName, SizeCode[]> = {
  Comum: [...sizesInGroup("standard"), ...sizesInGroup("baby_look")],
  Oversized: sizesInGroup("standard"),
};

export const DEMO_CAMPAIGNS_STORAGE_KEY = "camisaria-mendes-demo-campaigns";

export const showcaseCampaigns: ShowcaseCampaign[] = [
  {
    course: "Engenharia Civil",
    group: "Turma de formandos",
    image: campaignEngineering,
    quantity: "82 camisas produzidas",
    description: "Estampa técnica com identidade forte para marcar a conclusão da turma.",
    year: "2026",
  },
  {
    course: "Enfermagem",
    group: "8º período",
    image: campaignNursing,
    quantity: "67 camisas produzidas",
    description: "Projeto exclusivo com símbolos da profissão e acabamento premium.",
    year: "2026",
  },
  {
    course: "Administração",
    group: "Turma noturna",
    image: campaignAdmin,
    quantity: "51 camisas produzidas",
    description: "Visual universitário pensado junto ao representante da turma.",
    year: "2026",
  },
  {
    course: "Direito",
    group: "Turma de formandos",
    image: campaignLaw,
    quantity: "74 camisas produzidas",
    description: "Identidade acadêmica clássica desenvolvida para a turma de Direito.",
    year: "2025",
  },
];

export const privateCampaigns: Record<string, PrivateCampaign> = {
  "MENDES-ENG-26": {
    code: "MENDES-ENG-26",
    title: "Engenharia Civil — Turma 2026",
    subtitle: "Campanha exclusiva para os alunos da turma",
    art: { front: campaignEngineering, back: null },
    prices: { Comum: 59.9, Oversized: 69.9 },
    sizes: {
      Comum: ["PP", "P", "M", "G", "GG", "PPB", "PB", "MB", "GB", "GGB"],
      Oversized: ["P", "M", "G", "GG", "XG"],
    },
    deadline: "Pedidos até 31 de agosto de 2026",
    pickup: "Retirada com o representante da turma",
    representative: "Lucas Pereira",
    colors: {
      Comum: colorsByName(["Preto", "Branco", "Azul"]),
      Oversized: colorsByName(["Branco", "Preto", "Azul"]),
    },
  },
  "MENDES-ADS-26": {
    code: "MENDES-ADS-26",
    title: "Análise e Desenvolvimento de Sistemas — 2026.2",
    subtitle: "Campanha exclusiva para os alunos da turma",
    art: { front: campaignAdmin, back: null },
    prices: { Comum: 59.9, Oversized: 69.9 },
    sizes: defaultCampaignSizes,
    deadline: "Pedidos até 12 de setembro de 2026",
    pickup: "Retirada com o representante da turma",
    representative: "Carla Sousa",
    colors: defaultCampaignColors,
  },
};

export const privateCodeAliases: Record<string, string> = {
  ENG26: "MENDES-ENG-26",
  "MENDES-ENG-26": "MENDES-ENG-26",
  ADS26: "MENDES-ADS-26",
  "MENDES-ADS-26": "MENDES-ADS-26",
};

/**
 * Composição decorativa do herói da landing. São três peças porque o arranjo fica melhor
 * assim — não é o catálogo de cortes. Baby look aparece aqui como peça fotografada,
 * enquanto no domínio continua sendo um grupo de tamanhos.
 */
export const heroShirts = [shirtCommon, shirtOversized, shirtBabyLook];

/** Fotos de catálogo, usadas só como reserva quando a campanha ainda não tem arte. */
export const shirtModels: Array<{ name: ShirtModelName; code: string; image: string; backImage: string; description: string }> = [
  { name: "Comum", code: "common", image: shirtCommon, backImage: shirtCommonBack, description: "Caimento tradicional" },
  { name: "Oversized", code: "oversized", image: shirtOversized, backImage: shirtOversizedBack, description: "Amplo e contemporâneo" },
];

export const whatsappCampaignUrl =
  "https://wa.me/559887780960?text=Ol%C3%A1%2C%20sou%20representante%20de%20turma%20e%20quero%20criar%20uma%20campanha%20com%20a%20Camisaria%20Mendes.";
