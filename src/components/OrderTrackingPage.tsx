import { FormEvent, useState } from "react";
import { trackOrderInApi } from "../api";
import { buildRoute } from "../App";
import { privateCampaigns, shirtModels } from "../data";
import { Brand } from "./Brand";

type DemoOrderStatus = "pending" | "confirmed" | "failed" | "ready" | "delivered";

type DemoOrder = {
  number: string;
  status: DemoOrderStatus;
  headline: string;
  description: string;
  statusLabel: string;
  statusIcon: string;
  paymentLabel: string;
  campaignCode?: string;
  campaignTitle?: string;
  representative?: string;
  modelName?: string;
  colorName?: string;
  size?: string;
  quantity?: number;
  totalCents?: number;
};

const demoPhone = "98999990000";
const demoOrders: Record<string, DemoOrder> = {
  "CM-2026-0147": {
    number: "CM-2026-0147",
    status: "pending",
    headline: "Seu pedido está em análise.",
    description: "Acompanhe cada etapa até a retirada com o representante.",
    statusLabel: "Aguardando confirmação",
    statusIcon: "hourglass_top",
    paymentLabel: "Pix · Aguardando",
  },
  "CM-2026-0148": {
    number: "CM-2026-0148",
    status: "confirmed",
    headline: "Pagamento confirmado!",
    description: "Seu pedido já foi liberado e está seguindo para produção.",
    statusLabel: "Pagamento confirmado",
    statusIcon: "verified",
    paymentLabel: "Pix · Confirmado",
  },
  "CM-2026-0149": {
    number: "CM-2026-0149",
    status: "failed",
    headline: "O pagamento não foi aprovado.",
    description: "Seu pedido continua salvo e você pode tentar novamente com segurança.",
    statusLabel: "Pagamento não aprovado",
    statusIcon: "error",
    paymentLabel: "Pix · Não aprovado",
  },
  "CM-2026-0150": {
    number: "CM-2026-0150",
    status: "ready",
    headline: "Seu pedido está pronto para retirada.",
    description: "Leve o número do pedido e procure o representante da sua turma.",
    statusLabel: "Pronto para retirada",
    statusIcon: "redeem",
    paymentLabel: "Pix · Confirmado",
  },
  "CM-2026-0151": {
    number: "CM-2026-0151",
    status: "delivered",
    headline: "Pedido entregue!",
    description: "A retirada foi registrada e este pedido está finalizado.",
    statusLabel: "Entregue",
    statusIcon: "task_alt",
    paymentLabel: "Pix · Confirmado",
  },
};

const timeline = [
  { icon: "check", title: "Pedido criado", description: "Dados e camiseta registrados." },
  { icon: "hourglass_top", title: "Confirmação do pagamento", description: "Aguardando o retorno do provedor." },
  { icon: "inventory_2", title: "Em produção", description: "Começa após a confirmação." },
  { icon: "redeem", title: "Pronto para retirada", description: "O representante recebe os pedidos." },
  { icon: "task_alt", title: "Entregue", description: "Pedido finalizado." },
];

