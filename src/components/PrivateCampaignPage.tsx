import { FormEvent, useMemo, useState } from "react";
import { createOrderInApi } from "../api";
import type { PrivateCampaign, ShirtModelName } from "../data";
import { defaultCampaignColors, shirtModels } from "../data";
import { Brand } from "./Brand";

const sizes = ["PP", "P", "M", "G", "GG", "XG"];
type CampaignStep = "model" | "details" | "payment" | "received";
type PaymentMethod = "pix" | "card";

export function PrivateCampaignPage({ campaign, resumePayment }: { campaign: PrivateCampaign; resumePayment?: string }) {
  const [step, setStep] = useState<CampaignStep>(resumePayment ? "payment" : "model");
  const [model, setModel] = useState(shirtModels[0].name);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("back");
  const [color, setColor] = useState(() => (campaign.colors?.[shirtModels[0].name] ?? defaultCampaignColors[shirtModels[0].name])[0].name);
  const [size, setSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [orderCopied, setOrderCopied] = useState(false);
  const [orderNumber, setOrderNumber] = useState(resumePayment ?? "CM-2026-0147");
  const [paymentError, setPaymentError] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  const selectedModel = shirtModels.find((item) => item.name === model) ?? shirtModels[0];
  const campaignModelImages = campaign.modelImages?.[model];
  const availableColors = campaign.colors?.[model]?.length ? campaign.colors[model] : defaultCampaignColors[model];
  const selectedColor = availableColors.find((item) => item.name === color) ?? availableColors[0];
  const selectedFrontImage = campaignModelImages?.front ?? selectedModel.image;
  const selectedBackImage = campaignModelImages?.back ?? selectedModel.backImage;
  const selectedImage = previewSide === "front" ? selectedFrontImage : selectedBackImage;
  const oppositeImage = previewSide === "front" ? selectedBackImage : selectedFrontImage;
  const unitPrice = campaign.prices[model];
  const total = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);
  const formattedTotal = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function selectModel(nextModel: ShirtModelName) {
    setModel(nextModel);
    const nextColors = campaign.colors?.[nextModel]?.length ? campaign.colors[nextModel] : defaultCampaignColors[nextModel];
    setColor(nextColors[0].name);
    setOrderCopied(false);
  }

  function goToStep(nextStep: CampaignStep) {
    setStep(nextStep);
    setOrderCopied(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToStep("details");
  }

  function submitCustomerDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToStep("payment");
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError("");
    const variantId = campaign.variantIds?.[model]?.[selectedColor.name];
    if (!variantId) {
      goToStep("received");
      return;
    }
    setSubmittingOrder(true);
    try {
      const created = await createOrderInApi({
        campaignCode: campaign.code,
        customer: { name: customerName, whatsapp: customerPhone, email: customerEmail || undefined },
        variantId,
        size,
        quantity,
        idempotencyKey,
      });
      setOrderNumber(created.number);
      goToStep("received");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Não foi possível registrar o pedido.");
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function copyOrderNumber() {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setOrderCopied(true);
    } catch {
      setOrderCopied(false);
    }
  }

  return (
    <div className="private-campaign-page">
      <header className="campaign-shop-header">
        <div className="campaign-shop-header-inner">
          <a className="campaign-back" href="./" aria-label="Voltar ao site">
            <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
          </a>
          <Brand compact />
          <div className="campaign-private-meta">
            <span><span className="material-symbols-rounded" aria-hidden="true">lock</span>Campanha privada</span>
            <small>{campaign.deadline}</small>
          </div>
        </div>
      </header>

      {step === "model" ? (
        <main className="campaign-builder">
          <section className="campaign-builder-heading">
            <h1>{campaign.title}</h1>
            <div className="campaign-progress-copy"><strong>1 de 3</strong><span>·</span><span>Modelo</span></div>
            <div className="campaign-progress" aria-hidden="true"><span /></div>
          </section>

          <form className="campaign-configurator" onSubmit={submitConfiguration}>
            <section className="campaign-product-stage">
              <h2>1. Escolha o modelo</h2>

              <div className="campaign-side-switch" role="group" aria-label="Visualizar lado da camiseta">
                <button className={previewSide === "front" ? "is-active" : ""} type="button" aria-pressed={previewSide === "front"} onClick={() => setPreviewSide("front")}>Frente</button>
                <button className={previewSide === "back" ? "is-active" : ""} type="button" aria-pressed={previewSide === "back"} onClick={() => setPreviewSide("back")}>Costas</button>
              </div>
              <p className="fixed-art-label">Arte fixa da campanha</p>

              <div className="campaign-product-preview">
                <img className="campaign-product-main" src={selectedImage} alt={`${selectedModel.name} — ${previewSide === "front" ? "frente" : "costas"}`} />
                <button className="campaign-opposite-view" type="button" onClick={() => setPreviewSide(previewSide === "front" ? "back" : "front")} aria-label={`Ver ${previewSide === "front" ? "costas" : "frente"}`}>
                  <img src={oppositeImage} alt="" />
                  <span>{previewSide === "front" ? "Costas" : "Frente"}</span>
                </button>
              </div>

              <div className="campaign-model-grid" role="radiogroup" aria-label="Modelo da camiseta">
                {shirtModels.map((item) => (
                  <label className={model === item.name ? "is-selected" : ""} key={item.name}>
                    <input type="radio" name="model" checked={model === item.name} onChange={() => selectModel(item.name)} />
                    <span className="campaign-model-check material-symbols-rounded" aria-hidden="true">check</span>
                    <img src={campaign.modelImages?.[item.name]?.front ?? item.image} alt={`Modelo ${item.name}`} />
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                    <b>{campaign.prices[item.name].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b>
                  </label>
                ))}
              </div>
            </section>

            <section className="campaign-choice-stage campaign-color-stage">
              <div className="campaign-stage-heading"><h2>2. Escolha a cor</h2><span>{availableColors.length} {availableColors.length === 1 ? "opção" : "opções"}</span></div>
              <div className="campaign-color-options" role="radiogroup" aria-label={`Cor da camiseta ${selectedModel.name}`}>
                {availableColors.map((item) => (
                  <label className={selectedColor.name === item.name ? "is-selected" : ""} key={item.name}>
                    <input type="radio" name="color" checked={selectedColor.name === item.name} onChange={() => { setColor(item.name); setOrderCopied(false); }} />
                    <i style={{ backgroundColor: item.hex }} />
                    <span>{item.name}</span>
                    <span className="material-symbols-rounded" aria-hidden="true">check</span>
                  </label>
                ))}
              </div>
              <p className="campaign-color-note">A arte permanece fixa; a cor escolhida será aplicada à peça.</p>
            </section>

            <section className="campaign-choice-stage" id="size-guide">
              <div className="campaign-stage-heading">
                <h2>3. Escolha o tamanho</h2>
                <button type="button" onClick={() => setShowSizeGuide((value) => !value)}>Qual o meu tamanho?</button>
              </div>
              <div className="campaign-size-options" role="radiogroup" aria-label="Tamanho da camiseta">
                {sizes.map((item) => (
                  <label className={size === item ? "is-selected" : ""} key={item}>
                    <input type="radio" name="size" checked={size === item} onChange={() => { setSize(item); setOrderCopied(false); }} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
              {showSizeGuide && <p className="campaign-size-help">Compare uma camiseta que veste bem com as medidas informadas pelo representante da turma.</p>}
            </section>

            <section className="campaign-choice-stage campaign-quantity-stage">
              <h2>4. Quantidade</h2>
              <div className="campaign-quantity-picker">
                <button type="button" aria-label="Diminuir quantidade" onClick={() => { setQuantity((value) => Math.max(1, value - 1)); setOrderCopied(false); }}>−</button>
                <output aria-live="polite">{quantity}</output>
                <button type="button" aria-label="Aumentar quantidade" onClick={() => { setQuantity((value) => Math.min(10, value + 1)); setOrderCopied(false); }}>+</button>
              </div>
            </section>

            <aside className="campaign-order-bar">
              <div><small>Total</small><strong>{formattedTotal}</strong></div>
              <p>{quantity} {quantity === 1 ? "camiseta" : "camisetas"} · {selectedColor.name} · {size}</p>
              <button type="submit">Continuar pedido<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
            </aside>
          </form>
        </main>
      ) : step === "details" ? (
        <main className="campaign-checkout">
          <section className="campaign-checkout-heading">
            <h1>Revise e identifique</h1>
            <div className="campaign-progress-copy"><strong>2 de 3</strong><span>·</span><span>Seus dados</span></div>
            <div className="campaign-progress campaign-progress--details" aria-hidden="true"><span /></div>
          </section>

          <form className="campaign-customer-form" onSubmit={submitCustomerDetails}>
            <section className="checkout-order-review" aria-labelledby="order-review-title">
              <h2 id="order-review-title">Seu pedido</h2>
              <div className="checkout-product-row">
                <div className="checkout-shirt-pair" aria-label="Camiseta vista de frente e costas">
                  <img src={selectedFrontImage} alt={`${selectedModel.name} — frente`} />
                  <img src={selectedBackImage} alt={`${selectedModel.name} — costas`} />
                </div>
                <div className="checkout-product-copy">
                  <strong>{selectedModel.name} · {selectedColor.name} · {size} · {quantity} {quantity === 1 ? "unidade" : "unidades"}</strong>
                  <span className="checkout-color-choice"><i style={{ backgroundColor: selectedColor.hex }} />Cor {selectedColor.name} · Arte fixa frente e costas</span>
                  <div className="checkout-pickup"><span className="material-symbols-rounded" aria-hidden="true">person</span><span>Retirada com <b>{campaign.representative}</b></span></div>
                  <div className="checkout-total"><span>Total</span><strong>{formattedTotal}</strong></div>
                </div>
              </div>
              <button className="checkout-edit" type="button" onClick={() => goToStep("model")}>Editar camiseta</button>
            </section>

            <section className="checkout-customer-fields" aria-labelledby="customer-fields-title">
              <h2 id="customer-fields-title">Quem vai retirar?</h2>
              <label>
                <span className="sr-only">Nome completo</span>
                <input name="name" type="text" placeholder="Nome completo" autoComplete="name" minLength={3} value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
              </label>
              <label>
                <span className="sr-only">WhatsApp</span>
                <input name="phone" type="tel" placeholder="WhatsApp" autoComplete="tel" inputMode="tel" minLength={10} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required />
              </label>
              <label>
                <span className="sr-only">E-mail opcional</span>
                <input name="email" type="email" placeholder="E-mail (opcional)" autoComplete="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
              </label>
              <p className="checkout-privacy"><span className="material-symbols-rounded" aria-hidden="true">lock</span>Seus dados serão usados apenas para identificar o pedido.</p>
            </section>

            <button className="checkout-payment-button" type="submit">Ir para pagamento<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
          </form>
        </main>
      ) : step === "payment" ? (
        <main className="campaign-payment">
          <section className="campaign-payment-heading">
            <h1>Como você quer pagar?</h1>
            <div className="campaign-progress-copy"><strong>3 de 3</strong><span>·</span><span>Pagamento</span></div>
            <div className="campaign-progress campaign-progress--payment" aria-hidden="true"><span /></div>
          </section>

          <section className="payment-order-summary" aria-label="Resumo do pedido">
            <div className="payment-shirt-pair" aria-label="Camiseta vista de frente e costas">
              <img src={selectedFrontImage} alt={`${selectedModel.name} — frente`} />
              <img src={selectedBackImage} alt={`${selectedModel.name} — costas`} />
            </div>
            <div className="payment-order-copy">
              <strong>{selectedModel.name} · {selectedColor.name} · {size} · {quantity} {quantity === 1 ? "unidade" : "unidades"}</strong>
              <b>{formattedTotal}</b>
              <button type="button" onClick={() => goToStep("details")}>Revisar pedido</button>
            </div>
          </section>

          <form className="payment-form" onSubmit={submitPayment}>
            {resumePayment && <p className="payment-resume-note"><span className="material-symbols-rounded" aria-hidden="true">replay</span>Retomando o pagamento do pedido <strong>#{resumePayment}</strong>.</p>}
            <h2>Escolha a forma de pagamento</h2>
            <div className="payment-methods" role="radiogroup" aria-label="Forma de pagamento">
              <label className={paymentMethod === "pix" ? "is-selected" : ""}>
                <input type="radio" name="payment-method" value="pix" checked={paymentMethod === "pix"} onChange={() => { setPaymentMethod("pix"); setOrderCopied(false); }} />
                <span className="payment-method-icon material-symbols-rounded" aria-hidden="true">qr_code_2</span>
                <span className="payment-method-copy"><strong>Pix</strong><small>Aprovação rápida</small></span>
                <span className="payment-method-value">À vista · {formattedTotal}</span>
                <span className="payment-method-check material-symbols-rounded" aria-hidden="true">check</span>
              </label>
              <label className={paymentMethod === "card" ? "is-selected" : ""}>
                <input type="radio" name="payment-method" value="card" checked={paymentMethod === "card"} onChange={() => { setPaymentMethod("card"); setOrderCopied(false); }} />
                <span className="payment-method-icon material-symbols-rounded" aria-hidden="true">credit_card</span>
                <span className="payment-method-copy"><strong>Cartão de crédito</strong><small>Pagamento seguro</small></span>
                <span className="payment-method-value">1x de {formattedTotal}</span>
                <span className="payment-method-check material-symbols-rounded" aria-hidden="true">check</span>
              </label>
            </div>

            <dl className="payment-breakdown">
              <div><dt>Camiseta</dt><dd>{formattedTotal}</dd></div>
              <div><dt>Taxa</dt><dd>R$ 0,00</dd></div>
              <div className="payment-breakdown-total"><dt>Total</dt><dd>{formattedTotal}</dd></div>
            </dl>

            <p className="payment-security"><span className="material-symbols-rounded" aria-hidden="true">lock</span>Você será direcionado ao ambiente seguro de pagamento.</p>
            {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
            <button className="payment-submit" type="submit" disabled={submittingOrder}>{submittingOrder ? "Registrando pedido..." : `Continuar com ${paymentMethod === "pix" ? "Pix" : "cartão"}`}<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
          </form>
        </main>
      ) : (
        <main className="campaign-received">
          <section className="received-hero">
            <span className="received-hero-icon material-symbols-rounded" aria-hidden="true">schedule</span>
            <p className="received-eyebrow">Pedido recebido</p>
            <h1>Agora é só aguardar a confirmação.</h1>
            <p className="received-intro">Registramos seu pedido e estamos aguardando o retorno do pagamento.</p>
            <span className="received-status"><span className="material-symbols-rounded" aria-hidden="true">hourglass_top</span>Aguardando confirmação</span>
          </section>

          <div className="received-content">
            <section className="received-order-card" aria-labelledby="received-order-title">
              <header>
                <div>
                  <small>Número do pedido</small>
                  <h2 id="received-order-title">#{orderNumber}</h2>
                </div>
                <button type="button" onClick={copyOrderNumber}>
                  <span className="material-symbols-rounded" aria-hidden="true">content_copy</span>
                  Copiar
                </button>
              </header>

              <div className="received-product-row">
                <div className="received-shirt-pair" aria-label="Camiseta vista de frente e costas">
                  <img src={selectedFrontImage} alt={`${selectedModel.name} — frente`} />
                  <img src={selectedBackImage} alt={`${selectedModel.name} — costas`} />
                </div>
                <div className="received-product-copy">
                  <strong>{selectedModel.name} · {selectedColor.name} · {size}</strong>
                  <span>{quantity} {quantity === 1 ? "unidade" : "unidades"} · Arte fixa frente e costas</span>
                  <dl>
                    <div><dt>Pagamento</dt><dd>{paymentMethod === "pix" ? "Pix" : "Cartão de crédito"}</dd></div>
                    <div><dt>Total</dt><dd>{formattedTotal}</dd></div>
                  </dl>
                </div>
              </div>

              <p className="received-pickup"><span className="material-symbols-rounded" aria-hidden="true">person</span>Retirada com <strong>{campaign.representative}</strong></p>
            </section>

            <aside className="received-next-steps" aria-labelledby="received-next-title">
              <h2 id="received-next-title">Próximos passos</h2>
              <ol>
                <li className="is-complete"><span className="material-symbols-rounded" aria-hidden="true">check</span><div><strong>Pedido criado</strong><small>Seus dados e sua camiseta foram registrados.</small></div></li>
                <li className="is-current"><span className="material-symbols-rounded" aria-hidden="true">hourglass_top</span><div><strong>Confirmação do pagamento</strong><small>O provedor está verificando a transação.</small></div></li>
                <li><span className="material-symbols-rounded" aria-hidden="true">inventory_2</span><div><strong>Envio para produção</strong><small>Acontece somente depois da confirmação.</small></div></li>
              </ol>
              <p className="received-production-note"><span className="material-symbols-rounded" aria-hidden="true">lock</span>Somente pedidos com pagamento confirmado entram na produção.</p>
            </aside>
          </div>

          <div className="received-actions">
            <button className="received-copy-action" type="button" onClick={copyOrderNumber}>Copiar número do pedido<span className="material-symbols-rounded" aria-hidden="true">content_copy</span></button>
            <a className="received-back-action" href={`?rota=acompanhar-pedido&pedido=${orderNumber}`}>Acompanhar pedido</a>
            <p className="received-copy-status" role="status" aria-live="polite">{orderCopied ? "Número do pedido copiado." : "Guarde este número para acompanhar seu pedido."}</p>
          </div>
        </main>
      )}
    </div>
  );
}
