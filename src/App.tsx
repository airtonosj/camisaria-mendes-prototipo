import { CamisariaAccessPage } from "./components/CamisariaAccessPage";
import { LandingPage } from "./components/LandingPage";
import { PrivateCampaignPage } from "./components/PrivateCampaignPage";
import { privateCampaigns, privateCodeAliases } from "./data";

function normalizeCode(value: string | null) {
  return value?.trim().toUpperCase().replace(/\s+/g, "-") ?? "";
}

export function resolveCampaign(code: string | null) {
  const normalized = normalizeCode(code);
  const canonicalCode = privateCodeAliases[normalized];
  return canonicalCode ? privateCampaigns[canonicalCode] : undefined;
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const campaignCode = params.get("campanha");
  const campaign = resolveCampaign(campaignCode);
  const isCamisariaAccess =
    params.get("rota") === "acesso-camisaria" ||
    window.location.pathname.replace(/\/+$/, "").endsWith("/acesso-camisaria");

  if (isCamisariaAccess) {
    return <CamisariaAccessPage />;
  }

  if (campaignCode && campaign) {
    return <PrivateCampaignPage campaign={campaign} />;
  }

  return <LandingPage invalidCampaignCode={campaignCode ?? undefined} />;
}
