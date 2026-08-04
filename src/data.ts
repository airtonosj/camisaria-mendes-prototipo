import campaignAdmin from "../assets/campaign-admin-v2.png";
import campaignEngineering from "../assets/campaign-engineering-v2.png";
import campaignLaw from "../assets/campaign-law.png";
import campaignNursing from "../assets/campaign-nursing-v2.png";
import shirtBabyLook from "../assets/shirt-babylook.png";
import shirtBabyLookBack from "../assets/shirt-babylook-back.png";
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

export type PrivateCampaign = {
  code: string;
  title: string;
  subtitle: string;
  image: string;
  prices: Record<ShirtModelName, number>;
  deadline: string;
  pickup: string;
  representative: string;
  modelImages?: Record<ShirtModelName, { front: string; back: string }>;
  colors?: Record<ShirtModelName, ShirtColorOption[]>;
  variantIds?: Partial<Record<ShirtModelName, Partial<Record<ShirtColorName, number>>>>;
};

export type ShirtModelName = "Comum" | "Oversized" | "Baby Look";
export type ShirtColorName = "Preto" | "Branco" | "Azul Royal" | "Azul Marinho" | "Bordô" | "Verde";
export type ShirtColorOption = { name: ShirtColorName; hex: string };

export const shirtColors: ShirtColorOption[] = [
  { name: "Preto", hex: "#111315" },
  { name: "Branco", hex: "#f3f3ef" },
  { name: "Azul Royal", hex: "#1468b8" },
  { name: "Azul Marinho", hex: "#17365d" },
  { name: "Bordô", hex: "#6f1833" },
  { name: "Verde", hex: "#27704b" },
];

function colorsByName(names: ShirtColorName[]) {
  return names.map((name) => shirtColors.find((color) => color.name === name) as ShirtColorOption);
}

export const defaultCampaignColors: Record<ShirtModelName, ShirtColorOption[]> = {
  Comum: colorsByName(["Preto", "Branco", "Azul Royal", "Azul Marinho"]),
  Oversized: colorsByName(["Preto", "Branco", "Azul Royal"]),
  "Baby Look": colorsByName(["Preto", "Branco", "Azul Royal", "Bordô"]),
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
    image: campaignEngineering,
    prices: { Comum: 59.9, Oversized: 69.9, "Baby Look": 62.9 },
    deadline: "Pedidos até 31 de agosto de 2026",
    pickup: "Retirada com o representante da turma",
    representative: "Lucas Pereira",
    colors: {
      Comum: colorsByName(["Preto", "Branco", "Azul Marinho"]),
      Oversized: colorsByName(["Branco", "Preto", "Azul Royal"]),
      "Baby Look": colorsByName(["Azul Royal", "Preto", "Bordô"]),
    },
  },
  "MENDES-ADS-26": {
    code: "MENDES-ADS-26",
    title: "Análise e Desenvolvimento de Sistemas — 2026.2",
    subtitle: "Campanha exclusiva para os alunos da turma",
    image: campaignAdmin,
    prices: { Comum: 59.9, Oversized: 69.9, "Baby Look": 62.9 },
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

export const shirtModels: Array<{ name: ShirtModelName; image: string; backImage: string; description: string }> = [
  { name: "Comum", image: shirtCommon, backImage: shirtCommonBack, description: "Caimento tradicional" },
  { name: "Oversized", image: shirtOversized, backImage: shirtOversizedBack, description: "Amplo e contemporâneo" },
  { name: "Baby Look", image: shirtBabyLook, backImage: shirtBabyLookBack, description: "Modelagem ajustada" },
];

export const whatsappCampaignUrl =
  "https://wa.me/559887780960?text=Ol%C3%A1%2C%20sou%20representante%20de%20turma%20e%20quero%20criar%20uma%20campanha%20com%20a%20Camisaria%20Mendes.";
