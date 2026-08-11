# Deploy na Hostinger Business

Este e o fluxo de publicacao da aplicacao completa. O projeto deve ser criado como
**Node.js Web App**, nao como frontend Vite estatico.

## Configuracao do aplicativo

- Repositorio: `airtonosj/camisaria-mendes-prototipo`
- Branch: `codex/estabilizacao-operacional` durante a homologacao
- Node.js: `22.x`
- Build: `npm run build`
- Start: `npm start`
- Output directory: `dist`
- Entry file, quando solicitado: `api/start.mjs`
- Porta: `3000` (a variavel `PORT` fornecida pela plataforma tem prioridade)

O comando inicial aplica as migracoes SQL idempotentes, provisiona a conta inicial
quando as variaveis correspondentes existem e sobe o servidor que entrega React,
`/api` e `/uploads` na mesma origem.

## Variaveis do hPanel

Configure sem aspas e sem colocar segredos no GitHub:

```dotenv
APP_ENV=production
API_HOST=0.0.0.0
API_PORT=3000
TRUST_PROXY=true
CORS_ORIGIN=https://camisariamendes.com.br
PUBLIC_APP_URL=https://camisariamendes.com.br
ADMIN_API_TOKEN_ENABLED=false

DB_HOST=localhost
DB_PORT=3306
DB_NAME=<nome completo informado pela Hostinger>
DB_USER=<usuario completo informado pela Hostinger>
DB_PASSWORD=<senha do banco>
DB_CONNECTION_LIMIT=10

UPLOADS_DIR=/home/u374132860/domains/camisariamendes.com.br/uploads
BACKUP_DIR=/home/u374132860/backups/camisaria-mendes
BACKUP_RETENTION_DAYS=14

ADMIN_INITIAL_NAME=Gustavo Mendes
ADMIN_INITIAL_EMAIL=<email real da camisaria>
# ADMIN_INITIAL_PASSWORD e apenas para o primeiro acesso e deve ser removida depois da troca.

SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=<caixa de email real>
SMTP_PASSWORD=<senha da caixa>
SMTP_FROM=<mesma caixa ou remetente autorizado>
SMTP_FROM_NAME=Camisaria Mendes

PAYMENT_PROVIDER=infinitepay
INFINITEPAY_HANDLE=gustavo-henrique-9yt
INFINITEPAY_CHECKOUT_ENABLED=false
INFINITEPAY_REQUEST_TIMEOUT_MS=8000
PAYMENT_RECONCILIATION_INTERVAL_MS=5000
EMAIL_DELIVERY_INTERVAL_MS=30000
```

Os caminhos persistentes acima foram configurados no hPanel em 11/08/2026. Eles ficam
fora da pasta `nodejs` substituida nos deploys e precisam permitir leitura e gravacao
pelo aplicativo.

`APP_ENV=production` deve ser ativado antes da homologacao, mas o checkout permanece
`false`. Somente depois da compra e do reembolso reais, e com o checklist aprovado,
altere `INFINITEPAY_CHECKOUT_ENABLED=true` e faça o redeploy final.

## Validacao apos o redeploy

1. `/api/health` retorna JSON com `ok: true` e `schema.ready: true`.
2. A tela de acesso nao mostra credenciais demonstrativas.
3. A conta inicial entra e exige troca da senha provisoria.
4. Uma campanha criada no painel reaparece depois de reiniciar o aplicativo.
5. Upload de arte continua disponivel depois de um novo deploy.
6. Um pedido permanece pendente antes do pagamento.
7. O checkout abre na conta `gustavo-henrique-9yt`.
8. Somente `payment_check` confirmado muda o pedido para pago.

O bootstrap nunca imprime a senha no log. Depois do primeiro acesso, remova
`ADMIN_INITIAL_PASSWORD` do hPanel e redeploye. A conta persistida permanece no MySQL;
em `APP_ENV=production`, a API recusa iniciar enquanto a variável existir ou alguma
conta ativa ainda estiver marcada para troca obrigatória.
