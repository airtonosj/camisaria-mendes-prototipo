# Security Hardening Proposal: suspensão contratual de licença

## Decision

Definir quanto controle técnico o fornecedor manterá depois que a aplicação for
instalada na infraestrutura do cliente e como a inadimplência será traduzida em uma
restrição reversível, transparente e não destrutiva.

## Executive Recommendation

As opções são **Opção 1 — somente contrato**, **Opção 2 — leases de licença assinados**
e **Opção 3 — serviço essencial hospedado pelo fornecedor**.

Eu recomendo a Opção 2 quando o objetivo é enforcement proporcional em uma relação
comercial normal. Ela fornece aviso, carência, auditoria e suspensão consistente, sem
uma credencial escondida. Precisamos declarar no contrato e na documentação que um
cliente com root e código-fonte pode remover o verificador.

Se impedir esse bypass for requisito indispensável, a Opção 3 é a única das três que
não depende inteiramente da cooperação da instalação. Ela custa mais: o produto deixa
de ser totalmente self-hosted e sua empresa passa a responder por disponibilidade,
segurança e operação de um serviço crítico.

## Evidence

Eu inspecionei a revisão registrada. O roteador Node é um bom ponto de enforcement,
mas o deploy atual coloca código e configuração na host. Não há módulo de licença,
identidade da instalação ou formato de entitlement.

| Evidence | Finding or document | What it establishes |
| --- | --- | --- |
| `E1` | Roteador Node | Pedidos, checkout, pagamentos e painel podem receber uma política central. |
| `E2` | Sessões | Usuários já têm identidade, mas a instalação/contrato não. |
| `E3` | Configuração local | Variáveis são controladas na host e não podem ser tratadas como segredo do fornecedor. |
| `E4` | Schema | Não há estado ou histórico de licenciamento. |
| `E5` | Deploy na host | O administrador da host pode alterar código, rede e processo. |

Observado: nenhum artefato de licenciamento, container assinado ou serviço externo foi
localizado. Inferido: uma URL secreta, variável ou tarefa programada dentro dessa host
é removível pelo cliente e representa autoridade excessiva se descoberta por terceiro.

## Current Design And Failure Mode

O [desenho atual](../diagrams/license-suspension-control-before.mmd) coloca aplicação,
banco e autoridade operacional sob o cliente. Isso é coerente com self-hosting, mas
incompatível com a promessa de desligamento remoto garantido. Quem controla a máquina
controla o programa executado nela.

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Nenhuma ainda | Controle total do cliente | A definir | Sem enforcement remoto | Sem dependência externa |

## Desired Invariants

- nenhuma credencial mestra ou comando remoto é instalado na host;
- somente um entitlement assinado pelo fornecedor habilita recursos pagos;
- indisponibilidade do fornecedor usa carência e nunca desliga imediatamente;
- inadimplência bloqueia novas operações, não histórico, backup, exportação ou acesso administrativo;
- reativação é automática, auditada e dentro do prazo contratual;
- a verificação envia somente identificador aleatório da instalação, versão e estado técnico mínimo;
- limitações decorrentes de root/código-fonte são comunicadas sem promessa enganosa.

## Constraints And Non-Goals

O mecanismo não é DRM inviolável, ferramenta de cobrança, acesso ao banco do cliente
ou meio de apagar dados. A validade da suspensão, prazos, notificações, direitos sobre
o software, suporte e tratamento de dados dependem do contrato revisado por advogado.

Não foi informado se haverá cessão definitiva, licença perpétua com manutenção ou
assinatura recorrente. Essa definição muda a justificativa e a arquitetura.

## Before Architecture

No desenho atual, não há fronteira do fornecedor depois do deploy. Toda opção técnica
real acrescenta uma fronteira externa explícita ou aceita que o contrato seja o único
enforcement.

## Options

### Option 1: somente contrato

O cliente recebe a aplicação funcional e a empresa trata inadimplência por aviso,
cobrança, resolução e demais medidas previstas no contrato. Não existe desligamento
técnico remoto. O [diagrama](../diagrams/license-suspension-control-contract-only-after.mmd)
preserva self-hosting integral.

