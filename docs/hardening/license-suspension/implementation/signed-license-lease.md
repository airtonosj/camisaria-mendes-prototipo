# Implementation Plan: controle de licença assinado

## Selected Design And Constraints

A implementação selecionada é a variante offline da Opção 2: comandos Ed25519 de
uso único para `suspend` e `activate`. A chave privada permanece com o fornecedor e a
instalação recebe somente a chave pública. O mecanismo é reversível, não apaga dados,
não executa código remoto e não cria uma credencial administrativa oculta.

O controle é opt-in por configuração. Sem `LICENSE_CONTROL_ENABLED=true`, a aplicação
mantém o comportamento anterior. Um administrador com root e acesso ao código pode
remover o verificador; essa limitação deve constar no contrato e na documentação.

## Source Revision And Drift Check

O plano foi preparado sobre a revisão
`5469b728f6c21bde7e082cef3f826931eab3420c`, na branch
`codex/estabilizacao-operacional`. Antes do deploy, comparar a revisão de destino e
revalidar conflitos no roteador, configuração, migrações e smoke tests.

## Affected Components

- `api/license-token.mjs`: formato, assinatura e validação do comando;
- `api/license-control.mjs`: estado persistido, auditoria, replay e cache;
- `api/license-control-page.mjs`: tela privada e página pública de suspensão;
- `api/server.mjs`: endpoints, healthcheck e policy gate central;
- `database/migrations/023_license_control.sql`: estado e histórico;
- `ops/license-keygen.mjs` e `ops/license-token.mjs`: operação offline;
- `tests/license-token.mjs` e `tests/smoke.mjs`: regressões unitárias e integradas.

## Ordered Work Packages

1. Criar identidade de instalação e par de chaves fora da host do cliente.
2. Instalar apenas a chave pública e habilitar o recurso por ambiente.
3. Aplicar a migração aditiva de estado e histórico.
4. Validar comandos assinados, validade temporal, instalação e uso único.
5. Aplicar suspensão no backend antes de mutações e no frontend público.
6. Preservar autenticação, leitura administrativa, pagamentos em andamento,
   cancelamento, entrega, reembolso e reativação.
7. Executar testes, piloto e ensaio de suspensão/reativação.

## Compatibility And Migration

A migração é aditiva e cria um singleton em estado `active`. O recurso permanece
desabilitado por padrão, portanto o deploy não suspende instalações existentes. Ao
habilitar, `LICENSE_INSTALLATION_ID` e `LICENSE_PUBLIC_KEY_BASE64` tornam-se
obrigatórios e são verificados no startup de produção.

## Tactical Protections During Migration

- nunca copiar a chave privada para o repositório ou para a host do cliente;
- armazenar cada `commandId` com índice único para impedir replay;
- limitar tentativas no endpoint e não registrar o token completo;
- usar expiração curta e conferir a identidade exata da instalação;
- manter a decisão no backend; a interface é apenas apresentação;
- documentar e testar explicitamente as rotas permitidas durante suspensão.

## Tests And Security Validation

- comando válido de suspensão e reativação;
- assinatura alterada, instalação errada, comando expirado e motivo ausente;
- replay do mesmo `commandId`;
- bloqueio de novas operações, pedidos e alterações de campanha;
- continuidade de healthcheck, login, consultas administrativas e webhook;
- página pública em HTTP 503 e mutações bloqueadas em HTTP 423;
- retorno ao estado ativo sem perda ou alteração dos dados existentes.

## Performance And Resource Benchmarks

O estado é lido do MySQL e mantido em cache por dois segundos no processo Node. O
comando Ed25519 é verificado apenas no endpoint de controle. No piloto, comparar p95 e
taxa de erros das rotas principais antes e depois; o gate não deve acrescentar uma
consulta por requisição durante o TTL do cache.

## Rollout And Rollback

1. Revisar contrato, matriz de rotas e procedimento de emergência.
2. Fazer backup e aplicar a migração em homologação.
3. Gerar chaves fora do projeto e configurar somente a chave pública.
4. Testar suspensão e reativação com uma instalação piloto.
5. Fazer deploy com o estado inicial ativo e monitorar healthcheck/logs.

Rollback operacional: emitir um comando `activate`, confirmar o estado ativo e, se
necessário, definir `LICENSE_CONTROL_ENABLED=false` e reiniciar a aplicação. As tabelas
de auditoria podem permanecer; não é necessário apagar dados nem reverter a migração.

## Acceptance Criteria

- somente uma assinatura da chave privada correta altera o estado;
- token expirado, adulterado, de outra instalação ou repetido é rejeitado;
- suspensão não exclui nem modifica pedidos, pagamentos ou histórico;
- novas mutações de negócio são bloqueadas e rotas de recuperação continuam;
- reativação restaura o serviço imediatamente após a aplicação do comando;
- chave privada não aparece no repositório, `.env`, logs ou host do cliente;
- operação e limitação contra root/código-fonte estão documentadas.

## Open Decisions

- prazo contratual, avisos e carência antes da emissão de `suspend`;
- pessoas autorizadas a custodiar a chave e emitir comandos;
- necessidade de dupla aprovação e registro externo da decisão comercial;
- política futura de rotação/revogação de chave;
- evolução, se necessária, para leases online com carência automática.
