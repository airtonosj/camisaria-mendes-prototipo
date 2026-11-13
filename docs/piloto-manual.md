# Homologação do checkout InfinitePay — go/no-go

Este arquivo preserva o nome antigo por compatibilidade com referências externas. O Pix
manual foi encerrado; a homologação final usa o Checkout Integrado da InfinitePay e uma
compra real de baixo valor, sem confirmação manual pelo painel.

## Antes de abrir

- [ ] Domínio HTTPS, API, banco, uploads e SMTP estão verdes.
- [ ] Backup novo foi gerado e restaurado em banco separado.
- [ ] Conta de demonstração está inativa e a senha provisória da conta real foi trocada.
- [ ] Arte, cortes, cores, tamanhos, preços e prazo da campanha foram aprovados.
- [ ] Link e QR Code foram testados em Android, iPhone e desktop.
- [ ] `PAYMENT_PROVIDER=infinitepay` e a `INFINITEPAY_HANDLE` correta estão preparados.
- [ ] Checkout Integrado foi habilitado na conta InfinitePay.
- [ ] `INFINITEPAY_CHECKOUT_ENABLED=true` foi aplicado somente no ambiente de homologação.

## Durante a homologação

- [ ] A tela oferece Pix e cartão de crédito.
- [ ] Nenhuma chave Pix fixa, pedido de comprovante ou confirmação manual aparece.
- [ ] Pedido repetido com a mesma chave idempotente não cria duplicata.
- [ ] Webhook repetido não duplica pagamento nem e-mail.
- [ ] Retorno do navegador não confirma pagamento antes de `payment_check`.
- [ ] Pedido pendente não aparece na produção nem na entrega.
- [ ] A antiga rota administrativa de pagamento responde como inexistente.
- [ ] Cancelamento não pago exige motivo e continua consultável.
- [ ] Retorno de fase exige motivo e preserva o histórico.
- [ ] Aluno consulta o estado correto pelo número e WhatsApp.
- [ ] E-mail de recuperação chega e o link só funciona uma vez.
- [ ] Backup diário e logs do serviço não apresentam falhas.

## Critério de aprovação

Produção é **go** somente quando a compra real confirmar checkout, `payment_check`, e-mail,
relatório e rastreamento sem intervenção manual. Reembolso continua **no-go** até existir
um procedimento validado no painel/conta InfinitePay e a reconciliação no sistema.

## Registro mínimo de incidente

Anote horário, pedido, tela/rota, estado esperado, estado observado, impacto, ação tomada e
resultado. Não inclua senha, token, dados de cartão ou payload completo de pagamento nos logs.

## Resultado esperado

O link usa `order_nsu` e o valor calculado pelo servidor, persiste `transaction_nsu` e
processa o webhook idempotentemente. O servidor chama `payment_check` antes de marcar o
pedido como pago; o redirect apenas solicita a reconciliação.
