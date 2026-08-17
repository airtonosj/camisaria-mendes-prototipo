# Publicar na Hostinger

Para o plano Business com **Node.js Web App gerenciado**, siga primeiro
[`deploy-hostinger-business.md`](deploy-hostinger-business.md). As instrucoes abaixo
continuam sendo a referencia para uma VPS com acesso root e systemd.

Este guia cobre banco, API, painel com login real e infraestrutura. O deploy público de
pedidos permanece bloqueado até o checkout InfinitePay passar por uma compra real controlada.
Ele assume uma **VPS da Hostinger** com acesso SSH, porque a hospedagem compartilhada não
mantém um processo Node. Checkout, webhook e `payment_check` já estão implementados; a
trava só deve ser aberta depois de configurar domínio, SMTP e a conta da camisaria.

## 1. Requisitos na VPS

- Node.js 20 ou mais novo;
- MySQL 8 (o da própria Hostinger ou instalado na VPS);
- uma pasta para o projeto, por exemplo `/var/www/camisaria`.

## 2. Banco e usuários do MySQL

Dois usuários, de propósito: o da aplicação não pode alterar a estrutura do banco. Se um
dia a API for explorada, o estrago fica limitado aos dados — não ao schema.

```sql
CREATE DATABASE camisaria_mendes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Usuário da aplicação: lê e grava dados, e nada além disso.
CREATE USER 'camisaria_app'@'localhost' IDENTIFIED BY 'senha-longa-e-aleatoria';
GRANT SELECT, INSERT, UPDATE, DELETE ON camisaria_mendes.* TO 'camisaria_app'@'localhost';

-- Usuário das migrações: usado só quando você roda `npm run db:migrate`.
CREATE USER 'camisaria_migrator'@'localhost' IDENTIFIED BY 'outra-senha-longa';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES,
      CREATE VIEW, SHOW VIEW, TRIGGER ON camisaria_mendes.* TO 'camisaria_migrator'@'localhost';

-- Usuário somente para o dump agendado.
CREATE USER 'camisaria_backup'@'localhost' IDENTIFIED BY 'terceira-senha-longa';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT ON camisaria_mendes.* TO 'camisaria_backup'@'localhost';

FLUSH PRIVILEGES;
```

## 3. O arquivo `.env`

Copie `.env.example` para `.env` e preencha. O mínimo para publicar:

> **Não escreva `NODE_ENV` neste arquivo.** O Vite também lê o `.env` do projeto, e um
> `NODE_ENV=development` ali faz `npm run build` gerar o pacote de desenvolvimento —
> que leva campanhas, pedidos e credenciais de demonstração para dentro do site
> publicado. O ambiente da API é `APP_ENV`.

```bash
APP_ENV=production
API_HOST=127.0.0.1
API_PORT=3333
CORS_ORIGIN=https://seudominio.com.br
PUBLIC_APP_URL=https://seudominio.com.br

DB_HOST=127.0.0.1
DB_NAME=camisaria_mendes
DB_USER=camisaria_app
DB_PASSWORD=<a senha do usuário da aplicação>

UPLOADS_DIR=/var/lib/camisaria-mendes/uploads

PAYMENT_PROVIDER=infinitepay
INFINITEPAY_HANDLE=<InfiniteTag sem o caractere $>
INFINITEPAY_CHECKOUT_ENABLED=false

SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=contato@seudominio.com.br
SMTP_PASSWORD=<senha da caixa>
SMTP_FROM=contato@seudominio.com.br

BACKUP_DIR=/var/backups/camisaria-mendes
BACKUP_RETENTION_DAYS=14
BACKUP_DB_USER=camisaria_backup
BACKUP_DB_PASSWORD=<senha do usuário de backup>
HEALTHCHECK_URL=https://seudominio.com.br/api/health
```

Gere o token com:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

A API avisa no boot quando a InfiniteTag está vazia, quando o
`PUBLIC_APP_URL` aponta para o próprio servidor e quando o usuário de demonstração
`admin@teste.com` ainda existe no banco. Leia o log da primeira subida.

Em produção essas conferências críticas são bloqueantes: a API não abre a porta se faltar
HTTPS, SMTP, usuário restrito do banco, diretório persistente de uploads ou se o checkout
InfinitePay não estiver habilitado. Painel, scripts e manutenções administrativas devem usar
uma sessão temporária de uma conta da Camisaria; não existe chave administrativa estática.

## 4. Instalar e migrar

```bash
npm ci
DB_USER=camisaria_migrator DB_PASSWORD='outra-senha-longa' npm run db:migrate
```

`npm run db:seed` carrega campanhas fictícias e o usuário `admin@teste.com`. Ele **recusa
rodar com `APP_ENV=production`** e não deve ser usado no servidor publicado.

