import { AdminDashboard } from "./components/AdminDashboard";
import { CamisariaAccessPage } from "./components/CamisariaAccessPage";
import { CampaignAccessPage } from "./components/CampaignAccessPage";
import { LandingPage } from "./components/LandingPage";
import { OrderTrackingPage } from "./components/OrderTrackingPage";
import { PrivateCampaignPage } from "./components/PrivateCampaignPage";
import { DEMO_CAMPAIGNS_STORAGE_KEY, privateCampaigns, privateCodeAliases } from "./data";
import type { PrivateCampaign } from "./data";

export const TEST_STAFF_EMAIL = "admin@teste.com";
export const TEST_STAFF_PASSWORD = "123456";
export const STAFF_SESSION_KEY = "camisaria-mendes-demo-session";

function normalizeCode(value: string | null) {
  return value?.trim().toUpperCase().replace(/\s+/g, "-") ?? "";
}

export function resolveCampaign(code: string | null) {
  const normalized = normalizeCode(code);
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_CAMPAIGNS_STORAGE_KEY) ?? "{}") as Record<string, PrivateCampaign>;
    if (saved[normalized]) return saved[normalized];
  } catch {
    // The demonstration still works with the campaigns bundled in the project.
  }
  const canonicalCode = privateCodeAliases[normalized];
  return canonicalCode ? privateCampaigns[canonicalCode] : undefined;
}

export function buildRoute(route?: string, campaign?: string, order?: string, resume?: string) {
  const url = new URL("./", window.location.href);
  url.search = "";
  url.hash = "";
  if (route) url.searchParams.set("rota", route);
  if (campaign) url.searchParams.set("campanha", campaign);
  if (order) url.searchParams.set("pedido", order);
  if (resume) url.searchParams.set("retomar", resume);
  return url.toString();
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const campaignCode = params.get("campanha");
  const resumeOrder = params.get("retomar");
  const route = params.get("rota");
  const [campaign, setCampaign] = useState<PrivateCampaign | undefined>(() => resolveCampaign(campaignCode));
  const [campaignLookupFinished, setCampaignLookupFinished] = useState(!campaignCode);
  const path = window.location.pathname.replace(/\/+$/, "");
  const isStaffPath = path.endsWith("/acesso-camisaria");
  const isTrackingPath = path.endsWith("/acompanhar-pedido");

  useEffect(() => {
    if (!campaignCode) return;
    let active = true;
    fetchCampaignFromApi(campaignCode.trim().toUpperCase())
      .then((persistedCampaign) => {
        if (active) setCampaign(persistedCampaign);
      })
      .catch(() => {
        // O protótipo local permanece disponível quando a API ainda não está configurada.
      })
      .finally(() => {
        if (active) setCampaignLookupFinished(true);
      });
    return () => { active = false; };
  }, [campaignCode]);

  if (route === "admin") {
    const authenticated = sessionStorage.getItem(STAFF_SESSION_KEY) === "authenticated";
    return authenticated ? <AdminDashboard /> : <CamisariaAccessPage />;
  }

  if (route === "acesso-camisaria" || isStaffPath) {
    return <CamisariaAccessPage />;
  }

  if (route === "acesso-campanha") {
    return <CampaignAccessPage invalidCampaignCode={campaignCode ?? undefined} />;
  }

  if (route === "acompanhar-pedido" || isTrackingPath) {
    return <OrderTrackingPage />;
  }

  if (campaignCode && campaign) {
    return <PrivateCampaignPage campaign={campaign} resumePayment={resumeOrder ?? undefined} />;
  }

  if (campaignCode && !campaignLookupFinished) {
    return <main className="campaign-api-loading" aria-live="polite"><span className="material-symbols-rounded" aria-hidden="true">progress_activity</span><p>Carregando campanha...</p></main>;
  }

  if (campaignCode) {
    return <CampaignAccessPage invalidCampaignCode={campaignCode} />;
  }

  return <LandingPage />;
}
import { useEffect, useState } from "react";
import { fetchCampaignFromApi } from "./api";