É a opção mais segura contra abuso de backdoor e a mais confiável operacionalmente.
Em troca, o cliente pode continuar usando o sistema durante a disputa. Ela é adequada
se a relação comercial e as garantias jurídicas forem suficientes.

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Enforcement | Inexistente | Contratual | Nenhuma autoridade remota | Cobrança não é técnica |
| Disponibilidade | Cliente | Cliente | Sem dependência do fornecedor | Menor poder de suspensão |

### Option 2: leases de licença assinados

**Incremento selecionado para implementação.** Antes de operar um serviço contínuo de
leases, a versão mínima usa a mesma separação criptográfica em comandos offline de uso
único. O fornecedor guarda a chave privada e gera `suspend` ou `activate`; a instalação
guarda somente a chave pública, verifica expiração/identidade e registra cada comando
para impedir replay. Não há heartbeat nem dependência de rede nesta primeira versão.

Um serviço sob seu controle recebe o estado da cobrança e emite um lease assinado com
campos como `installation_id`, `customer_id`, `product`, `state`, `issued_at`,
`expires_at`, `grace_until` e `sequence`. A chave privada fica somente no serviço; a
instalação possui apenas a chave pública e não consegue fabricar um lease ativo.

A aplicação renova em segundo plano e guarda o último lease válido. Estados sugeridos:
`active`, `past_due_notice`, `grace`, `restricted_read_only` e `terminated_offboarding`.
Os prazos vêm do contrato. Bloqueio de rede ou queda do serviço usa o lease em cache e
uma carência suficiente; depois entra em leitura, não em destruição.

O [diagrama](../diagrams/license-suspension-control-signed-license-lease-after.mmd)
mostra que a decisão é externa, mas o enforcement ainda é local. No sistema atual, o
gate deve ficar no backend antes de criar pedido/checkout ou executar outras mutações.
O frontend apenas mostra avisos. Pagamentos iniciados, login, relatórios, backup e
exportação continuam conforme matriz contratual.

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Estado | Ausente | Lease assinado | Configuração local não ativa licença | Serviço e chaves |
| Falha externa | Não aplicável | Cache + carência | Evita desligamento acidental | Lógica temporal |
| Suspensão | Não existe | Somente leitura | Preserva dados e offboarding | Matriz de rotas |
| Root do cliente | Controle total | Ainda pode patchar | Resistência proporcional, não garantia | Limitação contratual |

Rollback: emitir lease ativo com validade ampliada e desabilitar enforcement enquanto
mantemos logs. A introdução deve começar em modo `observe_only`, sem bloquear clientes.

### Option 3: serviço essencial hospedado pelo fornecedor

Uma capacidade que o produto realmente precisa — escolhida com cuidado para não
transferir dados desnecessários — passa a ser uma API multi-tenant sua. O cliente pode
modificar a instalação, mas não reativar essa capacidade apenas alterando arquivos
locais. O [diagrama](../diagrams/license-suspension-control-vendor-essential-service-after.mmd)
expõe essa dependência.

Esta é a opção mais forte contra bypass local, mas também a mais pesada. Sua empresa
assume SLO, plantão, isolamento de tenants, backup, observabilidade, resposta a
incidentes e continuidade. A indisponibilidade da sua API impacta clientes adimplentes;
por isso precisamos de degradação parcial, timeouts e contrato de nível de serviço.

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Capacidade crítica | Local | API do fornecedor | Patch local não basta | Produto híbrido/SaaS |
| Dados | Permanecem locais | Fluxo mínimo acordado | Nova fronteira LGPD | Revisão de dados |
| Disponibilidade | Cliente | Compartilhada | Enforcement forte | SLO e on-call |
| Migração | Nenhuma | Extração de serviço | Isolamento central | Maior projeto |

Rollback exige manter temporariamente a capacidade local durante dual-run. Depois da
remoção, um rollback completo volta a reduzir a força do enforcement.

## Comparison

| Dimension | Opção 1 | Opção 2 | Opção 3 |
| --- | --- | --- | --- |
| Segurança | Sem canal privilegiado; sem enforcement | Chave privada externa; bypass por patch | Melhor resistência local; API vira alvo crítico |
| Performance | Sem efeito | Renovação em background; gate local | Hop remoto no caminho escolhido |
| Memória | Sem efeito | Lease/cache pequenos | Capacidade adicional no fornecedor |
| Confiabilidade | Totalmente cliente | Nova dependência amortecida por carência | Dependência direta de SLA e rede |
| Operação | Cobrança manual/jurídica | Serviço de licença e auditoria | Operação SaaS completa |
| Migração | Contratual | Média e aditiva | Alta e arquitetural |

