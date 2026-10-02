# Estado atual

## Referência

- Base: `95a005788b7d53282529b23c44d9c000c7768c63`; árvore inicialmente limpa.
- Implementação registrada em `35be302`, após autorização específica. A correção do relatório de entrega em `3158dcb` permanece no histórico; sua correção complementar de collation e testes integra `35be302`. Push e deploy não realizados por este chat.
- Schema: migrações 001–024 preservadas.
- Produção: versão não verificada nesta reorganização.
- Hospedagem principal: Hostinger Node.js Web App.

## Continuidade

As oito áreas do plano foram implementadas localmente. Consulte [validação](refatoracao-validacao.md), [inventário](inventario.md) e [arquitetura](arquitetura.md) para alterações, evidências e limites. A verificação consolidada local de 29/09 passou, incluindo a correção do relatório de entrega. Resultados e limites estão registrados abaixo.

## Próxima ação

Após os commits locais autorizados, o próximo passo é push especificamente autorizado e acompanhamento da CI. Qualquer nova alteração de código exige as verificações correspondentes. Publicação exige identificar a versão anterior, backup e validar o artefato conforme o [checklist](checklist-release.md). Documentos em `historico/` não comprovam o estado publicado.

## Verificação em 28/09/2026

- Primeira execução completa de `check:release`: aprovada, com 20 testes unitários, quatro suítes de integração, build e 12 jornadas desktop/celular.
- Após o ajuste visual do campo WhatsApp na retomada: tipos, lint, 20 testes unitários, quatro integrações e build aprovados novamente.
- A repetição das jornadas completas foi interrompida pela preparação concorrente do mesmo ambiente E2E. O usuário confirmou outro chat ativo no relatório de entrega. Seus processos foram preservados.
- Checkout, retomada e consulta foram então verificados em banco próprio `camisaria_resume_final_e2e_test` e portas 4286/4287: duas jornadas aprovadas. Capturas desktop/celular inspecionadas com o campo alinhado ao padrão visual.
- `git diff --check`: sem erros de whitespace. Métricas atualizadas em `qa-evidence/structure/performance.json`.
- GitHub Actions/Node 22 e produção continuam sem verificação. Não houve commit, push ou deploy.
## Fechamento consolidado em 29/09/2026

- `npm.cmd run check:release`: aprovado, sem outra suíte simultânea. Tipos, lint, 20 testes unitários, cinco integrações, build/verificação dos artefatos e 14 jornadas desktop/celular.
- O primeiro ensaio identificou uma disputa no próprio smoke: ele alterava o contador de tentativas enquanto o worker podia estar processando o evento. A preparação agora espera a tentativa terminar e o evento voltar à fila antes de configurar a última tentativa. O limite e as regras do worker não mudaram.
- O novo teste de collation da entrega agora recria seu banco antes de usar a tabela temporária. Após esse ajuste, passou isoladamente, seguido de lint; não depende de smoke anterior.
- A regressão de relatório verifica confirmação persistida, histórico único e estado após recarregar a página, inclusive quando a atualização do relatório falha.
- Artefato local: commit `3158dcb2b413653cb20e4b7d4969011db9c0ab40`, `dirty=true`, build `2026-09-29T17:23:05.058Z`. Identifica a origem e alterações locais, não uma versão publicada.
- JavaScript inicial gzip: 71.959 B; redução conservadora de 45,24%. Evidência atualizada em `qa-evidence/structure/performance.json`.
- CI/Node 22 e produção permanecem não verificados. Este chat não realizou commit, push, deploy, compra ou envio real.
## Preparação para revisão

Revisão por módulos e divisão proposta registradas em [revisão para commit](revisao-para-commit.md). O manifesto inclui os arquivos novos e hashes do conteúdo local. Índice preservado; commits e push ainda dependem de autorização específica.


## Prévia do link da campanha (30/09/2026)

