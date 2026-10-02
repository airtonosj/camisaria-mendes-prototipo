# Pedidos por campanha — organização aprovada

Implementação local de 02/10/2026, a partir da prévia aprovada. Mantém cores, fonte, ícones, navegação e componentes do painel existente.

- Uma única entrada para selecionar campanhas: ícone na lateral de 58 px no desktop e botão “Trocar campanha” no celular. O seletor abre em diálogo com pesquisa por nome/código, filtro por fase, seleção atual e estado sem resultados. Esc e o botão de fechar preservam a seleção; escolher uma campanha fecha o diálogo e restaura o filtro de pedidos pagos.
- Cabeçalho mostra preços base dos cortes ativos, quantidade de peças por corte, pedidos ativos pagos, total confirmado e recebedor atual. Sem vínculo explícito, mostra “Conta padrão”. Preços diferentes por variante aparecem como faixa; não são deduzidos de pedidos antigos ou cupons.
- `basePrices` é um campo adicional opcional na resposta administrativa. Uma consulta agrupada por campanha e corte, independente dos pedidos, preserva totais e compatibilidade com agrupamento estrito. Nenhuma migração nova.
- Resumo de produção removido somente de Pedidos. Relatórios e regras de produção permanecem disponíveis.
- Tabela: pedido, cliente, telefone da compra, quantidade, valor pago, cupom histórico, pagamento e ações. Corte, cor, tamanho e entrega permanecem nos detalhes em popup. Pedidos sem confirmação exibem “—”; valores originais reembolsados recebem indicação do estorno.
- Filtro inicial de pagamento: pago. Reembolso parcial fica oculto quando não existe naquela campanha; se existir, é consultável e continua exigindo atendimento manual. Nenhum estado histórico ou contrato foi removido.
- Cancelar e registrar reembolso usam ícones com títulos e nomes acessíveis. Formulários, confirmações e referências do provedor permanecem intactos. Registrar reembolso não movimenta dinheiro.
- O popup mantém o visual e fechamento existentes. Agora inclui cupom, subtotal e desconto da compra; o subtotal de cada item usa `lineTotalCents`, respeitando o desconto histórico.

## Verificação

- `npm.cmd test`: tipos, lint, 28 unitários e oito integrações aprovados em MySQL 8.0.46 local, banco `camisaria_orders_ui_test`, credenciais `TEST_DB_*` e provedores falsos.
- `npm.cmd run build`: aprovado, incluindo verificação do artefato.
- Primeira execução E2E: 32 casos aprovados, mas encerramento ficou aguardando no sandbox Windows. Somente os processos identificados dessa execução foram encerrados para repetir com encerramento normal.
- Repetição de `npm.cmd run test:e2e`: 32 jornadas aprovadas em dois minutos, encerramento normal e código de saída zero. Capturas desktop/celular inspecionadas; `git diff --check` aprovado.
- Regressão `tests/e2e/orders-workspace.spec.mjs`: filtro pago inicial e após seleção, seletor único, pesquisa por código e telefone formatado, filtro de fase/estado vazio, contagens excluindo cancelados, cupom e valores históricos, popup, opção condicional de reembolso parcial e ausência de overflow externo.
- Capturas desktop/celular em `qa-evidence/orders-compact/`: tabela, seletor e popup. Dados de pedidos na nova jornada são fictícios, interceptados somente no teste; campanhas/preços usam a API local real. Evidências anteriores foram copiadas antes da suíte para preservar alterações locais de outros trabalhos.

Publicação autorizada pelo usuário em 02/10/2026. Referência anterior: `51c1bdca78f105975365b2becbde14e3b55c05a9`. Backup da Hostinger: 02/10/2026 às 10h34; nova cópia manual disponível em 03/10. Sem migração nova, compra ou envio real. Evidência da implantação será registrada em `qa-evidence/orders-compact/publication.md` após confirmação.
