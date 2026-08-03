import { FormEvent, useState } from "react";
import { Header } from "./Header";
import { Brand } from "./Brand";
import {
  privateCodeAliases,
  shirtModels,
  showcaseCampaigns,
  whatsappCampaignUrl,
} from "../data";

type LandingPageProps = {
  invalidCampaignCode?: string;
};

const steps = [
  {
    number: "01",
    icon: "forum",
    title: "O representante fala com a gente",
    text: "A turma escolhe um representante, que apresenta a ideia e combina os detalhes da campanha pelo WhatsApp.",
  },
  {
    number: "02",
    icon: "design_services",
    title: "Criamos a campanha exclusiva",
    text: "A Camisaria Mendes prepara a arte, os modelos e uma página privada para receber os pedidos daquela turma.",
  },
  {
    number: "03",
    icon: "qr_code_2",
    title: "A turma recebe o acesso",
    text: "O representante compartilha o link, o código ou o QR Code somente com os alunos participantes.",
  },
  {
    number: "04",
    icon: "checkroom",
    title: "Produzimos e entregamos",
    text: "Após o encerramento dos pedidos, as peças seguem para produção e são entregues conforme o combinado.",
  },
];

export function LandingPage({ invalidCampaignCode }: LandingPageProps) {
  const [code, setCode] = useState(invalidCampaignCode ?? "");
  const [error, setError] = useState(
    invalidCampaignCode
      ? "Não encontramos uma campanha com esse código. Confira e tente novamente."
      : "",
  );

  function accessCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/\s+/g, "-");
    const campaignCode = privateCodeAliases[normalized];

    if (!campaignCode) {
      setError("Código não encontrado. Verifique com o representante da sua turma.");
      return;
    }

    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("campanha", campaignCode);
    window.location.assign(url.toString());
  }

  return (
    <>
      <Header />
      <main>
        <section className="hero" id="inicio">
          <div className="hero-glow" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><i /> Campanhas exclusivas para turmas</span>
              <h1>
                A camisa que conta a <em>história da sua turma.</em>
              </h1>
              <p>
                Criamos campanhas fechadas para cursos, formandos e eventos. Cada turma recebe seu próprio link, código e QR Code para fazer os pedidos com segurança.
              </p>
              <div className="hero-actions">
                <a className="button button--primary" href="#faca-sua-campanha">
                  Criar uma campanha
                  <span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
                </a>
                <a className="text-link" href="#mostruario">Conhecer nossos trabalhos</a>
              </div>
              <div className="trust-row" aria-label="Diferenciais">
                <span><b>+200</b> turmas atendidas</span>
                <span><b>5.000+</b> histórias vestidas</span>
              </div>
            </div>

            <div className="hero-showcase" aria-label="Modelos de camisa disponíveis">
              <span className="hero-stamp">Feito para<br /><strong>a sua turma</strong></span>
              {shirtModels.map((model, index) => (
                <article className={`shirt-card shirt-card--${index + 1}`} key={model.name}>
                  <img src={model.image} alt={`Camisa modelo ${model.name}`} />
                  <div><strong>{model.name}</strong><small>{model.description}</small></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="access-strip" id="acessar-campanha">
          <div className="container access-grid">
            <div className="access-copy">
              <span className="access-icon material-symbols-rounded" aria-hidden="true">key</span>
              <div>
                <span className="section-kicker">Já recebeu seu acesso?</span>
                <h2>Entre na campanha da sua turma</h2>
                <p>Use o código enviado pelo representante. As campanhas não aparecem publicamente.</p>
              </div>
            </div>
            <form className="code-form" onSubmit={accessCampaign} noValidate>
              <label htmlFor="campaign-code">Código da campanha</label>
              <div className="code-field">
                <input
                  id="campaign-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError("");
                  }}
                  placeholder="Ex.: MENDES-ENG-26"
                  autoComplete="off"
                  aria-describedby={error ? "code-error" : undefined}
                  aria-invalid={Boolean(error)}
                />
                <button type="submit" aria-label="Acessar campanha">
                  Acessar
                  <span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
                </button>
              </div>
              {error && <p className="field-error" id="code-error" role="alert">{error}</p>}
              <small>Para testar o protótipo: <button type="button" onClick={() => setCode("MENDES-ENG-26")}>usar MENDES-ENG-26</button></small>
            </form>
          </div>
        </section>

        <section className="section showcase-section" id="mostruario">
          <div className="container">
            <div className="section-heading section-heading--split">
              <div>
                <span className="section-kicker">Nosso mostruário</span>
                <h2>Campanhas que já ganharam vida</h2>
              </div>
              <p>Uma seleção de projetos concluídos. As páginas de compra ficam disponíveis somente durante cada campanha e por acesso privado.</p>
            </div>
            <div className="showcase-grid">
              {showcaseCampaigns.map((campaign) => (
                <article className="showcase-card" key={campaign.course}>
                  <div className="showcase-image">
                    <img src={campaign.image} alt={`Camisa da campanha de ${campaign.course}`} />
                    <span><i /> Projeto concluído</span>
                  </div>
                  <div className="showcase-content">
                    <div className="showcase-meta"><span>{campaign.group}</span><time>{campaign.year}</time></div>
                    <h3>{campaign.course}</h3>
                    <p>{campaign.description}</p>
                    <strong className="showcase-quantity"><span className="material-symbols-rounded" aria-hidden="true">groups</span>{campaign.quantity}</strong>
                  </div>
                </article>
              ))}
            </div>
            <p className="privacy-note"><span className="material-symbols-rounded" aria-hidden="true">lock</span> Este é apenas o nosso portfólio. Nenhuma campanha ativa ou página de compra é exibida publicamente.</p>
          </div>
        </section>

        <section className="section how-section" id="como-funciona">
          <div className="container">
            <div className="section-heading centered">
              <span className="section-kicker">Do primeiro contato à entrega</span>
              <h2>Como uma campanha funciona</h2>
              <p>Um processo simples, organizado e exclusivo para cada turma.</p>
            </div>
            <div className="steps-grid">
              {steps.map((step) => (
                <article className="step-card" key={step.number}>
                  <span className="step-number">{step.number}</span>
                  <span className="step-icon material-symbols-rounded" aria-hidden="true">{step.icon}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section about-section" id="sobre">
          <div className="container about-grid">
            <div className="about-visual">
              <div className="about-mark">M<span>DS</span></div>
              <div className="about-stat"><strong>Desde 2018</strong><span>transformando ideias em peças que representam</span></div>
            </div>
            <div className="about-copy">
              <span className="section-kicker">Sobre nós</span>
              <h2>Mais do que camisas. Criamos símbolos de pertencimento.</h2>
              <p>A Camisaria Mendes nasceu para transformar a identidade de cada turma em uma peça única. Trabalhamos junto aos representantes desde a primeira ideia até a entrega final.</p>
              <p>Cada campanha é planejada de forma exclusiva: arte, modelos, organização dos pedidos e comunicação em um só fluxo — sem expor a compra para quem não faz parte da turma.</p>
              <ul className="check-list">
                <li><span className="material-symbols-rounded" aria-hidden="true">check</span>Atendimento próximo ao representante</li>
                <li><span className="material-symbols-rounded" aria-hidden="true">check</span>Artes desenvolvidas para cada turma</li>
                <li><span className="material-symbols-rounded" aria-hidden="true">check</span>Campanhas privadas e organizadas</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="campaign-cta" id="faca-sua-campanha">
          <div className="container campaign-cta-grid">
            <div>
              <span className="section-kicker section-kicker--light">Para representantes de turma</span>
              <h2>Leve uma campanha exclusiva para sua turma.</h2>
              <p>Chame a Camisaria Mendes no WhatsApp, conte sua ideia e informe o curso, a turma e a quantidade aproximada de alunos. Nós ajudamos no restante.</p>
            </div>
            <div className="cta-card">
              <span className="material-symbols-rounded" aria-hidden="true">chat</span>
              <div><small>Primeiro passo</small><strong>Fale com nosso atendimento</strong><p>Você receberá as orientações para iniciar a campanha.</p></div>
              <a href={whatsappCampaignUrl} target="_blank" rel="noreferrer">
                Conversar pelo WhatsApp
                <span className="material-symbols-rounded" aria-hidden="true">open_in_new</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <Brand />
          <div className="footer-links">
            <a href="#mostruario">Mostruário</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#sobre">Sobre nós</a>
            <a href="#faca-sua-campanha">Faça sua campanha</a>
          </div>
          <p>© 2026 Camisaria Mendes.<br />Todos os direitos reservados.</p>
        </div>
      </footer>
    </>
  );
}
