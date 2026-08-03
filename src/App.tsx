import { AdminDashboard } from "./components/AdminDashboard";
import { CamisariaAccessPage } from "./components/CamisariaAccessPage";
import { CampaignAccessPage } from "./components/CampaignAccessPage";
import { LandingPage } from "./components/LandingPage";
import { PrivateCampaignPage } from "./components/PrivateCampaignPage";
import { privateCampaigns, privateCodeAliases } from "./data";

export const TEST_STAFF_EMAIL = "admin@teste.com";
export const TEST_STAFF_PASSWORD = "123456";
export const STAFF_SESSION_KEY = "camisaria-mendes-demo-session";

function normalizeCode(value: string | null) {
  return value?.trim().toUpperCase().replace(/\s+/g, "-") ?? "";
}

export function resolveCampaign(code: string | null) {
  const normalized = normalizeCode(code);
  const canonicalCode = privateCodeAliases[normalized];
  return canonicalCode ? privateCampaigns[canonicalCode] : undefined;
}

export function buildRoute(route?: string, campaign?: string) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  if (route) url.searchParams.set("rota", route);
  if (campaign) url.searchParams.set("campanha", campaign);
  return url.toString();
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const campaignCode = params.get("campanha");
  const route = params.get("rota");
  const campaign = resolveCampaign(campaignCode);
  const path = window.location.pathname.replace(/\/+$/, "");
  const isStaffPath = path.endsWith("/acesso-camisaria");

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

  if (campaignCode && campaign) {
    return <PrivateCampaignPage campaign={campaign} />;
  }

  if (campaignCode) {
    return <CampaignAccessPage invalidCampaignCode={campaignCode} />;
  }

  return <LandingPage />;
}
