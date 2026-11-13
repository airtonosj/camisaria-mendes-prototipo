# Prazo de entrega por campanha

Implementação local de 08/10/2026, conforme as prévias aprovadas.

- Cadastro/edição: `Entrega prevista (opcional)` e `Observação sobre a entrega (opcional)`. Sem o texto de ajuda removido pelo usuário. Os campos acompanham o rascunho da sessão e a etapa de revisão.
- Cliente: retirada, previsão e observação aparecem juntas, com um ícone por linha e sem divisórias internas. Data por extenso sem ano. Na escolha da camisa, o bloco fica abaixo da imagem no computador e no cabeçalho no celular. Também aparece na revisão, no pedido registrado e no acompanhamento.
- Sem data: `Entrega prevista a definir`. A data não altera a fase nem confirma que a camisa está pronta ou paga.
- API: campos aditivos `deliveryExpectedOn` (data de calendário `AAAA-MM-DD`, ou `null`) e `deliveryNote` (até 255 caracteres, ou `null`). Campo omitido na edição preserva o valor; `null` remove. Datas inexistentes são recusadas no servidor.
- Migração `026_campaign_delivery`: campos opcionais em campanhas e snapshot em pedidos. Não altera IDs, preços, links ou registros antigos. DDL reexecutável após interrupção.
- Novos pedidos gravam a previsão e a observação sob a mesma trava/transação da campanha. A repetição idempotente preserva essa gravação. A consulta informa a previsão atual e, se houver alteração, também a data informada na compra. Pedidos antigos têm snapshot desconhecido (`null`), sem inventar uma data histórica.

Verificação inicial: tipos, lint, 29 testes unitários, nove integrações e build aprovados. Regressão de banco cobre criação/edição, datas inválidas, campo vazio, snapshot, idempotência, repetição da migração e atualização de schema 025 com pedidos existentes.

Jornadas desktop/celular: 38 cenários verificados. Na execução geral, 37 passaram e a primeira jornada nova ficou bloqueada pelo menu lateral expandido sobre o botão Editar. O teste passou a mover o cursor para fora do menu, como nas jornadas já existentes. Repetição das quatro jornadas da entrega: 4/4 aprovadas, com encerramento normal. Não houve alteração funcional por causa desse ajuste de teste.

Capturas de formulário, escolha, revisão e acompanhamento em `qa-evidence/campaign-delivery/`, inspecionadas no computador e no celular. Tipos e build aprovados; lint repetido após os últimos ajustes e `git diff --check` aprovado. Os testes só usaram banco local terminado em `_test` e provedores falsos.

Não houve commit, push, deploy, compra ou envio real. A migração só foi aplicada nos bancos locais de teste; produção permanece sem verificação. Próximo passo: publicação especificamente autorizada, com backup e aplicação da migração 026 na inicialização.
