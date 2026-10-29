import { CSSProperties, useEffect, useMemo, useState } from "react";
import { formattedWhatsapp } from "../../phone";
import { changeOrderDeliveryInApi, fetchDeliveryReport, fetchProductionReport } from "../../api";
import type { ApiDeliveryRow, ApiProductionRow, DeliveryStatusCode } from "../../api";
import { sortSizes } from "../../data";
import type { SizeCode } from "../../data";
import { buildProductionSheets, downloadProductionExcel, printProductionReport, ProductionReport } from "../../components/ProductionReport";
import { deliveryLabels, effectiveDelivery, panelOrderItems, errorMessage } from "../admin/model";
import type { PanelCampaign, PanelOrder, PanelData } from "../admin/model";

/* ------------------------------------------------------------------ */
/* Agregações — as mesmas regras das views do banco                    */
/* ------------------------------------------------------------------ */

export type ProductionGroup = {
  campaignCode: string;
  campaignTitle: string;
  modelName: string;
  colorName: string;
  sizes: Record<string, number>;
  total: number;
};

export function groupProduction(rows: ApiProductionRow[]): ProductionGroup[] {
  const groups = new Map<string, ProductionGroup>();
  for (const row of rows) {
    const key = `${row.campaignCode}|${row.modelName}|${row.color.name}`;
    const group = groups.get(key) ?? {
      campaignCode: row.campaignCode,
      campaignTitle: row.campaignTitle,
      modelName: row.modelName,
      colorName: row.color.name,
      sizes: {},
      total: 0,
    };
    group.sizes[row.size] = (group.sizes[row.size] ?? 0) + row.quantity;
    group.total += row.quantity;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Só pedidos pagos e não cancelados entram na produção, como em `v_production_report`. */
export function productionFromOrders(campaigns: PanelCampaign[], orders: Record<string, PanelOrder[]>): ApiProductionRow[] {
  return campaigns.flatMap((campaign) =>
    (orders[campaign.code] ?? [])
      .filter((order) => order.paymentStatus === "paid" && order.status !== "cancelled")
      .flatMap((order) => panelOrderItems(order).map((item) => ({
        campaignCode: campaign.code,
        campaignTitle: campaign.title,
        modelName: item.model,
        color: { name: item.color, hex: item.colorHex },
        size: item.size,
        sizeGroup: (item.size.endsWith("B") ? "baby_look" : "standard") as "standard" | "baby_look",
        quantity: item.quantity,
      }))),
  );
}

export function deliveryFromOrders(campaigns: PanelCampaign[], orders: Record<string, PanelOrder[]>): ApiDeliveryRow[] {
  return campaigns.flatMap((campaign) =>
    (orders[campaign.code] ?? [])
      .filter((order) => order.paymentStatus === "paid" && order.status !== "cancelled")
      .flatMap((order) => panelOrderItems(order).map((item) => ({
        campaignCode: campaign.code,
        campaignTitle: campaign.title,
        representativeName: campaign.representative,
        orderNumber: order.number,
        customerName: order.customer,
        customerWhatsapp: order.whatsapp,
        modelName: item.model,
        colorName: item.color,
        size: item.size,
        quantity: item.quantity,
        deliveryStatus: effectiveDelivery(order, campaign.phase),
      }))),
  );
}

/** Abre só as colunas de tamanho com peça pedida: o catálogo tem 12 códigos. */
export function usedSizes(groups: ProductionGroup[]) {
  const used = new Set<SizeCode>();
  for (const group of groups) {
    for (const [code, quantity] of Object.entries(group.sizes)) {
      if (quantity) used.add(code as SizeCode);
    }
  }
  return sortSizes([...used]);
}

/* ------------------------------------------------------------------ */
/* Relatórios                                                          */
/* ------------------------------------------------------------------ */

export function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function deliveryTone(status: DeliveryStatusCode) {
  if (status === "delivered") return "delivered";
  if (status === "ready") return "ready";
  if (status === "issue") return "issue";
  return "waiting";
}

export function Reports({ data }: { data: PanelData }) {
  const { campaigns, orders, mode, loadOrders, reload } = data;
  const [report, setReport] = useState<"production" | "delivery">("production");
  const [campaignCode, setCampaignCode] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | DeliveryStatusCode>("all");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveProduction, setLiveProduction] = useState<ApiProductionRow[]>([]);
  const [liveDelivery, setLiveDelivery] = useState<ApiDeliveryRow[]>([]);
  const [deliveryScope, setDeliveryScope] = useState<string | null>(null);
  const [generatingLabels, setGeneratingLabels] = useState(false);
  const [loadCount, setLoadCount] = useState(0);

  const scoped = useMemo(
    () => (campaignCode === "all" ? campaigns : campaigns.filter((campaign) => campaign.code === campaignCode)),
    [campaigns, campaignCode],
  );

  // Na demonstração as mesmas regras das views do banco são aplicadas localmente,
  // para as duas fontes produzirem exatamente o mesmo formato.
  const demoProduction = useMemo(() => productionFromOrders(scoped, orders), [scoped, orders]);
  const demoDelivery = useMemo(() => deliveryFromOrders(scoped, orders), [scoped, orders]);

  useEffect(() => {
    if (mode !== "live") return;
    let active = true;
    const filter = campaignCode === "all" ? undefined : campaignCode;
    setDeliveryScope(null);
    Promise.all([fetchProductionReport(filter), fetchDeliveryReport(filter)])
      .then(([production, delivery]) => {
        if (!active) return;
        setLiveProduction(production);
        setLiveDelivery(delivery);
        setDeliveryScope(campaignCode);
        setFeedback("Relatórios sincronizados com os pagamentos confirmados.");
      })
      .catch((reportError) => {
        if (active) setFeedback(errorMessage(reportError, "Não foi possível carregar os relatórios."));
      });
    return () => { active = false; };
  }, [mode, campaignCode, loadCount]);

  useEffect(() => {
    if (mode !== "live") return;
    const timer = window.setInterval(() => setLoadCount((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, [mode]);

  const productionRows = mode === "live" ? liveProduction : demoProduction;
  const deliveryRows = mode === "live" ? liveDelivery : demoDelivery;
  const productionGroups = groupProduction(productionRows);
  const productionColumns = usedSizes(productionGroups);
  const productionTotal = productionGroups.reduce((total, group) => total + group.total, 0);
  const productionModels = new Set(productionGroups.map((group) => group.modelName)).size;
  const productionColors = new Set(productionGroups.map((group) => group.colorName)).size;
  // A nova consulta deve atualizar a data do documento, mesmo com linhas iguais.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reportGeneratedAt = useMemo(() => new Date(), [campaignCode, loadCount, mode]);
  const productionSheets = useMemo(
    () => buildProductionSheets(productionRows, scoped, reportGeneratedAt),
    [productionRows, scoped, reportGeneratedAt],
  );
  const productionFilename = `ordem-producao-${campaignCode === "all" ? "todas-campanhas" : campaignCode.toLocaleLowerCase("pt-BR")}`;

  const normalizedSearch = deliverySearch.trim().toLocaleLowerCase("pt-BR");
  const filteredDelivery = deliveryRows.filter((row) => {
    const matchesStatus = deliveryFilter === "all" || row.deliveryStatus === deliveryFilter;
    const matchesSearch = !normalizedSearch || [row.campaignTitle, row.orderNumber, row.customerName, row.modelName, row.colorName, row.size].some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    return matchesStatus && matchesSearch;
  });
  const deliveryPending = deliveryRows.filter((row) => row.deliveryStatus === "ready").length;
  const deliveryDone = deliveryRows.filter((row) => row.deliveryStatus === "delivered").length;

  function exportCurrentReport() {
    if (report === "production") {
      if (productionSheets.length === 0) {
        setFeedback("Não há pedidos pagos para exportar no filtro atual.");
        return;
      }
      downloadProductionExcel(productionSheets, `${productionFilename}.xls`);
      setFeedback("Relatório de produção exportado para Excel.");
      return;
    }
    downloadCsv(
      "relatorio-entrega-representante.csv",
      ["Campanha", "Pedido", "Aluno", "Telefone", "Corte", "Cor", "Tamanho", "Quantidade", "Entrega"],
      filteredDelivery.map((row) => [row.campaignTitle, row.orderNumber, row.customerName, formattedWhatsapp(row.customerWhatsapp), row.modelName, row.colorName, row.size, row.quantity, deliveryLabels[row.deliveryStatus]]),
    );
    setFeedback("Checklist de entrega exportado em CSV.");
  }

  function generateProductionPdf() {
    if (productionSheets.length === 0) {
      setFeedback("Não há pedidos pagos para gerar o PDF no filtro atual.");
      return;
    }
    setFeedback("Na janela de impressão, escolha “Salvar como PDF”.");
    printProductionReport(`${productionFilename}.pdf`);
  }

  async function generateDeliveryLabels() {
    if (mode === 'live' && deliveryScope !== campaignCode) return;
    setGeneratingLabels(true);
    try {
      const { createDeliveryLabelsPdf, selectedDeliveryOrders } = await import('../../deliveryLabels');
      const rows = selectedDeliveryOrders(deliveryRows, filteredDelivery);
      const pdf = await createDeliveryLabelsPdf(rows);
      pdf.save(`etiquetas-A5-${campaignCode === 'all' ? 'todas-campanhas' : campaignCode}.pdf`);
      setFeedback('PDF A5 baixado. Imprima em papel A5, escala 100%, sem ajustar à página.');
    } catch (error) {
      setFeedback(errorMessage(error, 'Não foi possível gerar as etiquetas. Tente novamente.'));
    } finally { setGeneratingLabels(false); }
  }

  async function markDelivered(orderNumber: string) {
    if (mode !== "live") {
      setFeedback("Sem sessão no servidor, a entrega não pode ser registrada.");
      return;
    }
    setBusy(true);
    try {
      const updatedOrder = await changeOrderDeliveryInApi(orderNumber, "delivered", "Entrega registrada no painel");
      // A confirmação já foi persistida: não depender de outra consulta para
      // atualizar o checklist, inclusive todas as peças do mesmo pedido.
      setLiveDelivery((rows) => rows.map((row) => row.orderNumber === orderNumber
        ? { ...row, deliveryStatus: updatedOrder.deliveryStatus }
        : row));
      setFeedback(`Entrega do pedido ${orderNumber} registrada.`);
      setLoadCount((value) => value + 1);
      reload();
      for (const campaign of scoped) loadOrders(campaign.code);
    } catch (deliveryError) {
      setFeedback(errorMessage(deliveryError, "Não foi possível registrar a entrega."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-content reports-page">
      <section className="reports-intro">
        <div><span className="kicker">Operação</span><h2>Relatórios da camisaria</h2><p>Produção consolidada para a oficina e checklist nominal para o representante da turma.</p></div>
        <div className="reports-intro-actions">
          {report === 'delivery' && <button className="outline-action" type="button" onClick={generateDeliveryLabels} disabled={generatingLabels || !filteredDelivery.length || mode === 'live' && deliveryScope !== campaignCode}>{generatingLabels ? 'Gerando etiquetas…' : 'Etiquetas A5 — PDF'}<span className="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span></button>}
          <button className="outline-action" type="button" onClick={() => { setFeedback("Atualizando dados confirmados..."); setLoadCount((value) => value + 1); reload(); }}>Atualizar dados<span className="material-symbols-rounded" aria-hidden="true">refresh</span></button>
          <button className="outline-action" type="button" onClick={report === "production" ? generateProductionPdf : () => window.print()}>{report === "production" ? "Gerar PDF" : "Imprimir"}<span className="material-symbols-rounded" aria-hidden="true">{report === "production" ? "picture_as_pdf" : "print"}</span></button>
          <button className="primary-action" type="button" onClick={exportCurrentReport}>{report === "production" ? "Exportar Excel" : "Exportar CSV"}<span className="material-symbols-rounded" aria-hidden="true">download</span></button>
        </div>
      </section>

      <div className="report-tabs" role="tablist" aria-label="Tipo de relatório">
        <button className={report === "production" ? "is-active" : ""} type="button" role="tab" aria-selected={report === "production"} onClick={() => { setReport("production"); setFeedback(""); }}><span className="material-symbols-rounded" aria-hidden="true">precision_manufacturing</span><span><strong>Produção</strong><small>Quantidades para fabricar</small></span></button>
        <button className={report === "delivery" ? "is-active" : ""} type="button" role="tab" aria-selected={report === "delivery"} onClick={() => { setReport("delivery"); setFeedback(""); }}><span className="material-symbols-rounded" aria-hidden="true">redeem</span><span><strong>Entrega</strong><small>Checklist do representante</small></span></button>
      </div>

      <section className="report-toolbar" aria-label="Filtros do relatório">
        <label><span>Campanha</span>
          <select value={campaignCode} onChange={(event) => { setCampaignCode(event.target.value); setFeedback(""); }}>
            <option value="all">Todas as campanhas</option>
            {campaigns.map((campaign) => <option value={campaign.code} key={campaign.code}>{campaign.title}</option>)}
          </select>
        </label>
        {report === "delivery" && (
          <>
            <label className="report-search"><span>Buscar aluno ou pedido</span><div><span className="material-symbols-rounded" aria-hidden="true">search</span><input value={deliverySearch} onChange={(event) => setDeliverySearch(event.target.value)} placeholder="Nome ou número do pedido" /></div></label>
            <label><span>Situação da entrega</span>
              <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value as "all" | DeliveryStatusCode)}>
                <option value="all">Todos</option>
                {(Object.keys(deliveryLabels) as DeliveryStatusCode[]).map((status) => <option value={status} key={status}>{deliveryLabels[status]}</option>)}
              </select>
            </label>
          </>
        )}
      </section>
      <p className="report-feedback" role="status" aria-live="polite">{feedback}</p>

      {report === "production" ? (
        <>
          <section className="report-metrics" aria-label="Resumo da produção"><article><span>Peças confirmadas</span><strong>{productionTotal}</strong><small>Somente pedidos pagos</small></article><article><span>Campanhas</span><strong>{new Set(productionGroups.map((group) => group.campaignCode)).size}</strong><small>Com produção confirmada</small></article><article><span>Cortes</span><strong>{productionModels}</strong><small>Com produção confirmada</small></article><article><span>Cores</span><strong>{productionColors}</strong><small>Separadas para corte</small></article></section>
          <section className="production-report-card" aria-labelledby="production-report-title">
            <header><div><span className="material-symbols-rounded" aria-hidden="true">verified</span><div><h3 id="production-report-title">Ordem consolidada de produção</h3><p>Campanha → corte → cor → tamanho. Pendentes, falhos e reembolsados ficam fora.</p></div></div><strong>{productionTotal} {productionTotal === 1 ? "peça" : "peças"}</strong></header>
            {productionGroups.length === 0 ? (
              <p className="campaign-production-empty"><span className="material-symbols-rounded" aria-hidden="true">hourglass_empty</span>Nenhum pedido pago no filtro atual. Confirme os pagamentos em Pedidos para a produção aparecer aqui.</p>
            ) : (
              <div className="production-report-scroll" style={{ "--size-columns": productionColumns.length } as CSSProperties}>
                <div className="production-report-head"><span>Campanha</span><span>Corte</span><span>Cor</span>{productionColumns.map((size) => <span key={size}>{size}</span>)}<span>Total</span></div>
                {productionGroups.map((group) => (
                  <div className="production-report-row" key={`${group.campaignCode}-${group.modelName}-${group.colorName}`}>
                    <span><strong>{group.campaignTitle}</strong><small>{group.campaignCode}</small></span>
                    <span>{group.modelName}</span><span>{group.colorName}</span>
                    {productionColumns.map((size) => <span key={size}>{group.sizes[size] ?? 0}</span>)}<strong>{group.total}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
          <ProductionReport rows={productionRows} campaigns={scoped} generatedAt={reportGeneratedAt} />
        </>
      ) : (
        <>
          <section className="report-metrics report-metrics--delivery" aria-label="Resumo da entrega"><article><span>Pedidos pagos</span><strong>{deliveryRows.length}</strong><small>Aptos ao fluxo de entrega</small></article><article><span>A entregar</span><strong>{deliveryPending}</strong><small>Disponíveis com representante</small></article><article><span>Entregues</span><strong>{deliveryDone}</strong><small>Confirmados no checklist</small></article><article><span>Exibidos</span><strong>{filteredDelivery.length}</strong><small>Após busca e filtros</small></article></section>
          <section className="delivery-report-card" aria-labelledby="delivery-report-title">
            <header><div><h3 id="delivery-report-title">Checklist de entrega</h3><p>Somente pedidos com pagamento confirmado. A produção continua controlada pela campanha.</p></div><strong>{filteredDelivery.length} {filteredDelivery.length === 1 ? "pedido" : "pedidos"}</strong></header>
            <div className="delivery-report-list">
              <div className="delivery-report-head"><span>Campanha</span><span>Pedido / aluno</span><span>Camisa</span><span>Qtd.</span><span>Entrega</span><span>Ação</span></div>
              {filteredDelivery.map((row) => {
                const canDeliver = row.deliveryStatus === "ready";
                return (
                  <article className="delivery-report-row" key={`${row.orderNumber}-${row.size}-${row.colorName}`}>
                    <span data-label="Campanha"><strong>{row.campaignTitle}</strong><small>{row.representativeName}</small></span>
                    <span data-label="Pedido / aluno"><strong>{row.orderNumber}</strong><small>{row.customerName}</small><small className="delivery-report-phone">Telefone: {formattedWhatsapp(row.customerWhatsapp)}</small></span>
                    <span data-label="Camisa"><strong>{row.modelName} · {row.colorName}</strong><small>Tamanho {row.size}</small></span>
                    <span data-label="Qtd."><strong>{row.quantity}</strong></span>
                    <span data-label="Entrega"><em className={`delivery-report-status delivery-report-status--${deliveryTone(row.deliveryStatus)}`}>{deliveryLabels[row.deliveryStatus]}</em></span>
                    <span data-label="Ação"><button type="button" disabled={busy || !canDeliver} onClick={() => markDelivered(row.orderNumber)}>{row.deliveryStatus === "delivered" ? "Entregue" : canDeliver ? "Marcar entregue" : "Aguardar campanha"}</button></span>
                  </article>
                );
              })}
              {filteredDelivery.length === 0 && <div className="delivery-report-empty"><span className="material-symbols-rounded" aria-hidden="true">search_off</span><p>Nenhum pedido pago corresponde aos filtros.</p></div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
