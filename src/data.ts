import campaignAdmin from "../assets/campaign-admin.png";
import campaignEngineering from "../assets/campaign-engineering.png";
import campaignNursing from "../assets/campaign-nursing.png";
import shirtBabyLook from "../assets/shirt-babylook.png";
import shirtCommon from "../assets/shirt-common.png";
import shirtOversized from "../assets/shirt-oversized.png";

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
  price: number;
  deadline: string;
  pickup: string;
  representative: string;
};

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
];

export const privateCampaigns: Record<string, PrivateCampaign> = {
  "MENDES-ENG-26": {
    code: "MENDES-ENG-26",
    title: "Engenharia Civil — Turma 2026",
    subtitle: "Campanha exclusiva para os alunos da turma",
    image: campaignEngineering,
    price: 59.9,
    deadline: "Pedidos até 31 de agosto de 2026",
    pickup: "Retirada com o representante da turma",
    representative: "Lucas Pereira",
  },
};

export const privateCodeAliases: Record<string, string> = {
  ENG26: "MENDES-ENG-26",
  "MENDES-ENG-26": "MENDES-ENG-26",
};

export const shirtModels = [
  { name: "Comum", image: shirtCommon, description: "Caimento tradicional" },
  { name: "Oversized", image: shirtOversized, description: "Amplo e contemporâneo" },
  { name: "Baby Look", image: shirtBabyLook, description: "Modelagem ajustada" },
];

export const whatsappCampaignUrl =
  "https://wa.me/559887780960?text=Ol%C3%A1%2C%20sou%20representante%20de%20turma%20e%20quero%20criar%20uma%20campanha%20com%20a%20Camisaria%20Mendes.";
