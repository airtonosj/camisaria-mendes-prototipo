# Plano de liberação de vendas

Atualizado em 11 de agosto de 2026. A regra é simples: **produção pode ficar ativa sem
vendas públicas**. `APP_ENV=production` protege a infraestrutura; quem abre o pagamento
para todos é somente `INFINITEPAY_CHECKOUT_ENABLED=true`.

## Estado por etapa

| Etapa | Entrega no repositório | Evidência atual | Pendência externa para liberar |
| --- | --- | --- | --- |
| 1. Artes permanentes | `UPLOADS_DIR` obrigatório fora da release, health check, backup dos uploads e prova antes/depois do redeploy | Caminho real `/home/u374132860/domains/camisariamendes.com.br/uploads` configurado; health verde e diretório visível fora de `hbuilds` | Enviar uma arte de prova e confirmar o mesmo arquivo depois de outro redeploy |
| 2. SMTP | Fila idempotente pós-pagamento e `npm run ops:email:test -- destinatario` | Conteúdo, deduplicação e retry passaram no smoke; autenticação, envio e recebimento real foram confirmados em 11/08/2026 | Conferir SPF/DKIM nos cabeçalhos e repetir a entrega no teste de compra real |
| 3. Produção | Validação de HTTPS, proxy, SMTP, banco restrito e storage; checkout fechado não impede mais o boot | `APP_ENV=production`, domínio real, SMTP e storage aplicados; deploy `c57c6c1` e health verdes em 11/08/2026 | Confirmar a restrição de privilégios do usuário MySQL e os cabeçalhos HTTP finais |
| 4. Compra InfinitePay | Link vinculado ao pedido, webhook, retorno e `payment_check` idempotentes | Provedor falso passou inclusive divergência de valor | Fazer uma compra real de baixo valor no ambiente publicado e guardar pedido, transação e comprovante |
| 5. Cancelamento/reembolso | Pedido não pago cancela com motivo; pedido pago exige referência de estorno e reembolso integral antes do cancelamento | Smoke passou em `pago → reembolsado → cancelado → fora da produção` | Executar o estorno real no app InfinitePay e registrar a referência no painel |
| 6. Backup/restauração | Dump sem trigger inválido, arquivo separado de triggers, SHA-256, uploads e restauração em banco novo | Snapshot `20260811T151646Z` restaurado: 9 migrações, 2 campanhas, 8 pedidos, 4 pagamentos, 0 reembolsos, 2 usuários e 4 artes | Ativar agenda no servidor e repetir a restauração usando o backup da hospedagem |
| 7. Políticas | Páginas públicas de privacidade, trocas/reembolso e atendimento, ligadas no rodapé e no checkout | As três rotas foram publicadas e abertas no domínio real em 11/08/2026 | Confirmar razão social/documento/endereço comercial, horário de atendimento e revisão jurídica final |
| 8. Checkout público | Trava única em variável de ambiente | Continua `false` no ambiente publicado em produção | Alterar para `true` somente após todas as linhas acima ficarem verdes no servidor publicado |

## Sequência de execução na hospedagem

1. Publicar o código com `APP_ENV=production` e `INFINITEPAY_CHECKOUT_ENABLED=false`.
2. Configurar banco restrito, `UPLOADS_DIR`, `BACKUP_DIR`, domínio HTTPS, proxy e SMTP.
3. Executar `npm run ops:health`, `npm run ops:email:test -- <email>` e a prova de storage.
4. Gerar um backup e restaurá-lo em banco terminado em `_restore_test`.
5. Revisar e completar a identificação comercial nas políticas.
6. Abrir o checkout apenas durante o teste controlado, fazer uma compra de baixo valor,
   conferir webhook, `payment_check`, e-mail, acompanhamento e relatório.
7. Fazer o estorno real, registrar a referência no painel e confirmar que o pedido ficou
   reembolsado/cancelado e saiu da produção.
8. Fechar novamente o checkout, analisar todas as evidências e, somente com go formal,
   reabrir para o público.

## Comandos de evidência

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run ops:health
npm.cmd run ops:email:test -- comprador@dominio.com
npm.cmd run ops:storage:create
# redeploy/restart
npm.cmd run ops:storage:check
npm.cmd run ops:backup
$env:RESTORE_DB_NAME='camisaria_release_restore_test'
$env:RESTORE_UPLOADS_DIR='C:\caminho\temporario\uploads'
npm.cmd run ops:restore:test -- C:\caminho\do\snapshot
```

## Limites do reembolso InfinitePay

A documentação pública do Checkout Integrado descreve `/links`, webhook e
`/payment_check`, mas não documenta um endpoint de estorno. Por isso o sistema não finge
movimentar dinheiro: o operador conclui o estorno na conta InfinitePay e depois registra
a referência e o comprovante no painel. Fonte técnica:
<https://www.infinitepay.io/checkout-documentacao>.

As políticas usam como base de transparência o aviso orientativo da ANPD e preservam o
direito de arrependimento do art. 49 do CDC:
<https://www.gov.br/anpd/pt-br/acesso-a-informacao/aviso-de-privacidade> e
<https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm>.
