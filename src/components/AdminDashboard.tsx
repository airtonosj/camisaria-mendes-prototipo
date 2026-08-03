import { useState } from "react";
import { buildRoute, STAFF_SESSION_KEY } from "../App";
import { Brand } from "./Brand";

const nav = [
  ["overview", "dashboard", "Visão geral"],
  ["campaigns", "campaign", "Campanhas"],
  ["orders", "receipt_long", "Pedidos"],
  ["products", "checkroom", "Produtos"],
  ["reports", "monitoring", "Relatórios"],
];

const campaigns = [
  ["Engenharia Civil 2026", "82", "Ativa"],
  ["Enfermagem — 8º período", "67", "Em produção"],
  ["Administração — Noturno", "51", "Encerrada"],
];

const orders = [
  ["#CM-2051", "Marina Azevedo", "Engenharia Civil", "R$ 119,80", "Confirmado"],
  ["#CM-2050", "João Pedro", "Enfermagem", "R$ 59,90", "Pago"],
  ["#CM-2049", "Ana Clara", "Administração", "R$ 179,70", "Produção"],
  ["#CM-2048", "Lucas Henrique", "Engenharia Civil", "R$ 59,90", "Pago"],
];

export function AdminDashboard() {
  const [active, setActive] = useState("overview");
  const activeLabel = nav.find(([key]) => key === active)?.[2] ?? "Visão geral";

  function logout() {
    sessionStorage.removeItem(STAFF_SESSION_KEY);
    window.location.assign(buildRoute("acesso-camisaria"));
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand compact />
        <nav aria-label="Navegação do painel">
          {nav.map(([key, icon, label]) => <button className={active === key ? "is-active" : ""} type="button" onClick={() => setActive(key)} key={key}><span className="material-symbols-rounded" aria-hidden="true">{icon}</span>{label}</button>)}
        </nav>
        <button className="admin-logout" type="button" onClick={logout}><span className="material-symbols-rounded" aria-hidden="true">logout</span>Sair do painel</button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar"><div><small>Segunda-feira, 3 de agosto</small><h1>{activeLabel}</h1></div><div className="admin-user"><span className="material-symbols-rounded" aria-hidden="true">person</span><div><strong>Equipe Mendes</strong><small>Administrador</small></div></div></header>

        {active === "overview" && <Overview />}
        {active === "campaigns" && <Campaigns />}
        {active === "orders" && <Orders />}
        {active === "products" && <Products />}
        {active === "reports" && <Reports />}
      </main>
    </div>
  );
}

function Overview() {
  return <div className="admin-content">
    <section className="metric-row">
      <article><span>Campanhas ativas</span><strong>12</strong><small>+2 neste mês</small></article>
      <article><span>Pedidos no mês</span><strong>346</strong><small>+18% no período</small></article>
      <article><span>Faturamento</span><strong>R$ 19.842</strong><small>Pagamentos confirmados</small></article>
      <article><span>Itens produzidos</span><strong>1.842</strong><small>Em 28 campanhas</small></article>
    </section>
    <section className="dashboard-grid">
      <article className="dashboard-panel performance"><div className="panel-heading"><div><span className="kicker">Desempenho</span><h2>Pedidos nos últimos 30 dias</h2></div><span>Julho — Agosto</span></div><div className="bar-chart" aria-label="Gráfico demonstrativo de pedidos">{[35,52,46,68,58,78,64,91,72,84,60,88].map((height, index) => <progress max="100" value={height} aria-label={`Período ${index + 1}: ${height} pedidos`} key={index} />)}</div></article>
      <article className="dashboard-panel campaign-status"><div className="panel-heading"><div><span className="kicker">Campanhas</span><h2>Status atual</h2></div></div>{campaigns.map(([name, count, status]) => <div className="status-row" key={name}><div><strong>{name}</strong><small>{status}</small></div><span>{count}</span></div>)}</article>
      <article className="dashboard-panel recent-orders"><div className="panel-heading"><div><span className="kicker">Últimos pedidos</span><h2>Movimentação recente</h2></div><button type="button">Ver todos</button></div><OrdersTable /></article>
    </section>
  </div>;
}

function OrdersTable() {
  return <div className="orders-table"><div className="orders-head"><span>Pedido</span><span>Cliente</span><span>Campanha</span><span>Total</span><span>Status</span></div>{orders.map((order) => <div className="order-row" key={order[0]}>{order.map((cell, index) => <span className={index === 4 ? `status status--${cell.toLowerCase().replace("ç", "c")}` : ""} key={cell}>{cell}</span>)}</div>)}</div>;
}

function Campaigns() {
  return <div className="admin-content"><div className="section-actions"><div><span className="kicker">Gestão</span><h2>Campanhas da camisaria</h2><p>Links, prazos e desempenho de cada turma.</p></div><button className="primary-action" type="button">Nova campanha<span className="material-symbols-rounded">add</span></button></div><section className="admin-list">{campaigns.map(([name,count,status]) => <article key={name}><div><strong>{name}</strong><small>Código privado ativo</small></div><span>{count} pedidos</span><em>{status}</em><button type="button">Abrir</button></article>)}</section></div>;
}

function Orders() { return <div className="admin-content"><div className="section-actions"><div><span className="kicker">Operação</span><h2>Todos os pedidos</h2><p>Acompanhe pagamento, produção e retirada.</p></div></div><section className="dashboard-panel full-table"><OrdersTable /></section></div>; }

function Products() { return <div className="admin-content"><div className="section-actions"><div><span className="kicker">Catálogo</span><h2>Modelos e produtos</h2><p>Peças disponíveis para compor novas campanhas.</p></div><button className="primary-action" type="button">Adicionar produto<span className="material-symbols-rounded">add</span></button></div><section className="simple-state"><span className="material-symbols-rounded">checkroom</span><h3>3 modelos cadastrados</h3><p>Comum, Oversized e Baby Look estão disponíveis para novas campanhas.</p></section></div>; }

function Reports() { return <div className="admin-content"><div className="section-actions"><div><span className="kicker">Resultados</span><h2>Relatórios</h2><p>Visão consolidada de vendas e produção.</p></div><button className="outline-action" type="button">Exportar relatório<span className="material-symbols-rounded">download</span></button></div><section className="simple-state"><span className="material-symbols-rounded">monitoring</span><h3>R$ 19.842,50 em vendas</h3><p>346 pedidos confirmados no período atual.</p></section></div>; }