- O HTML servido para `/?campanha=<código>` recebe `og:*` e `twitter:card` antes do React, para o WhatsApp exibir título, descrição e foto.
- `og:image` aponta para `/compartilhar/<código>.jpg?v=<início do arquivo>`: JPEG 1200×630 opaco (fundo branco), gerado pelo `sharp` a partir da primeira foto real ou, na falta dela, da arte frontal. Só aceita arquivos de `/uploads` deste servidor.
- Cache regenerável em `UPLOADS_DIR/.tmp/share-preview`, fora do backup. Trocar a foto muda o `v` e força o WhatsApp a buscar a nova.
- `sharp` passou de devDependency para dependency. Campanha inexistente ou banco indisponível mantêm o HTML original.
- Testes: `tests/unit/campaign-preview.test.mjs` e `tests/e2e/campaign-preview.spec.mjs`.

## Recebedores de pagamento por campanha (30/09/2026)

- Migração `025_campaign_receivers`: tabela `payment_receivers` (nome, e-mail, telefone, InfiniteTag única, ativo), `campaigns.receiver_id` e `payment_checkouts.handle`. Reexecutável: as colunas só são criadas se faltarem.
- Recebedor não entra no painel; é só a conta InfinitePay de destino. Cadastro no cartão "Recebedores de pagamento" da aba Conta (`src/features/account/PaymentReceivers.tsx`), rotas `GET/POST /api/admin/receivers` e `PATCH /api/admin/receivers/:id`, todas com `requireStaff`. Sem exclusão; desativar só impede novas escolhas.
- A InfiniteTag é digitada após um `$` fixo e formatada por `shared/receiver.mjs` (minúsculas, sem acento, espaço nem `$`), na tela e no servidor. Salvar pede confirmação da tag final.
- Campanha escolhe o recebedor na etapa Informações; vazio mantém a conta padrão (`INFINITEPAY_HANDLE`). A página pública nunca recebe a conta de destino.
- O link é criado com o handle do recebedor e esse handle fica gravado no checkout; o worker confere o `payment_check` com o handle gravado (legado `NULL` usa a conta padrão).
- Trocar o recebedor da campanha, ou a InfiniteTag de um recebedor, é recusado com `RECEIVER_IN_USE` enquanto houver link emitido para a conta atual e não pago.
- Verificação: `npm.cmd test` (27 unitários, 6 integrações, incluindo `tests/receivers.mjs`), build e `npm.cmd run test:e2e` (18 jornadas). Capturas desktop/celular em `qa-evidence/receivers/`.
- Sem commit, push ou deploy. Em produção, a 025 roda na inicialização; fazer backup antes.

## Registro dos commits autorizados

Implementação: `35be302`. Documentação e evidências acompanham o commit seguinte. A verificação dos arquivos novos preparados apontou espaços finais e linhas vazias extras em sete arquivos; corrigidos sem alteração de comportamento. Os resultados funcionais anteriores permanecem registrados acima. Nenhum push ou deploy foi executado.

## Revisão dos recebedores (02/10/2026)

- A seleção da conta e a reserva do checkout agora ocorrem na mesma transação, com bloqueio do pedido, campanha e recebedor. O handle é persistido antes da chamada ao provedor; a chamada de rede ocorre após o commit.
- A troca de recebedor ou InfiniteTag também é bloqueada durante a criação do link, quando `locked_at` está preenchido. Antes, esse intervalo permitia alterar a conta antes de o link ser salvo.
- Regressão em `tests/receivers.mjs`: provedor falso pausado durante a criação, bloqueio das duas alterações, recusa de checkout concorrente e reutilização sem emitir outro link.
- `tests/receivers-migration.mjs`: schema completo até a 024, aplicação da 025 e repetição preservando cadastro. Integrações continuam sequenciais.
- Links pendentes já emitidos são preservados, inclusive se a configuração da conta padrão mudar; sua conferência usa o handle gravado. Checkouts legados com handle `NULL` continuam dependendo da conta padrão.
- A primeira execução encontrou o MySQL isolado desligado (`ECONNREFUSED` na porta 3317). A instância existente em `tmp/mysql-test` foi iniciada em loopback, sem binary log; nenhuma configuração de produção foi alterada.
- Tipos, lint, 27 testes unitários, sete integrações e build aprovados. Integrações executadas em `camisaria_receivers_review_test`, com credenciais `TEST_DB_*` e provedor falso.
- A confirmação da InfiniteTag agora mantém a frase em um único bloco, evitando sua divisão em colunas no celular. Jornada de recebedores repetida após o ajuste: desktop e celular aprovados; capturas em `qa-evidence/receivers/` inspecionadas.
- A primeira execução das 18 jornadas passou nos casos, mas não encerrou no sandbox Windows. Foi interrompida após os testes; a repetição usa permissão para encerrar os próprios processos do Playwright, preservando processos alheios.
- Repetição completa após o ajuste visual: `npm.cmd run test:e2e`, 18 jornadas aprovadas e encerramento normal. Build, lint e `git diff --check` também aprovados após as alterações.
- Sem commit, push, deploy, compra ou envio real. Produção e contas reais InfinitePay permanecem não verificadas.

