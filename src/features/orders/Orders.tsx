import { EmailHistoryDialog } from "../../components/EmailHistoryDialog";
import { useEffect, useRef, useState } from "react";
import { PickupEmailDialog } from "../../components/PickupEmailDialog";
import { cancelOrderInApi, changeCampaignPhaseInApi, registerOrderRefundInApi } from "../../api";
import { paymentMethodLabel } from "../../payment";
import { formattedWhatsapp } from "../../phone";
import type { CampaignPhaseCode, PaymentStatusCode } from "../../api";
import { phaseOrder, phaseMeta, paymentLabels, deliveryLabels, effectiveDelivery, panelOrderItems, formatCents, formatOrderDateTime, errorMessage } from "../admin/model";
import type { PanelData } from "../admin/model";

/* ------------------------------------------------------------------ */
/* Pedidos por campanha                                                */
/* ------------------------------------------------------------------ */

export function Orders({ data }: { data: PanelData }) {
  const [pickupOpen, setPickupOpen] = useState(false);
  const [emailHistoryOpen, setEmailHistoryOpen] = useState(false);
  const { campaigns, orders, mode, loadOrders, reload } = data;
  const [selectedCode, setSelectedCode] = useState(campaigns[0]?.code ?? "");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentStatusCode>("paid");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<"all" | CampaignPhaseCode>("all");
  const [campaignMenuOpen, setCampaignMenuOpen] = useState(true);
  const pickerSearchRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [cancellingOrder, setCancellingOrder] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [refundingOrder, setRefundingOrder] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundReceipt, setRefundReceipt] = useState("");
  const [viewingOrderNumber, setViewingOrderNumber] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = campaigns.find((campaign) => campaign.code === selectedCode) ?? campaigns[0];

  const orderCampaignCode = selected?.code;
  useEffect(() => {
    if (orderCampaignCode) loadOrders(orderCampaignCode);
  }, [orderCampaignCode, loadOrders]);

  const campaignOrders = selected ? orders[selected.code] ?? [] : [];
  const viewingOrder = campaignOrders.find((order) => order.number === viewingOrderNumber);
  const currentPhaseIndex = selected ? phaseOrder.indexOf(selected.phase) : 0;
  const paidOrders = campaignOrders.filter((order) => order.paymentStatus === "paid" && order.status !== "cancelled");
  const paidCouponOrders = paidOrders.filter((order) => Boolean(order.couponCode?.trim())).length;
  const paidPieces = new Map<string, number>();
  for (const order of paidOrders) for (const item of panelOrderItems(order)) {
    paidPieces.set(item.model, (paidPieces.get(item.model) ?? 0) + item.quantity);
  }
  const pieceCount = paidOrders.reduce((total, order) => total + order.quantity, 0);
  const ordersLoaded = mode !== "live" || Boolean(selected && orders[selected.code]);
  const filteredCampaigns = campaigns.filter((campaign) => {
    const query = campaignSearch.trim().toLocaleLowerCase("pt-BR");
    return (!query || `${campaign.title} ${campaign.code}`.toLocaleLowerCase("pt-BR").includes(query))
      && (phaseFilter === "all" || campaign.phase === phaseFilter);
  });

  const filteredOrders = campaignOrders.filter((order) => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !query || [order.number, order.customer, order.whatsapp, ...panelOrderItems(order).flatMap((item) => [item.model, item.color, item.size])].some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query))
      || (query.replace(/\D/g, "").length >= 3 && order.whatsapp.replace(/\D/g, "").includes(query.replace(/\D/g, "")));
    const matchesPayment = paymentFilter === "all" || order.paymentStatus === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  function selectCampaign(code: string) {
    setPickupOpen(false);
    setEmailHistoryOpen(false);
    setSelectedCode(code);
    setSearch("");
    setPaymentFilter("paid");

    setFeedback("");
    setConfirmingReturn(false);
    setReturnReason("");
    setCancellingOrder("");
    setCancellationReason("");
    setRefundingOrder("");
    setRefundReference("");
    setRefundReason("");
    setRefundReceipt("");
    setViewingOrderNumber("");
  }

  useEffect(() => {
    if (!viewingOrderNumber) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewingOrderNumber("");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [viewingOrderNumber]);

  async function movePhase(target: CampaignPhaseCode, reason?: string) {
    if (!selected) return;
    if (mode !== "live") {
      setFeedback("Sem sessão no servidor, a fase não pode ser alterada.");
      return;
    }
    setBusy(true);
    try {
      await changeCampaignPhaseInApi(selected.code, target, reason);
      setFeedback(`Fase atualizada: ${phaseMeta[target].label}.`);
      setConfirmingReturn(false);
      setReturnReason("");
      reload();
      loadOrders(selected.code);
    } catch (phaseError) {
      setFeedback(errorMessage(phaseError, "Não foi possível alterar a fase."));
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder(orderNumber: string) {
    if (!selected) return;
    if (mode !== "live") {
      setFeedback("Sem sessão no servidor, o pedido não pode ser cancelado.");
      return;
    }
    const reason = cancellationReason.trim();
    if (reason.length < 3) {
      setFeedback("Informe um motivo com pelo menos 3 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await cancelOrderInApi(orderNumber, reason);
      setFeedback(`Pedido ${orderNumber} cancelado. Ele foi retirado da produção e da entrega.`);
      setCancellingOrder("");
      setCancellationReason("");
      reload();
      loadOrders(selected.code);
    } catch (cancellationError) {
      setFeedback(errorMessage(cancellationError, "Não foi possível cancelar o pedido."));
    } finally {
      setBusy(false);
    }
  }

  async function registerRefund(orderNumber: string) {
    if (!selected) return;
    if (mode !== "live") {
      setFeedback("Sem sessão no servidor, o reembolso não pode ser registrado.");
      return;
    }
    const order = campaignOrders.find((candidate) => candidate.number === orderNumber);
    if (!order) return;
    const providerRefundId = refundReference.trim();
    const reason = refundReason.trim();
    if (providerRefundId.length < 3 || reason.length < 3) {
      setFeedback("Informe a referência da InfinitePay e o motivo do reembolso.");
      return;
    }
    setBusy(true);
    try {
      await registerOrderRefundInApi({
        orderNumber,
        amountCents: order.totalCents,
        providerRefundId,
        reason,
        receiptUrl: refundReceipt.trim() || undefined,
      });
      setFeedback(`Reembolso integral de ${formatCents(order.totalCents)} registrado; o pedido ${orderNumber} foi cancelado.`);
      setRefundingOrder("");
      setRefundReference("");
      setRefundReason("");
      setRefundReceipt("");
      reload();
      loadOrders(selected.code);
    } catch (refundError) {
      setFeedback(errorMessage(refundError, "Não foi possível registrar o reembolso."));
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <div className="admin-content">
        <section className="simple-state">
          <span className="material-symbols-rounded" aria-hidden="true">receipt_long</span>
          <h3>Nenhuma campanha em fluxo</h3>
          <p>Crie uma campanha para acompanhar os pedidos por aqui.</p>
        </section>
      </div>
    );
  }

  const nextPhase = phaseOrder[currentPhaseIndex + 1];
  const previousPhase = phaseOrder[currentPhaseIndex - 1];

  return (
    <div className="admin-content admin-orders-workspace">
      <section className="orders-flow-shell" aria-label="Pedidos organizados por campanha">
        <aside className={'orders-campaign-rail orders-campaign-rail--list' + (campaignMenuOpen ? '' : ' is-collapsed')} aria-label="Campanhas">
          <header className="orders-campaign-menu-header"><button className="orders-picker-launch" type="button" title={campaignMenuOpen ? 'Ocultar campanhas' : 'Mostrar campanhas'} aria-label={campaignMenuOpen ? 'Ocultar campanhas' : 'Mostrar campanhas'} aria-expanded={campaignMenuOpen} aria-controls="orders-campaign-menu" onClick={() => setCampaignMenuOpen(!campaignMenuOpen)}><span className="material-symbols-rounded" aria-hidden="true">menu</span></button><h3>Campanhas</h3></header>
          <div id="orders-campaign-menu" hidden={!campaignMenuOpen}>
            <div className="orders-picker-filters">
              <label><input aria-label="Pesquisar campanha" ref={pickerSearchRef} value={campaignSearch} onChange={(event) => setCampaignSearch(event.target.value)} placeholder="Pesquisar nome ou código" /></label>
              <label><select aria-label="Filtrar por fase" value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value as 'all' | CampaignPhaseCode)}><option value="all">Todas as fases</option>{phaseOrder.map((phase) => <option key={phase} value={phase}>{phaseMeta[phase].label}</option>)}</select></label>
            </div>
            <p className="orders-picker-count" role="status">{filteredCampaigns.length} de {campaigns.length} campanhas</p>
            <div className="orders-campaign-list">
              {filteredCampaigns.map((campaign) => <button className={campaign.code === selected.code ? 'is-selected' : ''} type="button" onClick={() => selectCampaign(campaign.code)} key={campaign.code} aria-pressed={campaign.code === selected.code}>
                <img src={campaign.artFront} alt={"Imagem da campanha " + campaign.title} /><span className="orders-campaign-card-copy"><strong>{campaign.title}</strong><em className={'campaign-flow-badge campaign-flow-badge--' + phaseMeta[campaign.phase].tone}>{phaseMeta[campaign.phase].label}</em><span><b>{campaign.orderCount}</b> pedidos <b>{formatCents(campaign.paidTotalCents)}</b> pagos</span></span>
              </button>)}
              {filteredCampaigns.length === 0 && <p className="orders-picker-empty">Nenhuma campanha encontrada com esses filtros.</p>}
            </div>
          </div>
        </aside>

        <div className="orders-campaign-detail">
          <header className="orders-selected-header">
            <img src={selected.artFront} alt={`Arte da campanha ${selected.title}`} />
            <div><span>Campanha selecionada</span><h2>{selected.title}</h2><p>Retirada com {selected.representative}</p></div>
            <div className="orders-email-actions">
              <button className="pickup-launch" type="button" title="Histórico de e-mails" aria-label="Histórico de e-mails" disabled={mode !== 'live'} onClick={() => setEmailHistoryOpen(true)}><span className="material-symbols-rounded" aria-hidden="true">history</span></button>
              {selected.phase === 'ready_for_delivery' && <button className="pickup-launch" type="button" title="Avisar compradores" aria-label="Avisar compradores" disabled={mode !== 'live'} onClick={() => setPickupOpen(true)}><span className="material-symbols-rounded" aria-hidden="true">mail</span></button>}
            </div>
          </header>
          <div className="orders-campaign-summary" aria-label="Informações gerais da campanha">
            <article><span>Prazo</span><strong>Início: {selected.createdAt ? new Date(selected.createdAt).toLocaleDateString("pt-BR") : "Não informado"}</strong><small>Fim: {selected.deadlineAt ? new Date(selected.deadlineAt).toLocaleDateString("pt-BR") : selected.deadlineLabel}</small><small>Entrega não definida</small></article>
            <article><span>Preços base</span>{selected.basePrices?.length ? selected.basePrices.map((price) => <strong key={price.modelName}>{price.modelName}: {formatCents(price.minPriceCents)}{price.maxPriceCents !== price.minPriceCents && " a " + formatCents(price.maxPriceCents)}</strong>) : <strong>Não disponível</strong>}</article>
            <article><span>Peças pagas</span><strong>{ordersLoaded ? pieceCount + " peças" : "Carregando…"}</strong><small>{ordersLoaded && [...paidPieces].map(([model, count]) => model + ": " + count).join(" · ")}</small></article>
            <article><span>Pagamentos confirmados</span><strong>{formatCents(selected.paidTotalCents)}</strong><small>{ordersLoaded ? paidOrders.length + " pedidos pagos" : "Carregando pedidos…"}</small><small>{ordersLoaded ? paidCouponOrders + (paidCouponOrders === 1 ? " pedido pago com cupom" : " pedidos pagos com cupom") : "Carregando cupons…"}</small></article>
            <article><span>Recebedor</span><strong>{selected.receiver?.name ?? "Conta padrão"}</strong>{selected.receiver && <small>{"$" + selected.receiver.infinitepayHandle}</small>}</article>
          </div>
          {emailHistoryOpen && <EmailHistoryDialog key={selected.code} code={selected.code} title={selected.title} onClose={() => setEmailHistoryOpen(false)} onOpenOrder={number => { setEmailHistoryOpen(false); setViewingOrderNumber(number); }} />}
          {pickupOpen && <PickupEmailDialog code={selected.code} title={selected.title} onClose={() => setPickupOpen(false)} onSent={message => { setFeedback(message); reload(); }} />}

          <ol className="campaign-phase-track" aria-label="Fase operacional da campanha">
            {phaseOrder.map((phase, index) => {
              const state = index < currentPhaseIndex ? "is-complete" : index === currentPhaseIndex ? "is-current" : "";
              return (
                <li className={state} key={phase} aria-current={index === currentPhaseIndex ? "step" : undefined}>
                  <span className="material-symbols-rounded" aria-hidden="true">{index < currentPhaseIndex ? "check" : phaseMeta[phase].icon}</span>
                  <strong>{phaseMeta[phase].label}</strong>
                </li>
              );
            })}
          </ol>

          <section className="campaign-phase-action" aria-label="Atualizar fase da campanha">
            <span className="material-symbols-rounded" aria-hidden="true">info</span>
            <div><strong>{phaseMeta[selected.phase].sentence}</strong><p>A fase é aplicada à campanha inteira e aos pedidos com pagamento confirmado.</p></div>
            <div className="campaign-phase-actions">
              {confirmingReturn && previousPhase ? (
                <>
                  <label className="campaign-phase-reason">
                    <span>Motivo do retorno</span>
                    <input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Ex.: arte precisou de ajuste" minLength={3} />
                  </label>
                  <button className="campaign-phase-cancel" type="button" onClick={() => { setConfirmingReturn(false); setReturnReason(""); setFeedback("Retorno cancelado. A fase da campanha não foi alterada."); }}>Cancelar</button>
                  <button className="campaign-phase-confirm" type="button" disabled={busy || returnReason.trim().length < 3} onClick={() => movePhase(previousPhase, returnReason.trim())}><span className="material-symbols-rounded" aria-hidden="true">undo</span>Confirmar retorno</button>
                </>
              ) : (
                <>
                  <button className="campaign-phase-back" type="button" disabled={!previousPhase || busy} onClick={() => { setConfirmingReturn(true); setFeedback(`Informe o motivo para voltar a campanha para ${phaseMeta[previousPhase!].short}.`); }}><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>{previousPhase ? `Voltar para ${phaseMeta[previousPhase].short}` : "Etapa inicial"}</button>
                  <button className="campaign-phase-next" type="button" disabled={!nextPhase || busy} onClick={() => movePhase(nextPhase)}>{nextPhase ? `Avançar para ${phaseMeta[nextPhase].short}` : "Campanha finalizada"}<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
                </>
              )}
            </div>
          </section>
          <p className="campaign-phase-feedback" role="status" aria-live="polite">{feedback}</p>

          <section className="campaign-orders-table" aria-labelledby="campaign-orders-title">
            <header>
              <div><h3 id="campaign-orders-title">Pedidos da campanha</h3><p>{filteredOrders.length} pedidos exibidos de {campaignOrders.length}</p></div>
              <div className="campaign-order-filters">
                <label><span className="sr-only">Pedido, cliente ou telefone</span><span className="material-symbols-rounded" aria-hidden="true">search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pedido, cliente ou telefone" /></label>
                <label><span className="sr-only">Filtrar por pagamento</span>
                  <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as "all" | PaymentStatusCode)}>
                    <option value="all">Todos</option>
                    {(Object.keys(paymentLabels) as PaymentStatusCode[]).filter((status) => status !== "partially_refunded" || campaignOrders.some((order) => order.paymentStatus === status)).map((status) => <option value={status} key={status}>{paymentLabels[status]}</option>)}
                  </select>
                </label>
              </div>
            </header>
            {cancellingOrder && (
              <section className="order-cancellation-form" aria-label={`Cancelar pedido ${cancellingOrder}`}>
                <div>
                  <span className="material-symbols-rounded" aria-hidden="true">cancel</span>
                  <div><strong>Cancelar {cancellingOrder}</strong><p>O pedido permanecerá no histórico, mas sairá da produção e da entrega.</p></div>
                </div>
                <label><span>Motivo do cancelamento</span><input autoFocus value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Ex.: pedido duplicado informado pelo cliente" minLength={3} maxLength={500} /></label>
                <div className="order-cancellation-actions">
                  <button type="button" disabled={busy} onClick={() => { setCancellingOrder(""); setCancellationReason(""); setFeedback("Cancelamento descartado. O pedido não foi alterado."); }}>Manter pedido</button>
                  <button type="button" disabled={busy || cancellationReason.trim().length < 3} onClick={() => cancelOrder(cancellingOrder)}>Confirmar cancelamento</button>
                </div>
              </section>
            )}
            {refundingOrder && (
              <section className="order-refund-form" aria-label={`Registrar reembolso do pedido ${refundingOrder}`}>
                <div className="order-refund-heading">
                  <span className="material-symbols-rounded" aria-hidden="true">currency_exchange</span>
                  <div><strong>Reembolso integral de {refundingOrder}</strong><p>Faça primeiro o estorno no app InfinitePay. Este registro não movimenta dinheiro; ele guarda a referência e cancela o pedido local.</p></div>
                </div>
                <label><span>Referência do estorno na InfinitePay</span><input autoFocus value={refundReference} onChange={(event) => setRefundReference(event.target.value)} placeholder="Código ou identificação exibida pelo provedor" minLength={3} maxLength={190} /></label>
                <label><span>Motivo</span><input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Ex.: desistência solicitada pelo cliente" minLength={3} maxLength={500} /></label>
                <label><span>Link HTTPS do comprovante (opcional)</span><input type="url" value={refundReceipt} onChange={(event) => setRefundReceipt(event.target.value)} placeholder="https://..." maxLength={2048} /></label>
                <div className="order-refund-actions">
                  <button type="button" disabled={busy} onClick={() => { setRefundingOrder(""); setRefundReference(""); setRefundReason(""); setRefundReceipt(""); setFeedback("Registro descartado. Nenhum estado foi alterado."); }}>Voltar</button>
                  <button type="button" disabled={busy || refundReference.trim().length < 3 || refundReason.trim().length < 3} onClick={() => registerRefund(refundingOrder)}>Confirmar registro e cancelar</button>
                </div>
              </section>
            )}
            <div className="campaign-orders-scroll" role="region" aria-label="Lista de pedidos da campanha" tabIndex={0}>
              <div className="campaign-orders-head"><span>Pedido</span><span>Cliente</span><span>Telefone</span><span>Qtd.</span><span>Valor pago</span><span>Cupom</span><span>Pagamento</span><span>Ações</span></div>
              {filteredOrders.map((order) => (
                <div className="campaign-orders-row" key={order.number}>
                  <button className="campaign-order-number" type="button" title={"Ver detalhes do pedido " + order.number} onClick={() => setViewingOrderNumber(order.number)}><strong>#{order.number}</strong><small className={order.status === "cancelled" ? "is-cancelled" : ""}>{order.status === "cancelled" ? "Cancelado" : "Ver detalhes"}{order.createdAt && " · " + formatOrderDateTime(order.createdAt, true)}</small></button>
                  <span>{order.customer}</span><span>{order.whatsapp ? formattedWhatsapp(order.whatsapp) : "—"}</span><span>{order.quantity}</span>
                  <span className="campaign-order-paid-value">{["paid", "refunded", "partially_refunded"].includes(order.paymentStatus) ? formatCents(order.totalCents) : "—"}{order.paymentStatus === "refunded" && <small>Estorno integral</small>}{order.paymentStatus === "partially_refunded" && <small>Estorno parcial</small>}</span>
                  <span className="campaign-order-coupon">{order.couponCode ? <>Sim<small>{order.couponCode}</small></> : "Não"}</span>
                  <span className={`order-payment order-payment--${order.paymentStatus}`}>
                    <span><i />{paymentLabels[order.paymentStatus]}</span>
                    {order.paymentStatus !== "pending" && <small>{paymentMethodLabel(order.paymentMethod)}</small>}
                  </span>
                  <span className="order-row-action">
                    {order.status === "cancelled"
                      ? <small title={order.cancellationReason ?? undefined}>No histórico</small>
                      : order.paymentStatus === "paid"
                        ? <button className="order-refund-action" type="button" title="Registrar reembolso" aria-label={`Registrar reembolso do pedido ${order.number}`} disabled={busy} onClick={() => { setCancellingOrder(""); setRefundingOrder(order.number); setRefundReference(""); setRefundReason(""); setRefundReceipt(""); setFeedback(`Faça o estorno integral na InfinitePay e registre a referência do pedido ${order.number}.`); }}><span className="material-symbols-rounded" aria-hidden="true">currency_exchange</span></button>
                        : order.paymentStatus === "partially_refunded"
                          ? <small>Atendimento manual</small>
                          : <button type="button" title="Cancelar pedido" aria-label={`Cancelar pedido ${order.number}`} disabled={busy} onClick={() => { setRefundingOrder(""); setCancellingOrder(order.number); setCancellationReason(""); setFeedback(`Informe o motivo para cancelar o pedido ${order.number}.`); }}><span className="material-symbols-rounded" aria-hidden="true">cancel</span></button>}
                  </span>
                </div>
              ))}
              {filteredOrders.length === 0 && <div className="campaign-orders-empty"><span className="material-symbols-rounded" aria-hidden="true">search_off</span><p>Nenhum pedido encontrado com esses filtros.</p></div>}
            </div>
            {viewingOrder && (
              <div className="order-detail-modal">
                <button className="order-detail-backdrop" type="button" aria-label="Fechar detalhes do pedido" onClick={() => setViewingOrderNumber("")} />
                <section className="order-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
                  <header>
                    <div><span>Detalhes do pedido</span><h3 id="order-detail-title">#{viewingOrder.number}</h3>{viewingOrder.createdAt && <time dateTime={viewingOrder.createdAt}>Pedido feito em {formatOrderDateTime(viewingOrder.createdAt)}</time>}</div>
                    <button type="button" aria-label="Fechar detalhes" onClick={() => setViewingOrderNumber("")}><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
                  </header>
                  <div className="order-detail-summary">
                    <article><span>Cliente</span><strong>{viewingOrder.customer}</strong><small>{viewingOrder.whatsapp}</small>{viewingOrder.email && <small>{viewingOrder.email}</small>}</article>
                    <article><span>Pagamento</span><strong className={`order-payment order-payment--${viewingOrder.paymentStatus}`}><span><i />{paymentLabels[viewingOrder.paymentStatus]}</span></strong><small>{viewingOrder.paymentStatus === "pending" ? "Forma definida no checkout" : `Forma: ${paymentMethodLabel(viewingOrder.paymentMethod)}`}</small><small>{viewingOrder.status === "cancelled" ? "Pedido cancelado" : deliveryLabels[effectiveDelivery(viewingOrder, selected.phase)]}</small></article>
                    <article><span>Resumo</span><strong>{viewingOrder.quantity} {viewingOrder.quantity === 1 ? "peça" : "peças"}</strong><small>{panelOrderItems(viewingOrder).length} {panelOrderItems(viewingOrder).length === 1 ? "combinação" : "combinações"}</small><small>Cupom: {viewingOrder.couponCode ?? "Não utilizado"}</small></article>
                    <article><span>Total do pedido</span><strong>{formatCents(viewingOrder.totalCents)}</strong><small>Subtotal: {formatCents(viewingOrder.subtotalCents ?? viewingOrder.totalCents)}</small><small>Desconto: {formatCents(viewingOrder.discountCents ?? 0)}</small></article>
                  </div>
                  {viewingOrder.cancellationReason && <p className="order-detail-cancellation"><span className="material-symbols-rounded" aria-hidden="true">cancel</span><span><strong>Motivo do cancelamento</strong>{viewingOrder.cancellationReason}</span></p>}
                  <div className="order-detail-items">
                    <div className="order-detail-items-head"><span>Peça</span><span>Cor</span><span>Tamanho</span><span>Qtd.</span><span>Unitário</span><span>Subtotal</span></div>
                    {panelOrderItems(viewingOrder).map((item, index) => (
                      <article key={`${item.model}-${item.color}-${item.size}-${index}`}>
                        <span data-label="Peça"><strong>{item.model}</strong></span>
                        <span className="campaign-order-color" data-label="Cor"><i style={{ backgroundColor: item.colorHex }} />{item.color}</span>
                        <span data-label="Tamanho"><strong>{item.size}</strong></span>
                        <span data-label="Quantidade">{item.quantity}</span>
                        <span data-label="Unitário">{formatCents(item.unitPriceCents)}</span>
                        <span data-label="Subtotal"><strong>{formatCents(item.lineTotalCents ?? item.unitPriceCents * item.quantity)}</strong></span>
                      </article>
                    ))}
                  </div>
                  <footer><span>Somente pedidos pagos entram no relatório oficial de produção.</span><button type="button" onClick={() => setViewingOrderNumber("")}>Fechar</button></footer>
                </section>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