## Recommendation

Eu escolheria a Opção 2 para uma licença recorrente comum, aceitando e documentando
que ela é enforcement proporcional. Se você pretende entregar root e fonte, mas quer
garantia técnica contra alteração deliberada, eu escolheria a Opção 3 ou mudaria a
oferta para hospedagem administrada por você. Não prometeria uma garantia que um
controle puramente local não consegue cumprir.

## Evidence Coverage And Residual Risk

| Evidence | Option 1 | Option 2 | Option 3 | Tactical protection |
| --- | --- | --- | --- | --- |
| E1 — roteador central | Unaffected | Addresses | Mitigates | Política servidor, nunca só React |
| E3 — configuração local | Unaffected | Mitigates | Addresses | Nenhum segredo do fornecedor em `.env` |
| E4 — schema sem licença | Unaffected | Addresses | Mitigates | Audit local e externo |
| E5 — host do cliente | Unaffected | Mitigates | Addresses | Declarar risco de root e testar tamper |

O principal risco da Opção 2 é bypass deliberado. O principal risco da Opção 3 é sua
empresa se tornar um ponto central de indisponibilidade ou comprometimento. Ambas
precisam de separação de funções: cobrança pode marcar inadimplência, mas suspensão
manual excepcional deve exigir MFA, motivo e, idealmente, segunda aprovação.

## Migration And Rollout

Primeiro, advogado e área comercial fecham o modelo: licença versus cessão, prazos,
avisos, carência, recursos restritos, reativação, exportação, suporte e término. Depois
definimos a máquina de estados e a matriz de rotas sem escrever código.

Na Opção 2, construímos o emissor de leases, gestão de chaves e ambiente de testes;
adicionamos verificação e auditoria no backend; implantamos `observe_only`; comparamos
estado de cobrança e estado calculado; enviamos avisos de teste; e só então habilitamos
restrição para uma instalação piloto. React, workers de pagamento e healthcheck têm
comportamento explícito em cada estado.

Na Opção 3, antes disso escolhemos a capacidade remota, contrato da API, dados mínimos,
SLO e isolamento. O rollout usa dual-run e comparação de resultados antes de retirar
o caminho local.

## Validation Plan

- assinatura: lease falso, alterado, expirado, replayado, revogado e com sequência antiga;
- tempo: relógio incorreto, reinício, expiração, carência e reativação;
- rede: serviço lento, DNS bloqueado, TLS inválido e indisponibilidade prolongada;
- estados: ativo, aviso, carência, restrito, encerrado e retorno ao ativo;
- rotas: leitura, escrita, pagamento já iniciado, login, relatório, backup e exportação;
- tamper: `.env`, banco local, bloqueio de outbound e patch explícito do verificador;
- multi-tenant: um cliente nunca altera ou consulta o entitlement de outro;
- operação: cobrança errada, reversão urgente, rotação de chave e desastre do serviço;
- LGPD: inventário e minimização de dados enviados ao fornecedor;
- performance: p95 da API local e da capacidade remota contra baseline medido.

## Implementation Work Packages

A variante offline da Opção 2 foi selecionada. Os pacotes de implementação são:

- contrato, política e matriz de estados;
- identidade de instalação e serviço de entitlements;
- assinatura, rotação e cache de leases;
- policy gate e modo somente leitura no backend;
- avisos, auditoria, painel e reativação;
- exportação/offboarding e continuidade de pagamentos;
- piloto `observe_only`, drills e rollout gradual.

O plano executável desta variante está em
[Implementation Plan](../implementation/signed-license-lease.md).

## Open Questions

- O cliente terá root e também o repositório/código-fonte?
- A negociação é venda/cessão ou licença recorrente?
- Quais funções devem continuar durante a suspensão?
- Qual é a carência e quais notificações o contrato exige?
- Quanto tempo você aceita operar um serviço externo crítico?
