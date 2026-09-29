import { showcaseCampaigns } from "../../data";
import type { PanelCampaign, PanelOrder } from "./model";

/* ------------------------------------------------------------------ */
/* Dados de demonstração, no mesmo formato que a API devolve            */
/* ------------------------------------------------------------------ */

export const demoCampaigns: PanelCampaign[] = [
  { code: "MENDES-ENG-26", title: "Engenharia Civil — Turma 2026", subtitle: "Ficha de corte e confecção", phase: "production", deadlineLabel: "Pedidos até 31 de agosto de 2026", representative: "Lucas Pereira", artFront: showcaseCampaigns[0].image, orderCount: 6, paidTotalCents: 491180, canDelete: false },
  { code: "MENDES-ENF-26", title: "Enfermagem — 8º período", subtitle: "Ficha de corte e confecção", phase: "ready_for_delivery", deadlineLabel: "Pedidos encerrados em 18 de julho de 2026", representative: "Juliana Costa", artFront: showcaseCampaigns[1].image, orderCount: 3, paidTotalCents: 401330, canDelete: false },
  { code: "MENDES-ADM-26", title: "Administração — Noturno", subtitle: "Ficha de corte e confecção", phase: "completed", deadlineLabel: "Campanha concluída em 22 de julho de 2026", representative: "Rafael Lima", artFront: showcaseCampaigns[2].image, orderCount: 2, paidTotalCents: 305490, canDelete: false },
  { code: "MENDES-ADS-26", title: "Análise e Desenvolvimento de Sistemas — 2026.2", subtitle: "Ficha de corte e confecção", phase: "receiving_orders", deadlineLabel: "Pedidos até 12 de setembro de 2026", representative: "Carla Sousa", artFront: showcaseCampaigns[3].image, orderCount: 3, paidTotalCents: 59900, canDelete: false },
];

export const demoOrders: Record<string, PanelOrder[]> = {
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
