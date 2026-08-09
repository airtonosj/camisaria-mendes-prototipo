import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, fetchCampaignFromApi } from "./api";
import { AdminDashboard } from "./components/AdminDashboard";
import { CamisariaAccessPage } from "./components/CamisariaAccessPage";
import { CampaignAccessPage } from "./components/CampaignAccessPage";
import { LandingPage } from "./components/LandingPage";
import { OrderTrackingPage } from "./components/OrderTrackingPage";
import { PrivateCampaignPage } from "./components/PrivateCampaignPage";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { DEMO_CAMPAIGNS_STORAGE_KEY, privateCampaigns, privateCodeAliases } from "./data";
import type { PrivateCampaign } from "./data";

/**
 * Dados de demonstração só existem em desenvolvimento. No site publicado, uma API fora
 * do ar precisa aparecer como erro: a equipe olhando pedidos inventados achando que são
 * reais é pior do que a tela não abrir.
 *
 * A conferência é sempre `import.meta.env.DEV` escrito à mão, e não uma constante
 * exportada, porque o Vite troca essa expressão por `false` na compilação — assim o
 * empacotador apaga o ramo inteiro e as campanhas, os pedidos e as credenciais
 * fictícias não chegam ao arquivo publicado.
 */
export const DEMO_STAFF_EMAIL = "admin@teste.com";
export const DEMO_STAFF_PASSWORD = "123456";
export const STAFF_SESSION_KEY = "camisaria-mendes-demo-session";

function normalizeCode(value: string | null) {
  return value?.trim().toUpperCase().replace(/\s+/g, "-") ?? "";
}

export function resolveCampaign(code: string | null) {
  if (!import.meta.env.DEV) return undefined;
  const normalized = normalizeCode(code);
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_CAMPAIGNS_STORAGE_KEY) ?? "{}") as Record<string, PrivateCampaign>;
    if (saved[normalized]) return saved[normalized];
  } catch {
    // A demonstração continua funcionando com as campanhas embutidas no projeto.
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

type CampaignLookup = "loading" | "ready" | "not_found" | "unavailable";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const campaignCode = params.get("campanha");
  const resumeOrder = params.get("retomar");
  const route = params.get("rota");
  const [campaign, setCampaign] = useState<PrivateCampaign | undefined>(() => resolveCampaign(campaignCode));
  const [lookup, setLookup] = useState<CampaignLookup>(campaignCode ? "loading" : "ready");
  const [attempt, setAttempt] = useState(0);
  const path = window.location.pathname.replace(/\/+$/, "");
  const isStaffPath = path.endsWith("/acesso-camisaria");
  const isTrackingPath = path.endsWith("/acompanhar-pedido");

  const retryCampaign = useCallback(() => {
    setLookup("loading");
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!campaignCode) return;
    let active = true;
    fetchCampaignFromApi(campaignCode.trim().toUpperCase())
      .then((persistedCampaign) => {
        if (!active) return;
        setCampaign(persistedCampaign);
        setLookup("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        const notFound = error instanceof ApiRequestError && error.status === 404;
        // Em desenvolvimento o protótipo local ainda abre; publicado, não.
        const localCampaign = resolveCampaign(campaignCode);
        if (!notFound && localCampaign) {
          setCampaign(localCampaign);
          setLookup("ready");
          return;
        }
        setLookup(notFound ? "not_found" : "unavailable");
      });
    return () => { active = false; };
  }, [campaignCode, attempt]);

  if (route === "admin") {
    // "authenticated" veio de login real na API; "demonstration" é o protótipo sem servidor.
    const session = sessionStorage.getItem(STAFF_SESSION_KEY);
    const demonstrating = import.meta.env.DEV && session === "demonstration";
    return session === "authenticated" || demonstrating ? <AdminDashboard /> : <CamisariaAccessPage />;
  }

  if (route === "acesso-camisaria" || isStaffPath) {
    return <CamisariaAccessPage />;
  }

  if (route === "redefinir-senha") {
    return <ResetPasswordPage token={params.get("token") ?? ""} />;
  }

  if (route === "acesso-campanha") {
    return <CampaignAccessPage invalidCampaignCode={campaignCode ?? undefined} />;
  }

  if (route === "acompanhar-pedido" || isTrackingPath) {
    return <OrderTrackingPage />;
  }

  if (campaignCode && campaign && lookup === "ready") {
    return <PrivateCampaignPage campaign={campaign} resumePayment={resumeOrder ?? undefined} />;
  }

  if (campaignCode && lookup === "loading") {
    return (
      <main className="campaign-api-loading" aria-live="polite">
        <span className="material-symbols-rounded" aria-hidden="true">progress_activity</span>
        <p>Carregando campanha...</p>
      </main>
    );
  }

  if (campaignCode && lookup === "unavailable") {
    return (
      <main className="campaign-api-loading campaign-api-error" aria-live="polite">
        <span className="material-symbols-rounded" aria-hidden="true">cloud_off</span>
        <p>Não foi possível carregar a campanha agora.</p>
        <small>O servidor da camisaria não respondeu. Confira sua conexão e tente novamente.</small>
        <button className="primary-action" type="button" onClick={retryCampaign}>
          Tentar novamente
          <span className="material-symbols-rounded" aria-hidden="true">refresh</span>
        </button>
      </main>
    );
  }

  if (campaignCode) {
    return <CampaignAccessPage invalidCampaignCode={campaignCode} />;
  }

  return <LandingPage />;
}
