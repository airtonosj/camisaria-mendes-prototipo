# Correções de segurança — preparação de release

Base: `fa51d05f728e9f9f4bac668528bba12100161fae`. Alterações locais; publicação não executada.

## Comportamento e compatibilidade

- O acompanhamento usa `POST /api/orders/:numero` com `{ whatsapp }` em JSON, mantendo o formato da resposta, as normalizações de telefone, o histórico e o link público de acompanhamento. A consulta continua disponível durante suspensão de licença.
- O GET antigo retorna `410 ORDER_TRACKING_POST_REQUIRED`, pedindo atualização da página. Não há fallback que volte a enviar telefone na URL. Abas com JavaScript antigo precisam ser recarregadas depois do deploy.
- Todas as respostas Node recebem `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy e Permissions-Policy. As páginas de licença preservam sua CSP mais restritiva. A política acrescentada não limita scripts, fontes ou destinos de checkout.
- A configuração Nginx alternativa repete os headers nos locations que definem `add_header`, preservando a política de HTTPS existente. Na Hostinger, os headers saem do próprio Node; conferir a resposta final depois da CDN.
- Novos eventos InfinitePay só entram na fila depois de `payment_check` confirmar pagamento e valor na conta gravada no checkout. A chamada de rede acontece fora da transação. Depois, pedido, checkout, conta e valor são revalidados sob bloqueio.
- A conferência de ingresso aceita no máximo oito chamadas simultâneas por processo e mantém o timeout existente do provedor. Eventos admitidos recebem tipos específicos de conferência, têm prioridade sobre a fila antiga e não compartilham sua cota com eventos legados não conferidos.
- O worker continua consultando o provedor antes de gravar pagamento; valor divergente, transação de outro pedido, cancelamento e reembolso permanecem bloqueados. `signature_valid` continua sendo atualizado pelo worker; o tipo de ingresso não é uma assinatura de webhook.
- Uma reserva falsa legada da transação em outro pedido só é liberada após confirmação do provedor. A entrada antiga conserva ID, pedido e payload; é encerrada como dead letter e recebe identificador interno `legacy-...` para liberar a chave externa. Entradas em processamento não são substituídas.
- Falhas de conferência retornam erro `400` para que o webhook seja reenviado. Eventos já admitidos continuam com retentativas duráveis. O timeout do cliente de reconciliação foi aumentado para 15 segundos.

Contrato consultado: [documentação oficial do Checkout InfinitePay](https://www.infinitepay.io/checkout-documentacao). Ela documenta `payment_check` e reenvio do webhook após erro 400; não presumimos assinatura de webhook não documentada. A nova conferência acrescenta uma chamada ao provedor no ingresso; sua latência real só poderá ser observada após publicação.

Estas correções não adicionam migração nem novas variáveis obrigatórias. A base atual já contém a migração 026 de prazo de entrega: conferir o schema publicado e seguir a inicialização/migração normal do projeto.

## Regressões

- `tests/security-regressions.mjs`: tentativas falsas pelos dois tipos de ingresso, cota diária/pendente, fila anterior ao deploy, prioridade, replay, concorrência, checkout com handle legado, reserva falsa em outro pedido, valor divergente, indisponibilidade e mudança de conta/cancelamento durante a chamada ao provedor.
- `tests/smoke.mjs`: fluxos completos de pedido, consulta, pagamento, relatórios, cancelamento, reembolso, licença e sessão; fila legada conserva retentativas e dead letter.
- `tests/unit/security-headers.test.mjs`: headers em GET, HEAD, erros e CSP especializada; contrato da consulta POST.
- E2E desktop/celular: checkout, retomada e acompanhamento com telefone no corpo e URL sem query; GET legado recusado; HTML e rotas de fallback protegidos contra framing; jornadas anteriores preservadas.

Todos os testes usam loopback, bancos `_test`, credenciais `TEST_DB_*`, InfinitePay falsa e SMTP de teste. Nenhum pagamento ou envio real integra estas verificações.

## Arquivos da correção

- Transporte e consulta: `src/features/orders/api.ts`, `shared/response-contracts.mjs`, `api/http/router.mjs`, `api/http/license.mjs`, `api/modules/orders/service.mjs`.
- Headers: `api/http/security-headers.mjs`, `api/server.mjs`, `ops/nginx/camisaria.conf`.
- Pagamento: `api/infinitepay-payments.mjs`.
- Regressões: `tests/security-regressions.mjs`, `tests/unit/security-headers.test.mjs`, `tests/smoke.mjs`, `tests/campaign-delivery.mjs`, `tests/helpers/infinitepay.mjs`, `tests/integration/suites.test.mjs`, `tests/e2e/journeys.spec.mjs`.
- Documentação de continuidade e validação. As jornadas regeneram as capturas em `qa-evidence/`; isso não altera o layout do produto.

## Publicação e rollback

1. Registrar versão anterior e backup conforme `docs/checklist-release.md`.
2. Publicar backend e frontend da mesma release. Não enviar somente um dos lados da mudança de contrato.
3. Manter o fluxo normal `npm start` / `api/start.mjs`; conferir schema, readiness e artefato em `/api/health`.
4. Conferir headers após a CDN, login, campanha, consulta e retomada. Recarregar abas antigas. Não iniciar compra real como smoke sem autorização específica.
5. Em erro, restaurar a release anterior como pacote completo, compatível com o schema; não apagar pedidos ou filas nem reverter schema de forma destrutiva. O rollback reabre os riscos corrigidos e deve ser tratado como contingência temporária.

O gate local comprova o funcionamento da versão candidata. Configuração da Hostinger/CDN, estado do banco publicado e comportamento real da InfinitePay dependem de verificação após deploy.

## Validação final

Resultado: correções verificadas localmente (`fixed`); publicação e verificação da infraestrutura real permanecem pendentes.

| Ambiente local | Gate completo |
| --- | --- |
| Node 24.18.0 / MySQL 8.0.46 | Aprovado: tipos, lint, 31 unitários, 10 integrações, build e 40 E2E |
| Node 24.18.0 / MariaDB 11.8.9 | Aprovado: tipos, lint, 31 unitários, 10 integrações, build e 40 E2E |
| Node 22.23.3 / MariaDB 11.8.9 | Aprovado: tipos, lint, 31 unitários, 10 integrações, build e 40 E2E |

As rodadas completas foram sequenciais. A regressão de segurança também passou isoladamente em Node 22 usando o banco `_test` já configurado, sem novos grants. `git diff --check` e verificação de sintaxe do módulo de pagamento aprovados. `package.json` e `package-lock.json` preservados; Node 22 obtido somente em cache temporário para teste.

O ensaio inicial reproduziu a reserva legada falsa em outro pedido; a regressão passou após a correção. Duas falhas iniciais de E2E eram da nova assertiva que esperava telefone sem pontuação, enquanto a UI já o formata; a assertiva passou a comparar os dígitos e manteve a exigência de URL sem query. Fixtures de teste foram corrigidas para telefone canônico e JSON retornado pelos dois motores. Os gates finais não têm falhas.

As capturas de acompanhamento desktop/celular foram inspecionadas. Não houve mudança de CSS ou composição visual. O build validado identifica commit `fa51d05f728e9f9f4bac668528bba12100161fae`, `dirty=true`, `builtAt=2026-10-13T18:07:25.097Z`; representa o código local modificado, não uma release publicada.

Limitações: InfinitePay e SMTP reais, configuração da CDN/Hostinger e headers após a CDN não foram exercitados. O Nginx alternativo recebeu revisão estática de configuração; não foi iniciado no Windows. CI remota e produção não foram executadas. Não houve commit, push, deploy, compra ou envio real.
