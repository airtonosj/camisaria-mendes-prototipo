# Camisaria Mendes — Protótipo de campanhas privadas

Protótipo responsivo desenvolvido com React, TypeScript, CSS e Vite.

## Fluxos demonstrados

- Landing page institucional;
- Mostruário público apenas com campanhas concluídas;
- Acesso a campanhas ativas por código, link direto ou QR Code;
- Página privada para escolha de modelo, tamanho e quantidade;
- Consulta do andamento do pedido pelo número e WhatsApp;
- Orientações para representantes criarem campanhas pelo WhatsApp;
- Área interna reservada em `/acesso-camisaria/`, sem link na navegação pública.

Em desenvolvimento, use o código `MENDES-ENG-26` para testar a campanha de Engenharia ou `MENDES-ADS-26` para testar a campanha criada pelo painel. No site publicado, quem valida o código é o servidor: só existem as campanhas criadas no painel.

### Cortes, tamanhos e preços

Existem dois cortes: `Comum` e `Oversized`. **Baby look é tamanho, não corte** — os tamanhos vão de `PP` a `XG` no grupo tradicional e de `PPB` a `XGB` no grupo baby look.

Ao criar a campanha, a camisaria escolhe quais tamanhos libera para cada corte. A seleção já vem pré-marcada (Comum com tradicional e baby look, Oversized só com tradicional), então basta desmarcar o que a turma não vai pedir.

O preço é definido por corte e vale para todos os tamanhos dele, inclusive os baby look. O seletor do aluno atualiza o total conforme o corte escolhido, e ele só vê os tamanhos que a campanha liberou.

### Arte da campanha

A camisaria envia **uma imagem só**, que vale para todos os cortes e tamanhos. A imagem de costas é opcional: sem ela, o aluno vê apenas a frente e o alternador frente/costas não aparece.

- Formatos aceitos: `PNG`, `JPG`/`JPEG` e `WEBP`;
- Tamanho máximo: `2 MB` por arquivo;
- Dimensão recomendada: `1200 × 1500 px`;
- Dimensão mínima aceita: `600 × 800 px`;
- Proporção recomendada: próxima de `4:5`;
- Enquadramento: peça centralizada, sem cortar mangas, gola ou barra;
- Fundo: neutro ou transparente, com boa diferença de cor em relação à camiseta.

A API recebe o arquivo em `POST /api/admin/uploads`, confere a assinatura da imagem, grava em `uploads/` e guarda apenas a URL na campanha.

### Pagamento

O checkout do aluno oferece **Pix e cartão de crédito pela InfinitePay**. O pedido nasce pendente e só entra na produção depois da confirmação automática do provedor; não existe mais chave Pix fixa, envio de comprovante ou botão de confirmação manual no painel.

O limite atual é explícito: a tela está pronta, mas ainda faltam as rotas que criam o link em `POST https://api.checkout.infinitepay.io/links`, recebem o webhook e validam o retorno com `payment_check`. Até isso ser concluído, `INFINITEPAY_CHECKOUT_ENABLED=false` impede um deploy de produção incompleto.

`PAYMENT_PROVIDER=infinitepay` e `INFINITEPAY_HANDLE` preparam a conta. O número interno do pedido será enviado como `order_nsu`; redirecionamento do navegador nunca será aceito como prova de pagamento.

### Acesso da equipe

O acesso inicial da camisaria é criado no servidor com `npm run user:admin`: `gustavo@mendes` com a senha provisória `changeme`, marcada para troca obrigatória no primeiro acesso. Enquanto ela não for trocada, o painel abre direto na seção **Conta** e não libera o resto.

Na seção **Conta**, a camisaria troca o próprio nome, e-mail e senha. A tela de acesso tem **Esqueci minha senha**, que envia um link válido por uma hora quando há SMTP configurado; sem SMTP, quem administra o servidor gera o link com `npm run user:reset -- email@dominio`.

> Em desenvolvimento (`npm run dev`), o projeto ainda carrega campanhas e pedidos fictícios e mostra as credenciais de demonstração na tela de acesso. **Nada disso existe no build de produção**: com a API fora do ar, o site publicado mostra erro com "tentar novamente", nunca dados inventados.

## Fundação do backend

A base persistente usa API Node.js e MySQL 8. Ela define campanhas, cortes, cores, catálogo de tamanhos, pedidos, pagamentos, histórico de mudança de fase e as consultas dos dois relatórios operacionais.

Estão ligadas ao banco as telas do aluno (abrir a campanha pelo código, montar o pedido, registrar e acompanhar) e o painel da camisaria (criar campanha com upload da arte, acompanhar pagamentos, avançar e retornar a fase, relatórios de produção e entrega).

O painel exige login com sessão no servidor.

Em produção, a API falha antes de abrir a porta quando faltam configurações críticas. O
painel aceita apenas contas da Camisaria, a chave administrativa estática fica desabilitada
por padrão e as artes usam um caminho persistente definido por `UPLOADS_DIR`.

Consulte [docs/backend-mysql.md](docs/backend-mysql.md) para preparar o banco e executar a API, e [docs/deploy.md](docs/deploy.md) para publicar na Hostinger.
O procedimento de release, backup, health check e rollback fica em [docs/runbook-operacional.md](docs/runbook-operacional.md).
Para homologar função por função, use [docs/checklist-validacao-manual.md](docs/checklist-validacao-manual.md).

## Executar localmente

```bash
npm install
npm run dev
```

No Windows, depois de instalar as dependências e configurar o `.env`, também é possível
dar dois cliques em `INICIAR_SITE.bat`. Ele sobe API e frontend, evita processos duplicados,
aguarda o health check e abre o site no navegador.

## Gerar a versão de publicação

```bash
npm run build
```

## Validar a operação local

```bash
npm test
```

O comando usa um banco separado terminado em `_test` e valida os fluxos críticos sem
alterar pedidos, campanhas ou usuários do banco principal. A integração com provedor de
pagamento/webhook permanece fora desta etapa.
