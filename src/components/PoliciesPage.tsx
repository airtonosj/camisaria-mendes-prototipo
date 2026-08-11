import { buildRoute } from "../App";
import { whatsappCampaignUrl } from "../data";
import { Brand } from "./Brand";

export type PolicyKind = "privacy" | "exchanges" | "support";

const updatedAt = "11 de agosto de 2026";
const whatsappSupportUrl = whatsappCampaignUrl.replace(
  /text=[^&]*/,
  "text=Ol%C3%A1%2C%20preciso%20de%20atendimento%20sobre%20um%20pedido%20da%20Camisaria%20Mendes.",
);

const policyMeta: Record<PolicyKind, { kicker: string; title: string; introduction: string }> = {
  privacy: {
    kicker: "Transparência e LGPD",
    title: "Política de privacidade",
    introduction: "Este aviso explica, em linguagem direta, quais dados usamos para receber, confirmar, produzir e entregar os pedidos da Camisaria Mendes.",
  },
  exchanges: {
    kicker: "Compras pela internet",
    title: "Política de troca, cancelamento e reembolso",
    introduction: "Estas regras organizam solicitações de ajuste, desistência, defeito, cancelamento e devolução de valores sem reduzir os direitos garantidos pelo Código de Defesa do Consumidor.",
  },
  support: {
    kicker: "Fale com a camisaria",
    title: "Política de atendimento",
    introduction: "O atendimento identifica cada solicitação pelo código do pedido e acompanha o caso até uma resposta conclusiva.",
  },
};

function PrivacyPolicy() {
  return (
    <>
      <section><h2>1. Quem trata os dados</h2><p>A Camisaria Mendes é responsável pelos dados usados neste site e no atendimento dos pedidos. Solicitações sobre privacidade podem ser enviadas pelo canal de atendimento indicado nesta página.</p></section>
      <section><h2>2. Dados utilizados</h2><p>Tratamos nome, WhatsApp, e-mail, código do pedido, campanha, modelo, cor, tamanho, quantidade, valor e situação de pagamento e entrega. O servidor também pode registrar endereço IP, data, horário e informações técnicas necessárias à segurança e ao diagnóstico.</p></section>
      <section><h2>3. Para que usamos</h2><p>Os dados são usados para executar a compra, identificar o pagamento, enviar confirmação, produzir e entregar as camisetas, permitir o acompanhamento, prestar atendimento, prevenir fraude e cumprir obrigações legais e contábeis.</p></section>
      <section><h2>4. Compartilhamento</h2><p>Compartilhamos somente o necessário com a InfinitePay para processar Pix ou cartão, com serviços de hospedagem e e-mail e, quando necessário à retirada, com o representante responsável pela campanha. Não vendemos dados pessoais.</p></section>
      <section><h2>5. Guarda e segurança</h2><p>Os registros são mantidos pelo tempo necessário à operação, à defesa de direitos e às obrigações legais. Aplicamos controle de acesso, conexão segura, registros de operação e backups; nenhum sistema, porém, elimina integralmente todos os riscos.</p></section>
      <section><h2>6. Direitos do titular</h2><p>Você pode pedir confirmação de tratamento, acesso, correção, informações sobre compartilhamento e, quando aplicável, oposição, revogação ou eliminação. Podemos conservar dados quando houver obrigação legal ou necessidade legítima de defesa de direitos.</p></section>
    </>
  );
}