## Falha de carregamento do painel (02/10/2026)

- Em produção, login e schema 025 funcionavam, mas `GET /api/admin/campaigns` retornava 500 na versão `e261f145b41ba07a819031156d17476cad765739`.
- Diagnóstico somente leitura autorizado no phpMyAdmin: servidor `11.8.9-MariaDB-log`; `SELECT ANY_VALUE(1)` falha com erro 1305 (função inexistente), enquanto `SELECT MAX(1)` funciona.
- A consulta de campanhas usa agora `MAX` nos três campos do recebedor. O JOIN vincula um único recebedor pela chave primária; a repetição por pedido não muda os valores. Contagens, totais, IDs, contratos e schema permanecem preservados.
- Regressão em `tests/receivers.mjs`: listagem com recebedor e três pedidos (dois pagos), nome/handle/estado corretos, contagem e total sem duplicação; campanha sem recebedor mantém `null` e seus totais.
- `npm.cmd run check:release` aprovado: tipos, lint, 27 testes unitários, sete integrações, build e 18 jornadas desktop/celular, com encerramento normal. Banco local `_test`, credenciais `TEST_DB_*` e provedores falsos.
- Backup manual de arquivos e banco concluído na Hostinger, registrado em 02/10/2026 às 10:34 (America/Fortaleza). Correção publicada no commit `e61415a2f8bbac624088e106e15d213b82472113`: implantação Hostinger, `/api/health`, nova tentativa e recarga do painel autenticado confirmados. Evidência em `qa-evidence/panel-load-fix/verification.md`.

## Revisão extensa da listagem (02/10/2026)

- Revisão local solicitada após a publicação. Consulta com agregação prévia dos pedidos evita também erro 1055 no MariaDB com agrupamento estrito; resposta administrativa agora recebe validação em tempo de execução no navegador.
- A validação completa no MariaDB reproduziu erro 1020 em pedidos concorrentes. `createOrder` usa `READ COMMITTED` somente naquela transação, mantendo as travas. Regressão disputa o último uso do cupom entre oito pedidos.
- Detalhes de cobertura, resultados e limites em [revisão do carregamento](revisao-carregamento-painel.md). CI preparado para os dois bancos em máquinas separadas; ainda sem execução remota dessa configuração.
- Novos ajustes permanecem locais. Não houve novo commit, push, deploy, compra nem envio real.
- Gates finais MySQL 8.0.46 e MariaDB 11.8.9 aprovados sequencialmente: tipos, lint, 28 unitários, 8 integrações, build e 30 jornadas por banco, com encerramento normal. Capturas desktop/celular inspecionadas; MariaDB portátil encerrado.

## Pedidos: organização compacta aprovada (02/10/2026)

- Implementação e verificações em [pedidos compactos](pedidos-compactos.md): seletor único com pesquisa/fase, preços base e totais pagos no cabeçalho, tabela simplificada e detalhes preservados em popup.
- Cupons e valores usam o histórico da compra. Reembolso parcial permanece no domínio e aparece no filtro apenas quando existente; ações usam ícones com nomes acessíveis.
- Publicação autorizada pelo usuário em 02/10/2026. Sem migração nova; validações locais aprovadas. Capturas em `qa-evidence/orders-compact/`; confirmação da implantação será registrada após a ativação.
