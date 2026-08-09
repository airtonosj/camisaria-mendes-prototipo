# Checklist de release

## Código e banco

- [ ] `npm.cmd run typecheck` passa.
- [ ] `npm.cmd run build` passa.
- [ ] Todos os arquivos `api/*.mjs` passam em `node --check`.
- [ ] `git diff --check` não encontra erros.
- [ ] `npm.cmd run db:migrate` não encontra migração pendente.
- [ ] `/api/health` informa banco conectado e schema pronto.
- [ ] O backup anterior à migração ou ao deploy foi conferido.

## Smoke test funcional

- [ ] Login e sessão da camisaria funcionam.
- [ ] Senha provisória bloqueia o restante do painel até ser trocada.
- [ ] Campanha pode ser criada com arte e tamanhos válidos.
- [ ] Pedido repetido com a mesma chave não é duplicado.
- [ ] Pedido pode ser consultado com número e WhatsApp.
- [ ] Pedido pendente não entra no relatório de produção.
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

- [ ] `APP_ENV=production` está definido no processo da API.
- [ ] Usuário MySQL da aplicação não possui permissão de alterar schema.
- [ ] Usuário `admin@teste.com` não está ativo.
- [ ] A senha provisória da conta real foi trocada.
- [ ] SMTP foi testado de ponta a ponta.
- [ ] Uploads usam caminho persistente fora da árvore substituída no deploy.
- [ ] HTTPS, cabeçalhos de segurança e proxy estão ativos.
- [ ] Backup automático e restauração foram testados.
- [ ] Logs, monitoramento e rollback estão documentados.

## Pagamento automático — fase final

- [ ] Checkout integrado foi habilitado na conta InfinitePay.
- [ ] Taxas e condições atuais do provedor foram revalidadas.
- [ ] Checkout está vinculado ao pedido e valor internos.
- [ ] Webhook processa eventos idempotentemente e a API `payment_check` confirma pedido e valor.
- [ ] Redirecionamento do navegador nunca confirma pagamento sozinho.
- [ ] Reconciliação, expiração e reembolso foram testados.
