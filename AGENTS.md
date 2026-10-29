# Camisaria Mendes

- React/TypeScript, Node ESM e MySQL 8. Hospedagem principal: Hostinger Node.js Web App.
- Leia `docs/estado-atual.md` e `docs/arquitetura.md` para continuidade e responsabilidades.
- Preserve IDs, históricos, URLs, contratos HTTP, carrinhos e rascunhos existentes.
- Pagamento é confirmado no servidor pelo provedor; redirect nunca comprova pagamento.
- O serviço controla a transação; consultas recebem a mesma conexão.
- No Windows use `npm.cmd`. Verificações: `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:e2e`.
- Testes usam somente banco local terminado em `_test`, credenciais TEST_DB_* e provedores falsos. Nunca apontar testes para produção.
- Não executar suites que recriam o mesmo banco em paralelo.
- Não registrar tokens, senhas, corpos de requisição ou contatos pessoais em logs.
- Mudança visual exige comparação desktop/celular; bug relevante exige regressão.
- Commit, push, deploy, compra real e envio real exigem autorização específica.
- Ao concluir, informe alterações, verificações executadas, limitações e próximo passo.
