import { useEffect } from "react";
import { shirtModels } from "../../data";
import { phaseMeta, paymentLabels, formatCents } from "./model";
import type { AdminSection, PanelData } from "./model";
import { groupProduction, productionFromOrders } from "../reports/Reports";

/* ------------------------------------------------------------------ */
/* Visão geral                                                         */
/* ------------------------------------------------------------------ */

export function Overview({ data, onNavigate }: { data: PanelData; onNavigate: (section: AdminSection) => void }) {
  const { campaigns, orders, loadOrders } = data;
  const receiving = campaigns.filter((campaign) => campaign.phase === "receiving_orders");
  const focus = receiving[0] ?? campaigns[0];

  const orderCampaignCode = focus?.code;
  useEffect(() => {
    if (orderCampaignCode) loadOrders(orderCampaignCode);
  }, [orderCampaignCode, loadOrders]);

  const focusOrders = focus ? orders[focus.code] ?? [] : [];
  const totalOrders = campaigns.reduce((total, campaign) => total + campaign.orderCount, 0);
  const paidTotal = campaigns.reduce((total, campaign) => total + campaign.paidTotalCents, 0);
  const inProduction = campaigns.filter((campaign) => campaign.phase === "production").length;
  const readyCampaigns = campaigns.filter((campaign) => campaign.phase === "ready_for_delivery").length;

  const focusProduction = focus ? groupProduction(productionFromOrders([focus], orders)) : [];
  const focusPieces = focusProduction.reduce((total, group) => total + group.total, 0);
  const byModel = shirtModels.map((model) => ({
    name: model.name,
    pieces: focusProduction.filter((group) => group.modelName === model.name).reduce((total, group) => total + group.total, 0),
  }));

  if (!focus) {
    return (
      <div className="admin-content">
        <section className="simple-state">
          <span className="material-symbols-rounded" aria-hidden="true">campaign</span>
          <h3>Nenhuma campanha cadastrada</h3>
          <p>Crie a primeira campanha para gerar o acesso da turma.</p>
          <button className="primary-action" type="button" onClick={() => onNavigate("campaigns")}>Nova campanha<span className="material-symbols-rounded" aria-hidden="true">add</span></button>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-content admin-overview">
      <section className="admin-page-intro">
        <div><span className="kicker">Operação de hoje</span><h2>Sua produção em um só lugar.</h2><p>Acompanhe o que vendeu, o que precisa produzir e o que já pode ser entregue.</p></div>
        <button className="primary-action" type="button" onClick={() => onNavigate("orders")}>Abrir pedidos<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
      </section>

      <section className="metric-row" aria-label="Resumo da operação">
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">campaign</span><div><span>Recebendo pedidos</span><strong>{receiving.length}</strong><small>{campaigns.length} campanhas no total</small></div></article>
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">verified</span><div><span>Pedidos registrados</span><strong>{totalOrders}</strong><small>{formatCents(paidTotal)} confirmados</small></div></article>
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">inventory_2</span><div><span>Campanhas em produção</span><strong>{inProduction}</strong><small>Fase aplicada à turma inteira</small></div></article>
        <article><span className="metric-icon material-symbols-rounded" aria-hidden="true">redeem</span><div><span>Prontas para entrega</span><strong>{readyCampaigns}</strong><small>Liberadas ao representante</small></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="admin-campaign-focus">
          <div className="admin-campaign-focus-image"><img src={focus.artFront} alt={`Arte da campanha ${focus.title}`} /><span>{phaseMeta[focus.phase].label}</span></div>
          <div className="admin-campaign-focus-copy">
            <div className="panel-heading"><div><span className="kicker">Prazo mais próximo</span><h2>{focus.title}</h2></div><button type="button" onClick={() => onNavigate("campaigns")}>Ver campanha</button></div>
            <p>{focus.deadlineLabel} · Retirada com {focus.representative}</p>
            <dl className="campaign-focus-stats"><div><dt>Pedidos</dt><dd>{focus.orderCount}</dd></div><div><dt>Peças pagas</dt><dd>{focusPieces}</dd></div><div><dt>Vendas</dt><dd>{formatCents(focus.paidTotalCents)}</dd></div></dl>
          </div>
        </article>

        <article className="dashboard-panel production-summary">
          <div className="panel-heading"><div><span className="kicker">Produção</span><h2>Peças confirmadas</h2></div><span>{focusPieces} no total</span></div>
          <div className="production-models">
            {byModel.map((model) => (
              <div key={model.name}>
                <div><strong>{model.name}</strong><span>{model.pieces} {model.pieces === 1 ? "peça" : "peças"}</span></div>
                <progress max={Math.max(focusPieces, 1)} value={model.pieces}>{model.pieces}</progress>
              </div>
            ))}
          </div>
          <button className="admin-text-action" type="button" onClick={() => onNavigate("reports")}>Ver relatório de produção<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
        </article>

        <article className="dashboard-panel recent-orders">
          <div className="panel-heading"><div><span className="kicker">Últimos pedidos</span><h2>{focus.title}</h2></div><button type="button" onClick={() => onNavigate("orders")}>Ver todos</button></div>
          <div className="orders-table is-compact">
            <div className="orders-head"><span>Pedido</span><span>Cliente</span><span>Peça</span><span>Total</span><span>Pagamento</span></div>
            {focusOrders.slice(0, 4).map((order) => (
              <div className="order-row" key={order.number}>
                <strong>#{order.number}</strong><span>{order.customer}</span><span>{order.model} · {order.size}</span><span>{formatCents(order.totalCents)}</span>
                <span className={`status status--${order.status === "cancelled" ? "cancelled" : order.paymentStatus}`}>{order.status === "cancelled" ? "Cancelado" : paymentLabels[order.paymentStatus]}</span>
              </div>
            ))}
            {focusOrders.length === 0 && <p className="orders-table-empty">Nenhum pedido registrado nesta campanha.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}
