# Camisaria Mendes

Campanhas privadas, pedidos e acompanhamento de produção. React/TypeScript no navegador; Node.js ESM, HTTP nativo e MySQL 8 no servidor. Hospedagem principal: Hostinger Node.js Web App.

## Começar localmente

1. Instale Node 22.12+ e MySQL 8; execute `npm.cmd ci`.
2. Copie `.env.example` para `.env` e configure um banco de desenvolvimento local. Nunca copie credenciais de produção para testes.
3. Execute `npm.cmd run db:create` e `npm.cmd run db:migrate`. `npm.cmd run db:seed` cria apenas dados demonstrativos locais.
4. Em terminais separados: `npm.cmd run api:dev` e `npm.cmd run dev`.
5. Para servir o build e a API juntos: `npm.cmd run build` e `npm.cmd start`.

No Linux, use `npm` em lugar de `npm.cmd`. A versão publicada nunca usa dados demonstrativos como resposta à indisponibilidade da API.

## Verificar

Configure `.env.test.local` (ignorado pelo Git) com `TEST_DB_HOST=127.0.0.1`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD` e `TEST_DB_NAME=camisaria_local_test`. Use uma instância exclusiva de MySQL; as suítes recriam bancos de teste. O usuário deve poder criar e migrar os bancos de teste derivados, inclusive triggers. Não execute duas integrações sobre o mesmo banco.

| Comando | Verificação |
|---|---|
| `npm.cmd test` | Tipos, lint, regras e integração MySQL/API |
| `npm.cmd run build` | Build, identificação da versão e ausência de demonstração no artefato |
| `npm.cmd run test:e2e` | Jornadas desktop/celular sobre o build atual, servidor próprio e provedores falsos |
| `npm.cmd run check:release` | Sequência completa anterior |

No Windows, as jornadas usam Edge instalado. No Linux: `npx playwright install --with-deps chromium`. O banco das jornadas usa o sufixo `_e2e_test`; migração 024 usa `_pickup_recovery_test`. Nenhuma suíte envia e-mail real ou cobra pagamentos reais. Portas ocupadas causam falha, sem reutilizar servidores desconhecidos.

Detalhes de isolamento e recuperação do ambiente: [testes locais](docs/testes.md).

## Encontrar o código

- `src/features`: campanhas, conta, pedidos, relatórios e checkout.
- `src/features/admin/AdminDashboard.tsx`: sessão, navegação e composição do painel.
- `src/lib/http.ts`: transporte da API no navegador; `src/api.ts`: fachada compatível.
- `shared`: contratos, contatos e regras puras compartilhadas.
- `api/http`: roteamento, autenticação HTTP, limites e respostas.
- `api/modules`: serviços e repositórios por funcionalidade.
- `api/runtime`: readiness, workers e identificação da versão.
- `database/migrations`: histórico SQL; `ops`: comandos operacionais.

## Continuidade e operação

Leia [estado atual](docs/estado-atual.md), [arquitetura](docs/arquitetura.md) e [validação](docs/refatoracao-validacao.md). Para publicar, siga [Hostinger](docs/deploy-hostinger-business.md) e o [checklist](docs/checklist-release.md). O [runbook VPS](docs/runbook-operacional.md) é uma alternativa. Documentos em `docs/historico` são registros antigos, sem comprovação do estado publicado.

Pagamento só é confirmado no servidor pelo provedor. Commit, push, publicação, compra real e envio real exigem autorização específica.
