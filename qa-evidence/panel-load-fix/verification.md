# Correção do carregamento do painel — 02/10/2026

- Causa confirmada por diagnóstico somente leitura autorizado: produção usa MariaDB 11.8.9; `SELECT ANY_VALUE(1)` retorna erro 1305 (função inexistente), e `SELECT MAX(1)` funciona.
- Correção publicada: `e61415a2f8bbac624088e106e15d213b82472113`, branch `codex/estabilizacao-operacional`. Versão anterior: `e261f145b41ba07a819031156d17476cad765739`.
- Backup manual Hostinger de arquivos e banco concluído em 02/10/2026 às 10:34 (America/Fortaleza); captura `hostinger-backup.jpg`.
- `npm.cmd run check:release` aprovado: tipos, lint, 27 unitários, sete integrações, build e 18 jornadas desktop/celular. Banco local `_test`, credenciais TEST_DB_* e provedores falsos; encerramento normal.
- CI Node 22: https://github.com/airtonosj/camisaria-mendes-prototipo/actions/runs/37014453421 — `completed/success`.
- Hostinger: implantação do commit `e61415a2` concluída e marcada como atual.
- `https://camisariamendes.com.br/api/health`: `ok=true`, commit `e61415a2f8bbac624088e106e15d213b82472113`, build `2026-10-02T13:39:56.137Z`, banco conectado, schema `025_campaign_receivers`, armazenamento pronto e licença ativa.
- Painel autenticado: botão Tentar novamente carregou a visão geral; aba Campanhas mostrou as quatro campanhas; recarregamento completo manteve a visão geral funcional e sem mensagem de falha. Captura dos indicadores sem dados pessoais em `panel-published.jpg`.
- Nenhuma migração nova, alteração direta de dados de produção, compra ou envio real foi executado. A correção altera somente a consulta de leitura e adiciona regressão/documentação.
- Outras alterações locais foram preservadas; as capturas regeneradas pelo E2E não integraram o commit.