function normalizeOrder(value: string) {
  return value.trim().replace(/^#/, "").toUpperCase();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function timelineClass(status: DemoOrderStatus, index: number) {
  if (status === "pending") return index === 0 ? "is-complete" : index === 1 ? "is-current" : "";
  if (status === "confirmed") return index < 2 ? "is-complete" : index === 2 ? "is-current" : "";
  if (status === "ready") return index < 3 ? "is-complete" : index === 3 ? "is-current" : "";
  if (status === "delivered") return index < 4 ? "is-complete" : index === 4 ? "is-current" : "";
  return index === 0 ? "is-complete" : index === 1 ? "is-failed" : "";
}

export function OrderTrackingPage() {
  const params = new URLSearchParams(window.location.search);
  const [orderNumber, setOrderNumber] = useState(params.get("pedido") ?? "");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<DemoOrder | null>(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [orderCopied, setOrderCopied] = useState(false);
  const campaign = privateCampaigns["MENDES-ENG-26"];
  const shirt = shirtModels[0];

  async function findOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedNumber = normalizeOrder(orderNumber);
    setSearching(true);
    try {
      const persisted = await trackOrderInApi(normalizedNumber, phone);
      const item = persisted.items[0];
      const copyByStatus = {
        pending: ["Seu pedido está em análise.", "Acompanhe cada etapa até a retirada com o representante.", "Aguardando confirmação", "hourglass_top"],
        confirmed: ["Pagamento confirmado!", "Seu pedido já foi liberado e está seguindo para produção.", "Pagamento confirmado", "verified"],
        failed: ["O pagamento não foi aprovado.", "Seu pedido continua salvo e você pode tentar novamente com segurança.", "Pagamento não aprovado", "error"],
        ready: ["Seu pedido está pronto para retirada.", "Leve o número do pedido e procure o representante da sua turma.", "Pronto para retirada", "redeem"],
        delivered: ["Pedido entregue!", "A retirada foi registrada e este pedido está finalizado.", "Entregue", "task_alt"],
      } as const;
      const copy = copyByStatus[persisted.status];
      setOrder({
        number: persisted.number,
        status: persisted.status,
        headline: copy[0],
        description: copy[1],
        statusLabel: copy[2],
        statusIcon: copy[3],
        paymentLabel: persisted.paymentStatus === "paid" ? "Pagamento confirmado" : "Aguardando confirmação",
        campaignCode: persisted.campaign.code,
        campaignTitle: persisted.campaign.title,
        representative: persisted.campaign.representativeName,
        modelName: item?.modelName,
        colorName: item?.color.name,
        size: item?.size,
        quantity: item?.quantity,
        totalCents: persisted.totalCents,
      });
      setError("");
      setOrderCopied(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      const matchedOrder = demoOrders[normalizedNumber];
      if (!matchedOrder || onlyDigits(phone) !== demoPhone) {
        setOrder(null);
        setError("Não encontramos esse pedido. Confira o número e o WhatsApp informado na compra.");
        return;
      }
      setError("");
      setOrder(matchedOrder);
      setOrderCopied(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSearching(false);
    }
  }

  function resetSearch() {
    setOrder(null);
    setError("");
    setOrderCopied(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copyOrderNumber() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.number);
      setOrderCopied(true);
    } catch {
      setOrderCopied(false);
    }
  }

  const headingIcon = order?.status === "confirmed"
    ? "verified"
    : order?.status === "failed"
      ? "error"
      : order?.status === "ready"
        ? "redeem"
        : order?.status === "delivered"
          ? "task_alt"
          : order
            ? "schedule"
            : "search";
  const displayedRepresentative = order?.representative ?? campaign.representative;
  const displayedCampaignTitle = order?.campaignTitle ?? campaign.title;
  const displayedCampaignCode = order?.campaignCode ?? campaign.code;
  const displayedShirt = shirtModels.find((item) => item.name === order?.modelName) ?? shirt;
  const displayedModel = order?.modelName ?? "Comum";
  const displayedColor = order?.colorName ? ` · ${order.colorName}` : "";
  const displayedSize = order?.size ?? "M";
  const displayedQuantity = order?.quantity ?? 1;
  const displayedTotal = ((order?.totalCents ?? 5990) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="tracking-page">
      <header className="campaign-shop-header">
        <div className="campaign-shop-header-inner">
          <a className="campaign-back" href={buildRoute()} aria-label="Voltar ao site">
            <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
          </a>
          <Brand compact />
          <div className="campaign-private-meta">
            <span><span className="material-symbols-rounded" aria-hidden="true">shield_lock</span>Consulta segura</span>
            <small>Acompanhe seu pedido</small>
          </div>
        </div>
      </header>

      <main className="tracking-main">
        <section className="tracking-heading">
          <span className={`tracking-heading-icon ${order ? `is-${order.status}` : ""} material-symbols-rounded`} aria-hidden="true">{headingIcon}</span>
          <p>Acompanhar pedido</p>
          <h1>{order?.headline ?? "Veja onde seu pedido está."}</h1>
          <span>{order?.description ?? "Use os mesmos dados informados no momento da compra."}</span>
        </section>

        {!order ? (
          <form className="tracking-form" onSubmit={findOrder}>
            <label htmlFor="tracking-order">Número do pedido</label>
            <input
              id="tracking-order"
              name="order"
              placeholder="Ex.: CM-2026-0147"
              value={orderNumber}
              onChange={(event) => { setOrderNumber(event.target.value); setError(""); }}
              autoComplete="off"
              required
            />

            <label htmlFor="tracking-phone">WhatsApp usado na compra</label>
            <input
              id="tracking-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="(98) 99999-0000"
              value={phone}
              onChange={(event) => { setPhone(event.target.value); setError(""); }}
              autoComplete="tel"
              minLength={10}
              required
            />

            {error && <p className="tracking-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{error}</p>}
            <button type="submit" disabled={searching}>{searching ? "Consultando..." : "Consultar pedido"}<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
            <p className="tracking-privacy"><span className="material-symbols-rounded" aria-hidden="true">lock</span>Seus dados são usados somente para localizar o pedido.</p>
            <div className="tracking-demo">
              <strong>Pedidos de teste</strong>
              <span>0147 aguardando · 0148 confirmado · 0149 não aprovado</span>
              <span>0150 pronto · 0151 entregue</span>
              <small>Use o WhatsApp (98) 99999-0000.</small>
            </div>
          </form>
        ) : (
          <div className={`tracking-result tracking-result--${order.status}`}>
            <div className="tracking-result-topline">
              <div><small>Pedido localizado</small><strong>#{order.number}</strong></div>
              <span className={`is-${order.status}`}><span className="material-symbols-rounded" aria-hidden="true">{order.statusIcon}</span>{order.statusLabel}</span>
            </div>

            {order.status === "failed" && (
              <p className="tracking-payment-alert"><span className="material-symbols-rounded" aria-hidden="true">info</span>O pedido foi preservado. Nenhum valor confirmado será cobrado duas vezes.</p>
            )}

            {order.status === "ready" && (
              <p className="tracking-order-notice is-ready"><span className="material-symbols-rounded" aria-hidden="true">badge</span><span>Leve o número do pedido e confirme seu nome com <strong>{displayedRepresentative}</strong> no momento da retirada.</span></p>
            )}

            {order.status === "delivered" && (
              <p className="tracking-order-notice is-delivered"><span className="material-symbols-rounded" aria-hidden="true">verified</span><span>Retirada concluída. Guarde este pedido apenas como comprovante.</span></p>
            )}

            <div className="tracking-result-grid">
              <section className="received-order-card" aria-labelledby="tracking-order-title">
                <header>
                  <div>
                    <small>Campanha</small>
                    <h2 id="tracking-order-title">{displayedCampaignTitle}</h2>
                  </div>
                </header>

                <div className="received-product-row">
                  <div className="received-shirt-pair" aria-label="Camiseta vista de frente e costas">
                    <img src={displayedShirt.image} alt={`Camiseta ${displayedModel} — frente`} />
                    <img src={displayedShirt.backImage} alt={`Camiseta ${displayedModel} — costas`} />
                  </div>
                  <div className="received-product-copy">
                    <strong>{displayedModel}{displayedColor} · {displayedSize}</strong>
                    <span>{displayedQuantity} {displayedQuantity === 1 ? "unidade" : "unidades"} · Arte fixa frente e costas</span>
                    <dl>
                      <div><dt>Pagamento</dt><dd>{order.paymentLabel}</dd></div>
                      <div><dt>Total</dt><dd>{displayedTotal}</dd></div>
                    </dl>
                  </div>
                </div>

                <p className="received-pickup"><span className="material-symbols-rounded" aria-hidden="true">person</span>Retirada com <strong>{displayedRepresentative}</strong></p>
              </section>

              <aside className="received-next-steps tracking-timeline" aria-labelledby="tracking-status-title">
                <h2 id="tracking-status-title">Andamento</h2>
                <ol>
                  {timeline.map((item, index) => {
                    const itemClass = timelineClass(order.status, index);
                    const paidOrder = order.status === "confirmed" || order.status === "ready" || order.status === "delivered";
                    const icon = order.status === "failed" && index === 1
                      ? "error"
                      : paidOrder && index === 1
                        ? "check"
                        : item.icon;
                    const description = order.status === "failed" && index === 1
                      ? "A transação não foi confirmada."
                      : paidOrder && index === 1
                        ? "Pagamento validado com segurança."
                      : order.status === "confirmed" && index === 2
                          ? "Seu pedido foi liberado para produção."
                          : (order.status === "ready" || order.status === "delivered") && index === 2
                            ? "Produção concluída."
                            : order.status === "ready" && index === 3
                              ? `Disponível com ${displayedRepresentative}.`
                              : order.status === "delivered" && index === 3
                                ? "Retirada registrada."
                                : order.status === "delivered" && index === 4
                                  ? "Pedido entregue ao aluno."
                          : item.description;
                    return <li className={itemClass} key={item.title}><span className="material-symbols-rounded" aria-hidden="true">{icon}</span><div><strong>{item.title}</strong><small>{description}</small></div></li>;
                  })}
                </ol>
                <p className="received-production-note"><span className="material-symbols-rounded" aria-hidden="true">lock</span>Somente pedidos confirmados seguem para produção.</p>
              </aside>
            </div>

            <div className="tracking-actions">
              {order.status === "failed" && <a className="is-primary" href={buildRoute(undefined, displayedCampaignCode, undefined, order.number)}>Tentar pagamento novamente</a>}
              {order.status === "ready" && <button className="is-primary" type="button" onClick={copyOrderNumber}>Copiar número para retirada<span className="material-symbols-rounded" aria-hidden="true">content_copy</span></button>}
              <button className={order.status === "failed" || order.status === "ready" ? "is-secondary" : ""} type="button" onClick={resetSearch}>Consultar outro pedido</button>
              <a href={buildRoute()}>Voltar ao site</a>
              {order.status === "ready" && <p className="tracking-copy-status" role="status" aria-live="polite">{orderCopied ? "Número do pedido copiado." : "Tenha o número em mãos para agilizar a retirada."}</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
