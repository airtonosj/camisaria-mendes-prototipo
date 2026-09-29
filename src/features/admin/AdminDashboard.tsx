import { lazy, Suspense, useEffect, useState } from "react";
import { fetchStaffSession, logoutStaff, staffToken } from "../../api";
import type { StaffUser } from "../../api";
import { buildRoute } from '../../navigation';
import { STAFF_SESSION_KEY } from './session';
import { Brand } from "../../components/Brand";
import type { AdminSection } from "./model";
const Reports = lazy(() => import('../reports/Reports').then(m => ({ default:m.Reports })));
import { usePanelData } from "./usePanelData";
const Account = lazy(() => import('../account/Account').then(m => ({ default:m.Account })));
const Overview = lazy(() => import('./Overview').then(m => ({ default:m.Overview })));
const Campaigns = lazy(() => import('../campaigns/Campaigns').then(m => ({ default:m.Campaigns })));
const Orders = lazy(() => import('../orders/Orders').then(m => ({ default:m.Orders })));
const Products = lazy(() => import('../campaigns/Products').then(m => ({ default:m.Products })));

export const nav: Array<[AdminSection, string, string]> = [
  ["overview", "dashboard", "Visão geral"],
  ["campaigns", "campaign", "Campanhas"],
  ["orders", "receipt_long", "Pedidos"],
  ["products", "checkroom", "Produtos"],
  ["reports", "monitoring", "Relatórios"],
  ["account", "manage_accounts", "Conta"],
];

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
          <Suspense fallback={<p role="status">Carregando seção...</p>}>
            {active === "overview" && <Overview data={data} onNavigate={navigate} />}
            {active === "campaigns" && <Campaigns data={data} />}
            {active === "orders" && <Orders data={data} />}
            {active === "products" && <Products />}
            {active === "reports" && <Reports data={data} />}
            {active === "account" && <Account user={user} onSaved={setUser} />}
          </Suspense>
        )}
      </main>
    </div>
  );
}
