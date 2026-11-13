# Publicação de Pedidos — 02/10/2026

- Autorização: usuário solicitou deploy e, durante a publicação, acrescentou a contagem de pedidos com cupom.
- Versão anterior: `51c1bdca78f105975365b2becbde14e3b55c05a9`. Backup da Hostinger em 02/10 às 10h34; próximo manual disponível em 03/10 às 10h34.
- `4eeec21`: organização compacta publicada e confirmada pela Hostinger e API pública. `ef77ed1`: correção de lint na verificação de largura do teste; CI remoto consultado pelo SHA, aprovado nos dois bancos.
- `e65f9c6`: complemento com quantidade de pedidos pagos com cupom junto aos pagamentos confirmados. Usa cupom histórico não vazio, exclui cancelados/pendentes e permanece independente dos filtros da tabela.
- Verificação do complemento: tipos, lint, build e duas jornadas locais (desktop/celular) aprovados. Screenshots inspecionados, sem overflow externo. A primeira execução das jornadas usou build anterior e falhou na nova asserção; após rebuild ambas passaram.
- Sem migração nova, compra, reembolso ou envio real. Alterações locais alheias preservadas.
- Painel em produção exigiu novo login; verificação autenticada permanece pendente. Não foram coletadas credenciais.
- Ativação confirmada: Hostinger Concluído / Atual para `e65f9c6f`; `/api/health` retornou o SHA completo, banco conectado, schema 025 pronto, armazenamento pronto e licença ativa. Metadado dirty=true produzido no ambiente de build da hospedagem. Captura: published.png.
- CI remoto 37052909177 concluído com sucesso: check:release em MySQL 8.0 e MariaDB 11.8.9, incluindo tipos, lint, unitários, integrações, build e jornadas E2E.

## Rolagem dos pedidos

- Commit `a7d590e`: área própria com altura máxima de 65dvh, rolagem vertical/horizontal, cabeçalho fixo e foco por teclado. Consulta e filtros continuam retornando/renderizando todos os registros; não existe limite de 13 pedidos.
- Verificações: lint, build com tipos, diff --check e duas jornadas (desktop/celular) aprovados no banco local camisaria_orders_ui_test. Regressão com 35 pedidos confirma Ctrl+End, último pedido visível, cabeçalho fixo e popup do pedido mais antigo.
- Capturas history-desktop.png e history-mobile.png inspecionadas. Teste mede posição do cabeçalho e da lista no mesmo quadro para evitar movimento durante a leitura.
- Sem migração ou mutação de pedidos reais. CI: 37053947478.
- Publicação confirmada: a7d590e Concluído / Atual na Hostinger, health com SHA exato e serviços saudáveis. CI 37053947478 aprovado em MySQL e MariaDB. Painel autenticado em produção permanece sem conferência por sessão expirada; evidência visual local desktop/celular aprovada.