## 5. Criar o acesso da camisaria

```bash
npm run user:admin
```

Cria `gustavo@mendes` com a senha provisória `changeme`, marcada para **troca obrigatória
no primeiro acesso**: o painel abre direto na seção *Conta* e não libera o resto até a
senha ser trocada. Rodar o comando de novo não mexe numa conta que já existe.

Para usar outro e-mail ou outra senha inicial:

```bash
ADMIN_INITIAL_EMAIL=contato@camisariamendes.com.br ADMIN_INITIAL_PASSWORD='umaSenhaLonga' npm run user:admin
```

No primeiro acesso, em *Conta*, troque o e-mail para um endereço que receba mensagens de
verdade — é ele que a recuperação de senha vai usar.

## 6. Subir a API e o site

```bash
npm run build          # gera dist/
npm run api:start      # sobe a API em 127.0.0.1:3333
```

Use os arquivos versionados em `ops/systemd/` para manter a API e o backup diário, e
`ops/nginx/camisaria.conf` para servir o `dist/` e encaminhar `/api/` e `/uploads/`.
Troque domínio e caminhos antes de copiar para `/etc/systemd/system` e `/etc/nginx/sites-enabled`.

Use o certificado gratuito da Hostinger (ou `certbot`) para HTTPS. Navegador, site e API
ficam na mesma origem pública; `CORS_ORIGIN` deve listar exatamente esse domínio HTTPS.

> **Artes enviadas**: em produção ficam no caminho de `UPLOADS_DIR`, obrigatoriamente fora
> da pasta substituída no deploy. Inclua esse diretório no backup e preserve seu dono e
> permissões de leitura/gravação para o usuário que executa a API.

## 7. Recuperação de senha

A tela de acesso tem *Esqueci minha senha*. Ela só envia e-mail se o SMTP estiver
configurado no `.env` — sem isso, a tela diz abertamente que o envio não está disponível,
em vez de fingir que enviou.

Com o e-mail da Hostinger:

```bash
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=contato@seudominio.com.br
SMTP_PASSWORD=<senha da caixa de e-mail>
SMTP_FROM=contato@seudominio.com.br
```

O mesmo SMTP envia a confirmação ao comprador depois que o provedor confirmar o
pagamento. A mensagem inclui o código da compra e o link de acompanhamento. Faça um teste
de ponta a ponta com um pedido que tenha e-mail antes de abrir a campanha real.

Sem SMTP, quem administra o servidor gera o link manualmente:

```bash
npm run user:reset -- contato@camisariamendes.com.br
```

O link vale uma hora, só pode ser usado uma vez e derruba todas as sessões abertas
daquele usuário quando a senha é trocada.

## 8. Conferência depois de publicar

1. `curl https://seudominio.com.br/api/health` responde `{"ok":true}`;
2. a tela de acesso **não** mostra credenciais de demonstração;
3. com a API parada, a página da campanha mostra erro com *tentar novamente*, e nunca
   uma campanha fictícia;
4. um pedido de teste abre o checkout InfinitePay e permanece pendente antes do pagamento;
5. o log do boot não traz nenhum `Atenção:` pendente.
6. `npm run ops:backup` conclui e o manifesto corresponde ao dump e aos uploads;
7. uma restauração do snapshot foi testada em banco separado.

## 9. Release, backup e rollback

Siga [runbook-operacional.md](runbook-operacional.md). Ele define a árvore de releases,
troca atômica do link `current`, health check pós-restart, rollback de código, backup diário
e restauração segura em banco separado.

## 10. Integração InfinitePay

A integração de código está pronta para homologação real:

- `PAYMENT_PROVIDER=infinitepay` e `INFINITEPAY_HANDLE` já são lidos em `api/config.mjs`;
- `POST /api/orders/:numero/checkout` cria ou reutiliza o link com valor persistido;
- `POST /api/payments/infinitepay/webhook` persiste eventos idempotentes rapidamente;
- o worker chama `payment_check`, confere pedido e valor e só então muda para `paid`;
- o retorno do navegador apenas agenda a mesma reconciliação server-to-server;
- a tela do aluno já oferece Pix e cartão, sem chave fixa ou confirmação manual;
- a tabela `payment_events` já tem `UNIQUE (provider, provider_event_id)`, pronta para
  webhook reprocessado sem duplicar baixa;
- `payments` já guarda `provider`, `provider_transaction_id` e `raw_response`.

Antes de mudar `INFINITEPAY_CHECKOUT_ENABLED` para `true` na VPS, habilite o Checkout
Integrado na conta, informe a InfiniteTag sem `$` e conclua uma compra real de baixo valor.
Confira webhook, e-mail, relatório e uma repetição do mesmo evento.
