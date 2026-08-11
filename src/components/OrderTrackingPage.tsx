import { FormEvent, useEffect, useState } from "react";
import { ApiRequestError, assetUrl, createInfinitePayCheckout, requestInfinitePayReconciliation, trackOrderInApi } from "../api";
import { buildRoute } from "../App";
import { shirtModels } from "../data";
import { Brand } from "./Brand";

type DemoOrderStatus = "pending" | "confirmed" | "production" | "failed" | "ready" | "delivered" | "cancelled";

type DemoOrder = {
  number: string;
  status: DemoOrderStatus;
  headline: string;
  description: string;
  statusLabel: string;
  statusIcon: string;
  paymentLabel: string;
  cancellationReason?: string | null;
  campaignCode?: string;
  campaignTitle?: string;
  representative?: string;
  modelName?: string;
  colorName?: string;
  size?: string;
  quantity?: number;
  totalCents?: number;
  artFront?: string | null;
  artBack?: string | null;
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
  "CM-2026-0152": {
    number: "CM-2026-0152",
    status: "cancelled",
    headline: "Este pedido foi cancelado.",
    description: "Ele continua disponível para consulta, mas não seguirá para produção.",
    statusLabel: "Pedido cancelado",
    statusIcon: "cancel",
    paymentLabel: "Pagamento não confirmado",
    cancellationReason: "Pedido duplicado informado pelo cliente.",
  },
};

