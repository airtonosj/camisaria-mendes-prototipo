# Runbook operacional

Este é o procedimento curto para publicar, observar e recuperar a Camisaria Mendes. Ele
assume Linux, Nginx, systemd, MySQL 8 e releases em `/var/www/camisaria/releases`.

## Estrutura persistente

```text
/var/www/camisaria/current -> /var/www/camisaria/releases/<release>
/var/www/camisaria/releases/
/var/lib/camisaria-mendes/uploads/
/var/backups/camisaria-mendes/
/etc/camisaria-mendes/api.env
```

O código e o `dist/` são substituíveis. Uploads, banco, backups e `.env` nunca ficam dentro
da release.

## Preparação única

1. Crie o usuário Linux `camisaria` sem login interativo.
2. Crie as pastas acima com dono `camisaria:camisaria` e modo `750`; use `700` em backups.
3. Copie `ops/systemd/*.service`, o timer e `ops/nginx/camisaria.conf` para os diretórios do sistema.
4. Ajuste domínio, certificado e caminhos no Nginx; valide com `nginx -t`.
5. Preencha `/etc/camisaria-mendes/api.env` com modo `production`, HTTPS, SMTP, Pix,
   banco restrito, `UPLOADS_DIR` e `BACKUP_DIR` persistentes.
6. Habilite `camisaria-api.service` e `camisaria-backup.timer`.

## Publicação de uma release

Prepare a nova pasta sem alterar o link `current`:

```bash
cd /var/www/camisaria/releases/<release>
npm ci
npm test
npm run build
npm run ops:backup
DB_USER="$MIGRATION_DB_USER" DB_PASSWORD="$MIGRATION_DB_PASSWORD" npm run db:migrate
```

O banco de teste do `npm test` precisa terminar em `_test` e usar credencial autorizada
somente nesse banco. O backup precisa terminar antes da migração.

Depois, anote o destino atual, troque o link simbolicamente e valide:

```bash
readlink -f /var/www/camisaria/current
ln -s /var/www/camisaria/releases/<release> /var/www/camisaria/current.next
mv -Tf /var/www/camisaria/current.next /var/www/camisaria/current
systemctl restart camisaria-api
HEALTHCHECK_URL=https://camisariamendes.com.br/api/health npm run ops:health
```

Também confira login, uma campanha privada e um pedido pendente sem confirmar pagamento.

## Rollback de código

Se o health check falhar, restaure o link para a release anterior, reinicie e execute o
health check novamente. Não apague a release com problema até entender a causa.

Migrações deste projeto são cumulativas. Voltar apenas o código é seguro somente quando a
release anterior entende o schema novo. Se uma futura migração for incompatível, restaure
o backup em um banco separado, valide a contagem e só então faça a troca controlada.

## Backup e restauração

`npm run ops:backup` cria uma pasta com `database.sql`, `triggers.sql`, cópia de `uploads/` e
`manifest.json` com tamanho e SHA-256. Os triggers ficam separados para evitar dumps
incompatíveis entre clientes MySQL e MariaDB. A pasta só recebe o nome definitivo quando todas as
etapas terminam. Snapshots antigos são removidos apenas após um backup novo bem-sucedido.

Teste de restauração, sempre em banco separado:

```bash
mysql -u camisaria_migrator -p -e "CREATE DATABASE camisaria_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u camisaria_migrator -p camisaria_restore_test < /var/backups/camisaria-mendes/<snapshot>/database.sql
```

Compare campanhas, pedidos, pagamentos e usuários com a origem. Para uploads, copie o
snapshot para uma pasta temporária e confirme que as URLs de arte retornam HTTP 200 antes
de substituir qualquer diretório ativo.

O comando automatizado recusa banco existente e exige o sufixo `_restore_test`:

```bash
RESTORE_DB_NAME=camisaria_release_restore_test \
RESTORE_UPLOADS_DIR=/tmp/camisaria-restore/uploads \
npm run ops:restore:test -- /var/backups/camisaria-mendes/<snapshot>
```

## Logs e diagnóstico

```bash
journalctl -u camisaria-api -n 200 --no-pager
journalctl -u camisaria-backup -n 100 --no-pager
systemctl status camisaria-api camisaria-backup.timer
curl -fsS https://camisariamendes.com.br/api/health
```

O health só fica verde com banco, migração esperada e armazenamento de uploads prontos.
Alertas de SMTP, disco, certificado e falha de backup devem ser tratados antes do piloto.
