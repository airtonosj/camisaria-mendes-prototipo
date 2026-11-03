# Carrinho lateral da campanha pública

Implementação local da prévia aprovada em 08/10/2026.

- Ao adicionar uma peça, abre o carrinho em diálogo lateral no desktop e em tela inteira no celular.
- Itens mostram imagem, corte, cor, tamanho, quantidade, valor e remoção.
- A lista rola independentemente; total, Revisar pedido e Continuar escolhendo ficam no rodapé.
- Ícone flutuante com quantidade aparece somente com carrinho preenchido.
- Continuar escolhendo tem fundo, borda e texto destacados.
- Chaves de armazenamento, variantes, preços, cupons, contratos HTTP e confirmação de pagamento preservados.

Arquivos: src/features/checkout/PrivateCampaignPage.tsx, src/styles/checkout-cart.css e src/styles.css. Regressão: tests/e2e/cart-drawer.spec.mjs. Capturas: qa-evidence/cart-drawer/.

Verificações concluídas: tipos, lint, 28 unitários, oito integrações e build de produção. Banco local camisaria_cart_release_test; somente provedores falsos. As 32 jornadas existentes passaram; a nova regressão passou em desktop e celular após corrigir o seletor do próprio teste. Capturas dos dois tamanhos inspecionadas. git diff --check aprovado.

As primeiras tentativas no sandbox encontraram EACCES em SMTP local e EPERM em realpath dos assets. A repetição com as permissões de execução local passou. Não houve commit, push, deploy, compra ou envio real. Alterações alheias preservadas.