const timeline = [
  { icon: "check", title: "Pedido criado", description: "Dados e camiseta registrados." },
  { icon: "hourglass_top", title: "Confirmação do pagamento", description: "Aguardando a conferência da camisaria." },
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
  if (status === "cancelled") return index === 0 ? "is-complete" : index === 1 ? "is-failed" : "";
  if (status === "pending") return index === 0 ? "is-complete" : index === 1 ? "is-current" : "";
  if (status === "confirmed") return index < 1 ? "is-complete" : index === 1 ? "is-current" : "";
  if (status === "production") return index < 2 ? "is-complete" : index === 2 ? "is-current" : "";
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
  const [paymentReturnMessage, setPaymentReturnMessage] = useState("");
  const [retryingPayment, setRetryingPayment] = useState(false);

  useEffect(() => {
    const returnedOrder = params.get("order_nsu");
    const transactionNsu = params.get("transaction_nsu");
    const invoiceSlug = params.get("slug");
    if (!returnedOrder || !transactionNsu || !invoiceSlug) return;
    setOrderNumber(returnedOrder);
    setPaymentReturnMessage("Pagamento recebido pela InfinitePay. Estamos confirmando a transação com segurança.");
    requestInfinitePayReconciliation({
      orderNsu: returnedOrder,
      transactionNsu,
      invoiceSlug,
      receiptUrl: params.get("receipt_url") ?? undefined,
      captureMethod: params.get("capture_method") ?? undefined,
    }).catch(() => {
      setPaymentReturnMessage("Seu pedido continua salvo. A confirmação automática seguirá pelo servidor da InfinitePay.");
    }).finally(() => {
      const cleanUrl = new URL(window.location.href);
      for (const key of ["order_nsu", "transaction_nsu", "slug", "receipt_url", "capture_method"]) {
        cleanUrl.searchParams.delete(key);
      }
      cleanUrl.searchParams.set("pedido", returnedOrder);
      window.history.replaceState({}, "", cleanUrl);
    });
  // Os parâmetros do retorno são consumidos uma única vez ao abrir a página.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function findOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedNumber = normalizeOrder(orderNumber);
    setSearching(true);
    try {
      const persisted = await trackOrderInApi(normalizedNumber, phone);
      const item = persisted.items[0];
      const copyByStatus = {
        pending: ["Seu pedido está em análise.", "Acompanhe cada etapa até a retirada com o representante.", "Aguardando confirmação", "hourglass_top"],
        confirmed: ["Pagamento confirmado!", "Seu pedido está confirmado e aguarda o avanço da campanha para produção.", "Pagamento confirmado", "verified"],
        production: ["Seu pedido está em produção.", "A campanha avançou e sua camiseta está sendo produzida.", "Em produção", "precision_manufacturing"],
        failed: ["O pagamento não foi aprovado.", "Seu pedido continua salvo e você pode tentar novamente com segurança.", "Pagamento não aprovado", "error"],
        ready: ["Seu pedido está pronto para retirada.", "Leve o número do pedido e procure o representante da sua turma.", "Pronto para retirada", "redeem"],
        delivered: ["Pedido entregue!", "A retirada foi registrada e este pedido está finalizado.", "Entregue", "task_alt"],
        cancelled: ["Este pedido foi cancelado.", "Ele continua disponível para consulta, mas não seguirá para produção.", "Pedido cancelado", "cancel"],
      } as const;
      const copy = copyByStatus[persisted.status];
      setOrder({
        number: persisted.number,
        status: persisted.status,
        headline: copy[0],
        description: copy[1],
        statusLabel: copy[2],
        statusIcon: copy[3],
        paymentLabel: persisted.paymentStatus === "paid"
          ? "Pagamento confirmado"
          : persisted.paymentStatus === "refunded" || persisted.paymentStatus === "partially_refunded"
            ? "Pagamento reembolsado"
            : persisted.paymentStatus === "failed"
              ? "Pagamento não confirmado"
              : "Aguardando confirmação",
        cancellationReason: persisted.cancellationReason,
        campaignCode: persisted.campaign.code,
        campaignTitle: persisted.campaign.title,
        representative: persisted.campaign.representativeName,
        modelName: item?.modelName,
        colorName: item?.color.name,
        size: item?.size,
        quantity: item?.quantity,
        totalCents: persisted.totalCents,
        artFront: assetUrl(persisted.campaign.artFrontUrl),
        artBack: assetUrl(persisted.campaign.artBackUrl),
      });
      setError("");
      setOrderCopied(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (lookupError) {
      // Os pedidos fictícios existem só em desenvolvimento. No site publicado, um erro
      // do servidor precisa aparecer como erro — nunca como um pedido que não existe.
      const matchedOrder = import.meta.env.DEV ? demoOrders[normalizedNumber] : undefined;
      if (!matchedOrder || onlyDigits(phone) !== demoPhone) {
        setOrder(null);
        const unavailable = lookupError instanceof ApiRequestError && lookupError.code === "API_UNAVAILABLE";
        setError(
          unavailable
            ? "Não foi possível falar com o servidor agora. Tente novamente em alguns instantes."
            : "Não encontramos esse pedido. Confira o número e o WhatsApp informado na compra.",
        );
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

  async function retryPayment() {
    if (!order) return;
    setRetryingPayment(true);
    setError("");
    try {
      const checkout = await createInfinitePayCheckout(order.number, phone);
      window.location.assign(checkout.url);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Não foi possível abrir o checkout agora.");
    } finally {
      setRetryingPayment(false);
    }
  }

  const headingIcon = order?.status === "confirmed"
    ? "verified"
    : order?.status === "production"
      ? "precision_manufacturing"
    : order?.status === "cancelled"
      ? "cancel"
    : order?.status === "failed"
      ? "error"
      : order?.status === "ready"
        ? "redeem"
        : order?.status === "delivered"
          ? "task_alt"
          : order
            ? "schedule"
            : "search";
  // Reservas neutras: quando o pedido não traz o dado, a tela usa a foto de catálogo
  // e um traço, em vez de repetir números de uma campanha de demonstração.
  const displayedRepresentative = order?.representative ?? "o representante da turma";
  const displayedCampaignTitle = order?.campaignTitle ?? "Campanha da turma";
  const trackedArt = { front: order?.artFront ?? shirtModels[0].image, back: order?.artBack ?? null };
  const displayedModel = order?.modelName ?? "—";
  const displayedColor = order?.colorName ? ` · ${order.colorName}` : "";
  const displayedSize = order?.size ?? "—";
  const displayedQuantity = order?.quantity ?? 1;
  const displayedTotal = order?.totalCents === undefined
    ? "—"
    : (order.totalCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
            {paymentReturnMessage && <p className="tracking-order-notice"><span className="material-symbols-rounded" aria-hidden="true">verified_user</span>{paymentReturnMessage}</p>}
            <label htmlFor="tracking-order">Número do pedido</label>
            <input
              id="tracking-order"
              name="order"
              placeholder="Ex.: CM-2026-A1B2C3D4"
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
            {import.meta.env.DEV && (
              <div className="tracking-demo">
                <strong>Pedidos de teste (só em desenvolvimento)</strong>
                <span>0147 aguardando · 0148 confirmado · 0149 não aprovado</span>
                <span>0150 pronto · 0151 entregue · 0152 cancelado</span>
                <small>Use o WhatsApp (98) 99999-0000.</small>
              </div>
            )}
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

            {order.status === "cancelled" && (
              <p className="tracking-order-notice is-cancelled">
                <span className="material-symbols-rounded" aria-hidden="true">cancel</span>
                <span><strong>Motivo:</strong> {order.cancellationReason || "Cancelamento registrado pela camisaria."}</span>
              </p>
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
                  <div className={`campaign-art-thumbs ${trackedArt.back ? "" : "is-single"}`} aria-label={trackedArt.back ? "Arte da campanha, frente e costas" : "Arte da campanha"}>
                    <img src={trackedArt.front} alt={`${displayedCampaignTitle} — frente`} />
                    {trackedArt.back && <img src={trackedArt.back} alt={`${displayedCampaignTitle} — costas`} />}
                  </div>
                  <div className="received-product-copy">
                    <strong>{displayedModel}{displayedColor} · {displayedSize}</strong>
                    <span>{displayedQuantity} {displayedQuantity === 1 ? "unidade" : "unidades"} · Arte da campanha</span>
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
                    const paidOrder = order.status === "confirmed" || order.status === "production" || order.status === "ready" || order.status === "delivered";
                    const cancelledStep = order.status === "cancelled" && index === 1;
                    const icon = cancelledStep
                      ? "cancel"
                      : order.status === "failed" && index === 1
                      ? "error"
                      : paidOrder && index === 1
                        ? "check"
                        : item.icon;
                    const title = cancelledStep ? "Pedido cancelado" : item.title;
                    const description = cancelledStep
                      ? (order.cancellationReason || "Cancelamento registrado pela camisaria.")
                      : order.status === "failed" && index === 1
                      ? "A transação não foi confirmada."
                      : paidOrder && index === 1
                        ? "Pagamento validado com segurança."
                      : order.status === "confirmed" && index === 2
                          ? "Aguardando a campanha entrar em produção."
                          : order.status === "production" && index === 2
                            ? "Sua camiseta está sendo produzida."
                          : (order.status === "ready" || order.status === "delivered") && index === 2
                            ? "Produção concluída."
                            : order.status === "ready" && index === 3
                              ? `Disponível com ${displayedRepresentative}.`
                              : order.status === "delivered" && index === 3
                                ? "Retirada registrada."
                                : order.status === "delivered" && index === 4
                                  ? "Pedido entregue ao aluno."
                          : item.description;
                    return <li className={itemClass} key={item.title}><span className="material-symbols-rounded" aria-hidden="true">{icon}</span><div><strong>{title}</strong><small>{description}</small></div></li>;
                  })}
                </ol>
                <p className="received-production-note"><span className="material-symbols-rounded" aria-hidden="true">lock</span>Somente pedidos confirmados seguem para produção.</p>
              </aside>
            </div>

            <div className="tracking-actions">
              {order.status === "failed" && <button className="is-primary" type="button" onClick={retryPayment} disabled={retryingPayment}>{retryingPayment ? "Abrindo checkout..." : "Tentar pagamento novamente"}</button>}
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
