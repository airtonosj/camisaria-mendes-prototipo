# Revisão do carregamento do painel — 02/10/2026

## Correções locais

- A consulta anterior ainda falhava com erro 1055 no MariaDB com `ONLY_FULL_GROUP_BY`. Os pedidos agora são agregados por campanha em uma subconsulta, antes dos JOINs. Isso preserva uma linha por campanha, os totais de pedidos ativos, o recebedor e a proibição de excluir campanhas com histórico, inclusive cancelado.
- A fronteira HTTP do navegador valida a listagem administrativa: datas, fases, totais inteiros seguros, recebedores e cupons. Respostas HTTP 200 incompletas passam pelo estado de erro recuperável, sem produzir um painel vazio aparentemente válido. Campos adicionais continuam aceitos.
- A suíte completa reproduziu também `ER_CHECKREAD` (1020) em dois pedidos concorrentes no MariaDB 11.8.9. A criação do pedido usa `READ COMMITTED` somente naquela transação, mantendo as travas de campanha e cupom e o isolamento padrão das outras transações. O teste disputa o último uso entre oito clientes: um deve receber 201 e sete, 409 `COUPON_EXHAUSTED`; nenhum pode receber 500.
- O CI foi preparado para executar o gate em MySQL 8.0 e MariaDB 11.8.9, em máquinas separadas. Essa configuração ainda não foi publicada nem executada remotamente.

## Cobertura acrescentada

`tests/campaign-list.mjs` compara a saída real do serviço com um resultado esperado independente, usando 52 campanhas e 2.423 pedidos fictícios. Inclui todas as fases e estados de pagamento, pedidos cancelados, ausência de pedidos, recebedores ativos/inativos/ausentes e compartilhados, caracteres acentuados, alterações de cadastro, proteção por chave estrangeira, cupons ativos e históricos e isolamento entre campanhas.

Também verifica totais de 6 bilhões de centavos, prioridade da arte-base/foto/mockup, ordenação de fotos, mockup somente com costas, variantes inativas e overlays. Executa quatro combinações de agrupamento padrão/estrito e collations `utf8mb4_general_ci`/`utf8mb4_unicode_ci`, configura as quatro conexões do pool e compara dez leituras simultâneas. Uma falha de conexão deve ser propagada, jamais convertida em lista vazia.

`tests/e2e/panel-load.spec.mjs` acrescenta seis jornadas em cada tamanho desktop/celular: HTTP 500, conexão interrompida, JSON inválido, lista ausente, totais inválidos e timeout, sempre com recuperação por nova tentativa. Verifica recarga e navegação real após recuperar o servidor. Capturas em `qa-evidence/panel-review/`.

`tests/unit/domain.test.mjs` testa contratos válidos e malformados, inclusive dinheiro negativo/fracionário/inseguro, datas, fases, recebedores e histórico de cupons.

## Execução

- MariaDB 11.8.9: `npm.cmd run check:release` aprovado, com encerramento normal; tipos, lint, 28 unitários, 8 integrações, build e 30 jornadas desktop/celular. Instância portátil encerrada após os testes.
- MySQL 8.0.46: `npm.cmd run check:release` aprovado após todos os ajustes, com encerramento normal; tipos, lint, 28 unitários, 8 integrações, build e 30 jornadas desktop/celular.
- Node local 24.18.0. A matriz de CI prepara Node 22, mas sua execução remota ainda depende da publicação.

A revisão não omite as falhas intermediárias: a consulta antiga reproduziu erro 1055 com agrupamento estrito; a suíte MariaDB reproduziu erro 1020 em disputa pelo cupom antes da correção. Ao ampliar de dois para oito pedidos, o teste também atingiu o limite de abuso do cliente utilizado pelas demais etapas; a fixture concorrente ganhou um endereço documental próprio, preservando a proteção e seu teste separado. A execução final MariaDB passou sem essas falhas.

Os dois gates finais executaram sequencialmente, totalizando 60 jornadas de navegador. Capturas de falha e recuperação desktop/celular inspecionadas. `git diff --check` aprovado; alterações locais alheias preservadas.

Todos os testes usam bancos locais com sufixo `_test`, credenciais `TEST_DB_*` e provedores falsos. A instância MariaDB portátil usa somente loopback e não instala serviço. Nenhum dado de produção, pagamento ou envio real foi utilizado.

## Limites e publicação

Não existe garantia absoluta contra indisponibilidade de banco, rede ou hospedagem. A cobertura verifica correção dos dados e comportamento de falha/recuperação nos cenários descritos; não representa um teste de carga em escala de produção.

As alterações desta revisão permanecem locais, sem commit, push ou deploy. A publicação anterior da correção de `ANY_VALUE`, commit `e61415a2f8bbac624088e106e15d213b82472113`, foi validada no painel. Publicar esta revisão exige autorização específica.

Referência técnica: [isolamento por transação no MariaDB](https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/set-commands/set-transaction).
