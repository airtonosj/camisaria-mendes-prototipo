import { FormEvent, useState } from "react";
import { buildRoute } from "../App";
import { privateCodeAliases, shirtModels, showcaseCampaigns, whatsappCampaignUrl } from "../data";
import { Brand } from "./Brand";
import { Header } from "./Header";

const steps = [
  ["01", "chat", "O representante entra em contato", "Fala com a gente pelo WhatsApp e conta a ideia da turma."],
  ["02", "edit_square", "A Camisaria cria e abre a campanha", "Desenvolvemos a arte e abrimos a campanha privada só para a turma."],
  ["03", "share", "Você compartilha o acesso", "Recebe um link, código ou QR Code para divulgar entre os colegas."],
  ["04", "checkroom", "Pedidos vão para produção e entrega", "Após o prazo, os pedidos seguem para produção e chegam na sua turma."],
];

const portfolioCampaigns = [showcaseCampaigns[1], showcaseCampaigns[2], showcaseCampaigns[0], showcaseCampaigns[3]];

export function LandingPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function openCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/\s+/g, "-");
    const campaign = privateCodeAliases[normalized];
    if (!campaign) {
      setError("Confira o código com o representante da turma.");
      return;
    }
    window.location.assign(buildRoute(undefined, campaign));
  }

  return (
    <>
      <Header />
      <main>
        <section className="editorial-hero" id="inicio">
          <div className="container editorial-hero-grid">
            <div className="hero-editorial-copy">
              <span className="kicker">Camisetas que representam sua história</span>
              <h1>A camisa da<br />sua turma,<br /><em>do seu jeito.</em></h1>
              <p>Mais que uma camiseta.<br />Um símbolo do que vocês vivem juntos.</p>
              <a className="editorial-link" href="#mostruario">Conheça nosso trabalho<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a>
            </div>
            <div className="hero-products" aria-label="Modelos de camisa da Camisaria Mendes">
              {shirtModels.map((model, index) => (
                <figure className={`hero-product hero-product--${index + 1}`} key={model.name}>
                  <img src={model.image} alt={`Camisa ${model.name}`} />
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="mobile-code-panel">
          <div className="container code-panel-grid">
            <div>
              <h2>Já recebeu o acesso da sua turma?</h2>
              <p>Campanhas ativas não são listadas publicamente.</p>
            </div>
            <form onSubmit={openCampaign}>
              <label htmlFor="landing-code">Código da campanha</label>
              <div><input id="landing-code" placeholder="Digite o código da campanha" value={code} onChange={(event) => { setCode(event.target.value); setError(""); }} /><button type="submit">Acessar campanha<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button></div>
              {error && <small role="alert">{error}</small>}
            </form>
          </div>
        </section>

        <section className="portfolio-section" id="mostruario">
          <div className="container">
            <div className="editorial-heading">
              <div><span className="kicker">Mostruário</span><h2>Campanhas que<br />já vestimos.</h2></div>
              <a className="portfolio-all" href="#mostruario">Ver todas as campanhas<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a>
            </div>
            <div className="portfolio-grid">
              {portfolioCampaigns.map((campaign) => (
                <article className="portfolio-item" key={campaign.course}>
                  <div className="portfolio-image"><img src={campaign.image} alt={`Projeto concluído de ${campaign.course}`} /></div>
                  <div className="portfolio-title"><div><h3>{campaign.course}</h3><small>{campaign.group} <i>•</i> {campaign.year}</small></div></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="process-section" id="como-funciona">
          <div className="container">
            <div className="process-grid">
              <div className="process-heading">
                <span className="kicker">Como funciona</span>
                <h2>Simples, do<br />primeiro contato<br />à entrega.</h2>
              </div>
              {steps.map(([number, icon, title, text]) => (
                <article className="process-step" key={number}>
                  <span className="process-number">{number}</span>
                  <span className="process-icon material-symbols-rounded" aria-hidden="true">{icon}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="about-editorial" id="sobre">
          <div className="container about-editorial-grid">
            <div className="about-story">
              <Brand compact />
              <strong className="about-since">Desde 2018</strong>
              <p>A Camisaria Mendes nasceu para transformar ideias de turma em camisetas que viram história. Do primeiro rascunho à entrega, cuidamos de cada detalhe com qualidade, prazo e atenção de verdade.</p>
            </div>
            <div className="about-message">
              <h2>Criamos símbolos<br />de pertencimento.</h2>
              <p>Cada turma tem uma história única. Nosso trabalho é dar forma a essa história com camisetas que unem identidade, qualidade e propósito.</p>
              <p>Mais que roupas, criamos símbolos do que vocês vivem juntos.</p>
            </div>
          </div>
        </section>

        <section className="representative-cta" id="faca-sua-campanha">
          <div className="container representative-grid">
            <div className="representative-copy">
              <span className="kicker">Para representantes de turma</span>
              <h2>Vamos criar a campanha de vocês?</h2>
              <p>Chama a gente no WhatsApp e dá o primeiro passo.<br />É rápido, fácil e do jeito da sua turma.</p>
            </div>
            <a className="representative-button" href={whatsappCampaignUrl} target="_blank" rel="noreferrer">
              <span className="material-symbols-rounded" aria-hidden="true">chat</span>
              <strong>Falar pelo WhatsApp</strong>
              <span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
            </a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <Brand compact />
          <nav aria-label="Navegação do rodapé">
            <a href="#inicio">Início</a>
            <a href="#mostruario">Mostruário</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#sobre">Sobre nós</a>
            <a href="#faca-sua-campanha">Faça sua campanha</a>
          </nav>
          <div className="footer-meta">
            <p className="footer-legal">© 2018–2026 Camisaria Mendes. Todos os direitos reservados.</p>
            <p className="footer-tagline">Camisetas que representam sua história.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
