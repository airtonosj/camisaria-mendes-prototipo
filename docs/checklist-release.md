# Checklist de release

1. Conferir objetivo, diff e contratos afetados. Registrar referência anterior e alterações locais.
2. Executar `npm.cmd run check:release` em MySQL isolado; revisar falhas e screenshots desktop/celular quando houver mudança visual.
3. Registrar `dist/version.json`, resultados e limitações em `docs/refatoracao-validacao.md`.
4. Antes de publicação autorizada, identificar versão anterior e backup de banco/uploads. Ensaiar restauração isolada quando mudar operação ou banco.
5. Aplicar migrações explicitamente antes da ativação quando a hospedagem permitir. Caso contrário, manter `MIGRATIONS_ON_START=true`.
6. Publicar somente após autorização; verificar versão em `/api/health`, saúde, login, campanha e consulta do pedido.
7. Em falha, reativar o artefato anterior compatível com o schema. Não reverter schema destrutivamente nem substituir histórico por backup sem plano específico de recuperação.

Procedimento principal: [Hostinger](deploy-hostinger-business.md). Alternativa: [VPS](runbook-operacional.md). Compras e mensagens reais exigem autorização própria.
