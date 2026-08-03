import { FormEvent, useMemo, useState } from "react";
import type { PrivateCampaign } from "../data";
import { shirtModels } from "../data";
import { Brand } from "./Brand";

type PrivateCampaignPageProps = {
  campaign: PrivateCampaign;
};

const sizes = ["PP", "P", "M", "G", "GG", "XG"];

export function PrivateCampaignPage({ campaign }: PrivateCampaignPageProps) {
  const [model, setModel] = useState(shirtModels[0].name);
  const [size, setSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState(false);
  const selectedModel = shirtModels.find((item) => item.name === model) ?? shirtModels[0];
  const total = useMemo(() => campaign.price * quantity, [campaign.price, quantity]);

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(true);
  }

  return (
    <div className="private-page">
      <header className="private-header">
        <div className="container private-header-inner">
          <Brand compact />
          <span><span className="material-symbols-rounded" aria-hidden="true">lock</span> Campanha privada</span>
        </div>
      </header>
      <main className="container private-main">
        <a className="back-link" href="./"><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>Voltar ao site</a>
        <div className="private-intro">
          <div>
            <span className="private-badge"><i /> Acesso exclusivo confirmado</span>
            <h1>{campaign.title}</h1>
            <p>{campaign.subtitle}</p>
          </div>
          <div className="campaign-deadline">
            <span className="material-symbols-rounded" aria-hidden="true">schedule</span>
            <div><small>Prazo da campanha</small><strong>{campaign.deadline}</strong></div>
          </div>
        </div>

        <div className="order-layout">
          <section className="product-preview">
            <div className="product-image"><img src={selectedModel.image} alt={`Camisa ${model} da campanha ${campaign.title}`} /></div>
            <div className="product-thumbs" aria-label="Escolha um modelo">
              {shirtModels.map((item) => (
                <button className={model === item.name ? "is-selected" : ""} onClick={() => setModel(item.name)} type="button" key={item.name}>
                  <img src={item.image} alt="" /><span>{item.name}</span>
                </button>
              ))}
            </div>
          </section>

          <form className="order-card" onSubmit={submitOrder}>
            <span className="order-kicker">Pedido individual</span>
            <h2>Monte sua camisa</h2>
            <p className="order-price"><strong>{campaign.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong><span>por unidade</span></p>

            <fieldset>
              <legend>1. Escolha o modelo</legend>
              <div className="choice-row">
                {shirtModels.map((item) => (
                  <label className={model === item.name ? "is-selected" : ""} key={item.name}>
                    <input type="radio" name="model" value={item.name} checked={model === item.name} onChange={() => setModel(item.name)} />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>2. Escolha o tamanho</legend>
              <div className="size-row">
                {sizes.map((item) => (
                  <label className={size === item ? "is-selected" : ""} key={item}>
                    <input type="radio" name="size" value={item} checked={size === item} onChange={() => setSize(item)} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>3. Quantidade</legend>
              <div className="quantity-control">
                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Diminuir quantidade">−</button>
                <output>{quantity}</output>
                <button type="button" onClick={() => setQuantity((value) => Math.min(10, value + 1))} aria-label="Aumentar quantidade">+</button>
              </div>
            </fieldset>

            <div className="order-summary"><span>Total</span><strong>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
            <button className="button button--primary order-button" type="submit">Continuar pedido<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
            {notice && <div className="prototype-notice" role="status"><span className="material-symbols-rounded" aria-hidden="true">info</span><p><strong>Fluxo demonstrativo concluído.</strong> O cadastro e o pagamento serão conectados ao backend na próxima etapa.</p></div>}
          </form>
        </div>

        <section className="private-info">
          <div><span className="material-symbols-rounded" aria-hidden="true">person</span><small>Representante</small><strong>{campaign.representative}</strong></div>
          <div><span className="material-symbols-rounded" aria-hidden="true">local_shipping</span><small>Entrega</small><strong>{campaign.pickup}</strong></div>
          <div><span className="material-symbols-rounded" aria-hidden="true">verified_user</span><small>Privacidade</small><strong>Link exclusivo da turma</strong></div>
        </section>
      </main>
    </div>
  );
}
