# Contexto local: licenciamento e suspensão contratual

Análise realizada em 2026-08-20 sobre a revisão
`5469b728f6c21bde7e082cef3f826931eab3420c` da aplicação Camisaria Mendes.

O esclarecimento do objetivo substitui o plano anterior de desligamento emergencial:
o sistema será instalado na infraestrutura do cliente e a licença poderá ser suspensa
por inadimplência conforme contrato.

## Evidências do código

| ID | Fonte | O que estabelece |
| --- | --- | --- |
| E1 | `api/server.mjs` | O backend Node concentra autenticação, pedidos, checkout, pagamentos, painel e entrega do frontend. |
| E2 | `api/auth.mjs` | Já existem sessões atribuídas a usuários, mas não há identidade da instalação ou licença. |
| E3 | `api/config.mjs` | A configuração de produção é local e controlada por variáveis da hospedagem. |
| E4 | `database/migrations/001_initial_schema.sql` | O banco preserva usuários e históricos, mas não possui estados de entitlement/licença. |
| E5 | `docs/deploy-hostinger-business.md` | O código Node é implantado na host; quem controla a host pode alterar o processo e sua configuração. |

## Limitação determinante

Não foi localizado contrato de licença, Dockerfile, imagem assinada, serviço de
entitlements ou módulo de ativação. Também não foi informado se o cliente receberá o
código-fonte/repositório. Se possuir root e o código executável, o cliente pode remover
qualquer verificação puramente local. Esse fato limita a força técnica das opções.

## Referências jurídicas a validar com advogado

- Lei 9.609/1998, especialmente contrato de licença e garantias ao usuário;
- Lei 13.709/2018, especialmente finalidade, transparência, segurança e registro do tratamento;
- Código Civil, regras de inadimplemento, resolução/suspensão e notificação aplicáveis ao contrato concreto.

Esta análise não substitui parecer jurídico nem conclui que uma suspensão específica
é válida sem revisar contrato, natureza da relação e impactos operacionais.
