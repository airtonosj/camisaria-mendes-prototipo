# Testes locais e recuperação do ambiente

## Configuração

As suítes leem `.env.test.local`, ignorado pelo Git, e aceitam substituição por variáveis de ambiente. Preencha `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_NAME`, `TEST_DB_USER` e `TEST_DB_PASSWORD`. Só são aceitos hosts locais e bancos terminados em `_test`; a senha pode ser exclusiva de uma instância descartável de MySQL 8.

Use uma instância de teste independente, inclusive para testar criação de triggers. Não altere `log_bin_trust_function_creators` nem conceda privilégios globais no banco da aplicação só para rodar testes. Na execução desta refatoração foi usada uma instância sem binary log na porta 3317, com dados em `tmp/mysql-test`; isso não muda a porta padrão de desenvolvimento.

`npm.cmd run db:test:setup` é uma alternativa para provisionar um usuário limitado a quatro bancos de teste usando um administrador local. Não substitui uma instância MySQL disponível; com binary log habilitado, a criação de triggers pode exigir preparação específica da instância de teste. O comando recusa produção e não sobrescreve `.env.test.local`.

## Execução e diagnóstico

- `npm.cmd test`: tipos, lint, regras e integrações sequenciais sobre o banco de teste principal.
- `npm.cmd run build` antes de `npm.cmd run test:e2e`: as jornadas servem o build atual.
- `npm.cmd run check:release`: fecha a sequência completa.
- `node tests/restore-rehearsal.mjs`: ensaio sobre o banco de teste já preparado. Exige os clientes mysql/mysqldump; no Windows aceita `TEST_MYSQL_BIN` e `TEST_MYSQLDUMP_BIN`. Cria destino novo `_restore_test` e diretório temporário; nunca sobrescreve dados existentes.
- `ECONNREFUSED` na porta de teste: confira se a instância isolada está ativa antes de repetir a suíte. Processos iniciados por um terminal podem encerrar quando a sessão termina.
- Porta 4186 ocupada: identifique e encerre somente a execução anterior do servidor E2E. Não habilite reutilização de servidor desconhecido.
- No sandbox Windows, Playwright pode precisar de permissão para encerrar sua própria árvore de processos. Uma falha de teardown não autoriza encerrar servidores da aplicação.
- Erro de renomeação atômica no ensaio de backup: o script de ensaio usa o diretório temporário do sistema; não reduza a proteção que mantém snapshots incompletos fora da lista de backups disponíveis.

Os provedores são falsos. O navegador recebe uma página de checkout fictícia interceptada localmente, sem acessar a InfinitePay. Os testes de SMTP abrem servidores locais; a prévia de retirada não confirma envio.

## Evidências

`qa-evidence/structure` contém métricas, comparação visual e restauração sem dados de clientes. `test-results` e `playwright-report` são temporários e ignorados pelo Git. Evite anexar traces de produção: podem conter dados pessoais e credenciais de sessão.
