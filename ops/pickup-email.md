# Avisos de retirada

Na tela Pedidos, selecione uma campanha pronta para entrega e clique em **Avisar compradores**. Revise retirada, representante, telefone e convite do grupo; **Confirmar** gera somente uma prévia. **Enviar e-mails** confirma o lote. Os dados revisados passam a ser os dados de retirada da campanha.

O exemplo usa o primeiro pedido elegível; nome, número, peças e rastreio são personalizados por pedido. O envio usa texto simples com links. Pedidos pagos, ativos, não entregues, com e-mail válido e sem aviso anterior são elegíveis. A fila revalida antes do envio; pedidos que mudaram de situação são cancelados na fila.

## Publicação

- Publicar frontend e API juntos e executar `npm run db:migrate` (migração `024_pickup_email`) antes de iniciar a nova API.
- Manter as variáveis SMTP e PUBLIC_APP_URL corretas na hospedagem.
- Realizar um teste controlado com pedido interno antes de avisar compradores reais. Aceitação SMTP não comprova entrega nem leitura.
- A implementação foi validada em banco `_test`; a migração não foi aplicada no ambiente principal durante o desenvolvimento.

## Operação

Se uma inicialização anterior interrompeu a migração 024 (por exemplo, `Duplicate column name 'pickup_group_url'`), publique a correção do migrador e reinicie pelo comando `npm start`. O migrador inspeciona os objetos já existentes, cria somente as colunas/tabela ausentes e recompõe as restrições. Não remova a coluna nem marque a versão manualmente: a versão só deve ser registrada depois de todas as etapas concluídas. Um lock de banco serializa inicializações concorrentes. Teste de recuperação: `npm run test:pickup-migration`.

A prévia expira após 30 minutos pelo relógio do banco. Confirmar duas vezes não duplica o lote nem os avisos. Uma nova prévia não inclui pedidos que já possuem aviso. O histórico resumido fica no primeiro popup.

Confirmações de pagamento são processadas antes dos avisos de retirada. O processador de retirada trata até 5 mensagens por ciclo. Falhas anteriores ao envio SMTP têm até 3 tentativas com intervalo de 5 minutos. Interrupções durante/depois de DATA, falha ao gravar a aceitação e execução interrompida há mais de 10 minutos ficam como `uncertain`, sem reenvio automático. Conferir os registros do provedor antes de qualquer intervenção nesses casos. O painel não oferece reenvio manual de mensagens aceitas ou incertas.

## Verificação

`npm run test:smoke` prepara e verifica o banco isolado; depois `npm run test:pickup` verifica a função usando entregador simulado. Nenhuma mensagem real é enviada por esses testes. `npm run build` valida tipos e artefatos de produção.