function ExchangePolicy() {
  return (
    <>
      <section><h2>1. Antes do encerramento da campanha</h2><p>Peça correções de modelo, cor ou tamanho assim que perceber o erro. Enquanto a campanha ainda recebe pedidos e a produção não começou, a camisaria verificará a alteração sem custo, conforme disponibilidade.</p></section>
      <section><h2>2. Direito de arrependimento</h2><p>Compras realizadas fora do estabelecimento podem ser canceladas no prazo legal de 7 dias, contado da contratação ou do recebimento, conforme o caso. A solicitação deve identificar o pedido; os valores pagos serão devolvidos pelo meio operacional disponível.</p></section>
      <section><h2>3. Produto personalizado e produção coletiva</h2><p>As camisetas são produzidas para uma campanha específica. Depois do início da produção, trocas por preferência de tamanho, modelo ou cor dependem de disponibilidade. Isso não afasta o direito de arrependimento aplicável nem os direitos relacionados a defeito, erro da camisaria ou oferta descumprida.</p></section>
      <section><h2>4. Defeito ou divergência</h2><p>Envie o código do pedido, a descrição do problema e fotos que permitam a análise. A camisaria orientará correção, troca, nova produção, abatimento ou reembolso conforme a situação e os prazos legais.</p></section>
      <section><h2>5. Reembolso</h2><p>O estorno é solicitado pela camisaria na InfinitePay. Em Pix, o prazo depende da conclusão do procedimento financeiro; no cartão, o crédito pode aparecer conforme o ciclo e as regras do banco emissor. A camisaria registra a referência do estorno e mantém o pedido consultável como cancelado.</p></section>
    </>
  );
}

function SupportPolicy() {
  return (
    <>
      <section><h2>1. Canal oficial</h2><p>O atendimento ao cliente é realizado pelo WhatsApp oficial da Camisaria Mendes. Nunca envie senha, código de autenticação ou dados completos do cartão.</p></section>
      <section><h2>2. Como abrir uma solicitação</h2><p>Informe o código do pedido, o WhatsApp usado na compra e um resumo objetivo. Para troca ou defeito, anexe fotos; para pagamento, envie apenas o comprovante permitido, sem expor dados financeiros desnecessários.</p></section>
      <section><h2>3. Acompanhamento</h2><p>Pedidos também podem ser consultados pelo código e WhatsApp na página de acompanhamento. Casos de pagamento, cancelamento, reembolso ou divergência de produção recebem análise individual e resposta pelo canal oficial.</p></section>
      <section><h2>4. Privacidade no atendimento</h2><p>Usamos as informações recebidas para localizar e resolver a solicitação. O titular pode exercer seus direitos de privacidade pelo mesmo canal, identificando o pedido ou a relação mantida com a camisaria.</p></section>
    </>
  );
}

export function PoliciesPage({ kind }: { kind: PolicyKind }) {
  const meta = policyMeta[kind];
  return (
    <div className="policy-page">
      <header className="policy-header">
        <a href={buildRoute()} aria-label="Voltar ao início"><Brand compact /></a>
        <a href={buildRoute()}>Voltar ao site</a>
      </header>
      <main className="policy-main">
        <div className="policy-intro"><span className="kicker">{meta.kicker}</span><h1>{meta.title}</h1><p>{meta.introduction}</p><small>Última atualização: {updatedAt}</small></div>
        <nav className="policy-tabs" aria-label="Políticas da Camisaria Mendes">
          <a className={kind === "privacy" ? "is-active" : ""} href={buildRoute("politica-privacidade")}>Privacidade</a>
          <a className={kind === "exchanges" ? "is-active" : ""} href={buildRoute("politica-trocas")}>Trocas e reembolso</a>
          <a className={kind === "support" ? "is-active" : ""} href={buildRoute("politica-atendimento")}>Atendimento</a>
        </nav>
        <article className="policy-content">
          {kind === "privacy" ? <PrivacyPolicy /> : kind === "exchanges" ? <ExchangePolicy /> : <SupportPolicy />}
        </article>
        <aside className="policy-contact"><div><span className="material-symbols-rounded" aria-hidden="true">support_agent</span><div><strong>Precisa falar sobre um pedido?</strong><p>Tenha em mãos o código da compra e o WhatsApp informado no checkout.</p></div></div><a href={whatsappSupportUrl} target="_blank" rel="noreferrer">Abrir atendimento no WhatsApp</a></aside>
      </main>
    </div>
  );
}
