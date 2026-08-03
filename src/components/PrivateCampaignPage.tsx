import { FormEvent, useMemo, useState } from "react";
import type { PrivateCampaign } from "../data";
import { shirtModels } from "../data";
import { Brand } from "./Brand";

const sizes = ["PP", "P", "M", "G", "GG", "XG"];

export function PrivateCampaignPage({ campaign }: { campaign: PrivateCampaign }) {
  const [model, setModel] = useState(shirtModels[0].name);
  const [size, setSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState(false);
  const selectedModel = shirtModels.find((item) => item.name === model) ?? shirtModels[0];
  const total = useMemo(() => campaign.price * quantity, [campaign.price, quantity]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(true);
  }

  return (
    <div className="private-campaign-page">
      <header className="minimal-header"><div className="container"><Brand compact /><span className="private-label"><span className="material-symbols-rounded" aria-hidden="true">lock</span>Campanha privada</span></div></header>
      <main className="private-campaign-layout">
        <aside className="campaign-context">
          <a href="./"><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>Site público</a>
          <span className="kicker">Campanha exclusiva</span>
          <h1>{campaign.title}</h1>
          <dl>
            <div><dt><span className="material-symbols-rounded" aria-hidden="true">calendar_today</span>Prazo</dt><dd>{campaign.deadline}</dd></div>
            <div><dt><span className="material-symbols-rounded" aria-hidden="true">person</span>Representante</dt><dd>{campaign.representative}</dd></div>
            <div><dt><span className="material-symbols-rounded" aria-hidden="true">local_shipping</span>Entrega</dt><dd>{campaign.pickup}</dd></div>
          </dl>
          <p className="secure-note"><span className="material-symbols-rounded" aria-hidden="true">verified_user</span>Você acessou o link exclusivo da sua turma.</p>
        </aside>

        <form className="campaign-order" onSubmit={submit}>
          <section className="order-stage">
            <span className="stage-title">1. Escolha o modelo</span>
            <div className="model-grid">
              {shirtModels.map((item) => (
                <label className={model === item.name ? "is-selected" : ""} key={item.name}>
                  <input type="radio" name="model" checked={model === item.name} onChange={() => setModel(item.name)} />
                  <img src={item.image} alt={`Modelo ${item.name}`} />
                  <strong>{item.name}</strong><small>{item.description}</small>
                </label>
              ))}
            </div>
          </section>

          <section className="order-stage compact-stage"><span className="stage-title">2. Escolha o tamanho</span><a href="#size-guide">Guia de tamanhos</a><div className="size-options">{sizes.map((item) => <label className={size === item ? "is-selected" : ""} key={item}><input type="radio" name="size" checked={size === item} onChange={() => setSize(item)} /><span>{item}</span></label>)}</div></section>
          <section className="order-stage compact-stage"><span className="stage-title">3. Quantidade</span><div className="quantity-picker"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><output>{quantity}</output><button type="button" onClick={() => setQuantity((value) => Math.min(10, value + 1))}>+</button></div></section>

          <aside className="order-summary-card">
            <span className="stage-title">Resumo do pedido</span>
            <div className="summary-product"><img src={selectedModel.image} alt="" /><div><strong>{model}</strong><small>{size}</small><small>Quantidade: {quantity}</small></div></div>
            <dl><div><dt>Subtotal</dt><dd>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd></div><div><dt>Entrega</dt><dd>Grátis</dd></div><div className="summary-total"><dt>Total</dt><dd>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd></div></dl>
            <button className="primary-action" type="submit">Adicionar ao pedido<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
            {notice && <div className="order-notice" role="status"><span className="material-symbols-rounded" aria-hidden="true">check_circle</span><p><strong>Configuração salva.</strong> O cadastro e pagamento serão conectados na próxima etapa.</p></div>}
          </aside>
        </form>
      </main>
    </div>
  );
}
