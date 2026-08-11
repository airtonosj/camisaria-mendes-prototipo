# Plano operacional da Camisaria Mendes

Este documento é a fonte curta de continuidade do projeto. A implementação deve avançar
uma fase por vez e só seguir quando os critérios de saída da fase atual estiverem verdes.

## Decisões estáveis

- O produto atende duas instâncias: **Camisaria** e **Cliente**.
- Representantes participam pelo fluxo operacional/WhatsApp; não recebem painel nesta etapa.
- Somente pedidos pagos e ativos entram nos relatórios oficiais.
- Pix e cartão serão processados exclusivamente pela InfinitePay.
- Não existe confirmação manual; somente a integração validada pode alterar um pedido para pago.
- Redirecionamento não comprova pagamento: a baixa exige webhook idempotente e `payment_check`.

## Fases

1. **Estabilização** — build, cancelamento, migrações e health check confiável.
2. **Testes mínimos** — banco de teste e smoke tests dos fluxos críticos.
3. **Backend operacional** — configuração de produção, segurança, SMTP e uploads persistentes.
4. **Fluxos completos** — campanha, pedido pendente, produção, cancelamento e entrega.
5. **Infraestrutura** — VPS, HTTPS, banco restrito, backup, logs, deploy e rollback.
6. **Homologação pré-checkout** — jornada completa sem receber dinheiro real.
7. **Pagamento InfinitePay** — criação do link, redirect, webhook, `payment_check` e reconciliação.

## Estado do checkpoint de estabilização

- Branch: `codex/estabilizacao-operacional`.
- A migração esperada mais recente é `005_order_cancellation`.
- `/api/health` deve retornar `schema.ready: true` e informar a migração atual.
- O acompanhamento contempla `pending`, `confirmed`, `failed`, `ready`, `delivered` e `cancelled`.
- O backup anterior à migração 005 fica em `backups/`, fora do controle de versão.

## Estado do checkpoint de testes

- O banco automatizado padrão é `camisaria_mendes_test`.
- O reset recusa qualquer nome que não termine em `_test` e nunca reutiliza `DB_NAME`.
- `npm.cmd run test:smoke` recria, migra e semeia apenas o banco de teste.
- O smoke test cobre login, sessão, campanha, pedido idempotente, bloqueio da baixa manual, relatórios,
  cancelamento, fases, entrega e redefinição de senha.
- O processo da API de teste usa a porta 3334 e é encerrado ao final, inclusive em falha.

## Estado do checkpoint de backend operacional

- Produção recusa configurações sem HTTPS, SMTP, usuário MySQL restrito ou uploads persistentes.
  O checkout pode e deve permanecer fechado durante a homologação externa.
- `PAYMENT_PROVIDER` permanece `infinitepay`; a trava de checkout fica falsa até a fase final.
- A chave estática administrativa fica desabilitada por padrão em produção.
- Somente `role = 'camisaria'` pode criar sessão e acessar rotas administrativas.
- `UPLOADS_DIR` define o armazenamento persistente e também participa do health check.
- Troca de conta, senha, consumo de token e encerramento de sessões são transacionais.

## Estado do checkpoint de fluxos completos

- A validação visual usa a API apontada para `camisaria_mendes_test`, sem criar registros no banco principal.
- O fluxo observado no navegador cobre acesso privado, pedido pendente, consulta, fases de
  produção, relatórios, entrega e estado final do cliente.
- O painel permite cancelar pedido não pago com motivo obrigatório; o registro permanece no histórico
  e o cliente enxerga o motivo na consulta.
- Campanhas podem ser editadas sem trocar o código já divulgado, e o painel gera link e QR Code privados.
- Login, logout, proteção da conta e aviso explícito de SMTP ausente foram observados no navegador.
- A página pública e o painel foram conferidos em viewport desktop e móvel, sem erros no console.
- A próxima fase externa é conectar a InfinitePay conforme a fase 7.

## Estado do checkpoint de infraestrutura

- `ops/nginx/camisaria.conf` e `ops/systemd/` versionam o proxy HTTPS, a API e o backup diário.
- `npm run ops:backup` gera dump, copia uploads e grava manifesto antes de publicar o snapshot.
- `npm run ops:health` valida banco, schema e storage com tentativas limitadas.
- `npm run build` falha se o bundle carregar credencial de demonstração ou URL local da API.
- `docs/runbook-operacional.md` documenta release atômica, logs, rollback e restauração em banco separado.
- A ativação na VPS ainda depende de domínio, certificado, credenciais, permissões e teste real de restauração.

## Preparação da homologação pré-checkout

- `docs/piloto-manual.md` fixa escopo, evidências, incidentes e critério objetivo de go/no-go.
- O piloto começa somente depois da infraestrutura real e da restauração de backup estarem verdes.
- Nenhum valor real pode ser recebido antes da automação de pagamento estar aprovada.

## Verificações de fechamento

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
Get-ChildItem api -Filter *.mjs | ForEach-Object { node --check $_.FullName }
npm.cmd run db:migrate
git diff --check
```

Só abra a próxima fase depois que todas essas verificações estiverem verdes.
