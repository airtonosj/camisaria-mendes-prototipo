# Checklist de release

## Código e banco

- [x] `npm.cmd run typecheck` passa.
- [x] `npm.cmd run build` passa.
- [x] Todos os arquivos `api/*.mjs` passam em `node --check`.
- [x] `git diff --check` não encontra erros.
- [ ] `npm.cmd run db:migrate` não encontra migração pendente.
- [x] `/api/health` informa banco conectado, schema `009_order_refunds` pronto e storage gravável no ambiente publicado.
- [ ] O backup anterior à migração ou ao deploy foi conferido.

## Smoke test funcional

- [x] Login e sessão da camisaria funcionam no domínio publicado.
- [ ] Senha provisória bloqueia o restante do painel até ser trocada.
- [ ] Campanha pode ser criada com arte e tamanhos válidos.
- [ ] Pedido repetido com a mesma chave não é duplicado.
- [ ] Pedido pode ser consultado com número e WhatsApp.
- [ ] Pedido pendente não entra no relatório de produção.
- [ ] Confirmação de pagamento agenda um único e-mail com código e link de acompanhamento.
- [ ] Não existe botão nem rota administrativa para marcar pagamento como pago.
- [ ] Cancelamento exige motivo e continua consultável.
- [ ] Entrega só ocorre para pedido pago em campanha pronta.
- [ ] Build de produção não exibe dados de demonstração.

## Evidência local da fase 4 — 8 de agosto de 2026

- [x] Pedido privado foi criado e consultado no navegador usando o banco de teste.
- [x] A antiga confirmação manual foi validada nesta evidência histórica e depois removida.
- [x] Campanha avançou por encerramento, produção, entrega e finalização.
- [x] Entrega foi registrada e apareceu como concluída para o cliente.
- [x] Cancelamento não pago exigiu motivo, saiu da operação e permaneceu consultável.
- [x] Edição e compartilhamento privado da campanha foram conferidos.
- [x] Login, proteção da conta, logout e recuperação sem SMTP foram conferidos.
- [x] Página pública e painel foram conferidos em desktop e 390 × 844, sem erro no console.

## Produção

- [x] `APP_ENV=production` foi aplicado no hPanel em 11/08/2026 com checkout fechado.
- [ ] Usuário MySQL da aplicação não possui permissão de alterar schema.
- [ ] Usuário `admin@teste.com` não está ativo.
- [x] A conta real está fora do fluxo de troca obrigatória e `ADMIN_INITIAL_PASSWORD` foi removida do hPanel.
- [x] SMTP foi testado de ponta a ponta em 11/08/2026 com envio e recebimento confirmados em `gustavo@camisariamendes.com.br`.
- [ ] Um comprador de teste recebeu a confirmação de pagamento e conseguiu consultar o pedido.
- [x] Uploads usam `/home/u374132860/domains/camisariamendes.com.br/uploads`, fora da árvore `hbuilds` substituída no deploy.
- [ ] HTTPS, cabeçalhos de segurança e proxy estão ativos.
- [ ] Backup automático e restauração foram testados.
- [ ] Privacidade, trocas/reembolso e atendimento estão publicados com identificação e contatos reais do fornecedor.
- [x] Logs, monitoramento e rollback estão documentados.

## Pagamento automático — fase final

- [x] Checkout integrado foi habilitado na conta InfinitePay (confirmação do titular em 11/08/2026).
- [ ] Taxas e condições atuais do provedor foram revalidadas.
- [x] Checkout está vinculado ao pedido e valor internos no teste automatizado.
- [x] Webhook processa eventos idempotentemente e `payment_check` confere pedido e valor no provedor falso.
- [x] Redirecionamento do navegador apenas agenda reconciliação e nunca confirma pagamento sozinho.
- [ ] Uma compra real de baixo valor confirmou checkout, webhook, e-mail e relatório.
- [ ] Reconciliação, expiração e reembolso foram testados.

## Evidência de implementação — 11 de agosto de 2026

- [x] Smoke cobriu checkout, webhook, `payment_check`, e-mail enfileirado e divergência de valor.
- [x] Reembolso integral com referência do provedor cancelou o pedido e o retirou da produção.
- [x] Snapshot pós-migração 009 restaurou banco, triggers e quatro artes em destinos isolados.
- [x] Políticas públicas foram ligadas ao rodapé e ao formulário de compra.
- [x] Produção foi desacoplada da abertura pública: checkout `false` não invalida `APP_ENV=production`.
- [x] SMTP real autenticou, enviou e teve o recebimento confirmado pelo titular da caixa.
- [x] Deploy `c57c6c1` concluiu no hPanel e `/api/health` confirmou banco, migração e storage prontos.
- [ ] A prova de arquivo antes/depois de outro redeploy, a compra de baixo valor e o estorno real ainda exigem execução externa.
