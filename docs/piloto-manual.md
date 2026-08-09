# Homologação pré-checkout — go/no-go

Este arquivo preserva o nome antigo por compatibilidade com referências externas, mas o
Pix manual foi encerrado. Antes da integração InfinitePay, a homologação usa somente
pedidos de teste pendentes; ninguém transfere valor nem marca pagamento pelo painel.

## Antes de abrir

- [ ] Domínio HTTPS, API, banco, uploads e SMTP estão verdes.
- [ ] Backup novo foi gerado e restaurado em banco separado.
- [ ] Conta de demonstração está inativa e a senha provisória da conta real foi trocada.
- [ ] Arte, cortes, cores, tamanhos, preços e prazo da campanha foram aprovados.
- [ ] Link e QR Code foram testados em Android, iPhone e desktop.
- [ ] `PAYMENT_PROVIDER=infinitepay` e a `INFINITEPAY_HANDLE` correta estão preparados.
- [ ] `INFINITEPAY_CHECKOUT_ENABLED=false` continua definido.

## Durante a homologação

- [ ] A tela oferece Pix e cartão de crédito.
- [ ] Nenhuma chave Pix fixa, pedido de comprovante ou confirmação manual aparece.
- [ ] Pedido repetido com a mesma chave idempotente não cria duplicata.
- [ ] Pedido pendente não aparece na produção nem na entrega.
- [ ] A antiga rota administrativa de pagamento responde como inexistente.
- [ ] Cancelamento não pago exige motivo e continua consultável.
- [ ] Retorno de fase exige motivo e preserva o histórico.
- [ ] Aluno consulta o estado correto pelo número e WhatsApp.
- [ ] E-mail de recuperação chega e o link só funciona uma vez.
- [ ] Backup diário e logs do serviço não apresentam falhas.

## Critério de aprovação

Esta etapa aprova apenas a jornada até o ponto de integração. Receber dinheiro real é
**no-go** enquanto criação do link, redirect, webhook, `payment_check`, idempotência,
reconciliação e reembolso não estiverem implementados e testados.

## Registro mínimo de incidente

Anote horário, pedido, tela/rota, estado esperado, estado observado, impacto, ação tomada e
resultado. Não inclua senha, token, dados de cartão ou payload completo de pagamento nos logs.

## Próxima etapa

Criar o link com `order_nsu` e o valor calculado pelo servidor, redirecionar ao checkout
InfinitePay, persistir `transaction_nsu` e processar o webhook idempotentemente. O servidor
deve chamar `payment_check` antes de marcar o pedido como pago; o redirect nunca confirma.
