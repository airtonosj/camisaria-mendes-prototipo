# Backend MySQL — primeira fundação

A base usa Node.js para a API e MySQL 8 para persistência. As telas do aluno e o painel
da camisaria operam sobre o banco. Em desenvolvimento, com a API fora do ar, o painel cai
em dados de demonstração e avisa na tela; no build de produção esse caminho não existe —
falha de servidor aparece como erro com "tentar novamente".

## Decisões do domínio

- O estado operacional pertence à **campanha**, nunca ao produto ou à variante.
- Uma campanha só avança ou retorna uma etapa por operação.
- Todo retorno exige motivo e gera uma linha em `campaign_phase_history`.
- **Baby look é tamanho, não corte.** Existem dois cortes (`common`, `oversized`) e um catálogo de tamanhos em dois grupos: `standard` (`PP`..`XG`) e `baby_look` (`PPB`..`XGB`).
- Corte, cor e preço formam uma variante disponível dentro de uma campanha. O tamanho **não** entra na variante: o preço é do corte e vale para todos os tamanhos dele.
- Cada campanha declara em `campaign_model_sizes` quais tamanhos libera para cada corte. Um pedido só é aceito num tamanho que a campanha liberou para aquele corte.
- **A arte pertence à campanha, não à variante.** `campaigns.art_front_url` é obrigatória e serve para todos os cortes e tamanhos; `campaigns.art_back_url` é opcional e, quando ausente, o aluno vê só a frente.
- O preço é copiado para `order_items` no momento da compra, preservando o histórico.
- Somente pedidos com `payment_status = 'paid'` aparecem nos relatórios oficiais.
- A transição legítima para `paid` agenda, na mesma transação, um e-mail com o código da compra para o comprador.
- Redirecionamento do navegador não confirma pagamento; webhook e retorno apenas solicitam a validação server-to-server por `payment_check`.
- `Idempotency-Key` impede que uma tentativa repetida crie dois pedidos.
- O painel autentica com login e usa um token de sessão atribuído a uma conta da camisaria:
  12 horas de inatividade e no máximo 7 dias de vida. Não existe credencial administrativa
  estática ou sem expiração.
- Quem mudou fase, confirmou pagamento ou registrou entrega fica gravado no histórico.

## Preparar o banco

1. Copie `.env.example` para `.env` e informe as credenciais do MySQL local.
2. Execute `npm run db:create` para criar o banco `camisaria_mendes` com `utf8mb4`.
3. Execute `npm run db:migrate` para aplicar os arquivos de `database/migrations`.
4. Em desenvolvimento, execute `npm run db:seed` para cadastrar as duas campanhas locais sem criar pedidos ou pagamentos falsos. O comando recusa rodar com `APP_ENV=production`.
5. No servidor publicado, no lugar do seed, execute `npm run user:admin` para criar o acesso inicial da camisaria. Veja [deploy.md](deploy.md).

O comando usa as credenciais do `.env` e dispensa a instalação do cliente MySQL. Como alternativa, com o cliente instalado:

```powershell
mysql -h 127.0.0.1 -u camisaria -p camisaria_mendes < database/migrations/001_initial_schema.sql
```

## Executar a API

```powershell
npm install
npm run api:dev
```

Verificação:

```powershell
Invoke-RestMethod http://127.0.0.1:3333/api/health
```

## Rotas iniciais

| Método | Rota | Finalidade |
| --- | --- | --- |
| `GET` | `/api/health` | Verificar API e banco |
| `GET` | `/api/settings` | Provedor, meios aceitos e estado do checkout |
| `GET` | `/api/sizes` | Catálogo de tamanhos com o grupo de cada um |
| `POST` | `/api/auth/login` | Autenticar a equipe e abrir sessão |
| `POST` | `/api/auth/logout` | Encerrar a sessão atual |
| `GET` | `/api/auth/session` | Conferir a sessão e o usuário |
| `POST` | `/api/auth/password/forgot` | Pedir o link de redefinição de senha |
| `GET` | `/api/auth/password/reset?token=...` | Conferir se o link ainda vale |
| `POST` | `/api/auth/password/reset` | Trocar a senha usando o link |
| `PATCH` | `/api/admin/account` | Trocar nome, e-mail e senha do próprio acesso |
| `GET` | `/api/campaigns/:codigo` | Carregar campanha, modelos e cores |
| `POST` | `/api/orders` | Registrar pedido ainda pendente de pagamento |
| `POST` | `/api/orders/:numero/checkout` | Criar ou reutilizar o link InfinitePay após conferir pedido e WhatsApp |
| `GET` | `/api/orders/:numero?whatsapp=...` | Acompanhar um pedido com os dados da compra |
| `POST` | `/api/payments/infinitepay/webhook` | Persistir notificação idempotente do provedor |
| `POST` | `/api/payments/infinitepay/reconcile` | Agendar `payment_check` a partir do retorno do navegador |
| `POST` | `/api/admin/uploads` | Enviar a arte da campanha e receber a URL |
| `POST` | `/api/admin/video-uploads` | Enviar MP4 administrativo por streaming |
| `GET/HEAD` | `/uploads/:arquivo` | Servir imagem ou MP4; vídeo aceita `Range` |
| `GET/POST` | `/api/admin/campaigns` | Listar ou criar campanhas persistentes |
| `PATCH` | `/api/admin/campaigns/:codigo/phase` | Avançar ou retornar a campanha |
| `GET` | `/api/admin/campaigns/:codigo/orders` | Listar os pedidos de uma campanha |
| `PATCH` | `/api/admin/orders/:numero/delivery` | Registrar a situação da entrega |
| `GET` | `/api/admin/reports/production` | Consolidado de peças pagas |
| `GET` | `/api/admin/reports/delivery` | Checklist de pedidos pagos |

## Acesso da equipe

As rotas administrativas aceitam apenas `Authorization: Bearer <token>`, com a sessão
criada em `POST /api/auth/login`. Ela expira após 12 horas de inatividade e, mesmo em uso,
exige novo login ao completar 7 dias. A sessão pertence a uma conta identificada e o banco
guarda só o SHA-256 do token em `staff_sessions`. Variáveis antigas
`ADMIN_API_TOKEN*` e o cabeçalho `X-Admin-Token` são ignorados.

Somente contas com `role = 'camisaria'` entram no painel. O papel `representative` permanece
reservado no schema, mas o login e todas as rotas administrativas recusam esse acesso.

A senha é guardada com `scrypt` (`N=16384`), salt por usuário e comparação em tempo
constante. O login tolera até 8 tentativas erradas por IP e e-mail em 10 minutos.

Criar ou trocar a senha de um usuário da camisaria:

```powershell
npm run user:create -- "Maria Mendes" maria@camisariamendes.com umaSenhaLonga
```

Trocar a senha encerra as sessões abertas daquele usuário. O `database/seeds/002_staff_user.sql`
cria `admin@teste.com` com a senha de demonstração `123456`; `npm run db:seed` recusa rodar
com `APP_ENV=production` e a API avisa no boot se esse usuário ainda existir.

### Cadastro inicial e recuperação

`npm run user:admin` cria o acesso da camisaria (`gustavo@mendes` / `changeme` por padrão,
ajustáveis por `ADMIN_INITIAL_EMAIL` e `ADMIN_INITIAL_PASSWORD`) com
`users.must_change_password = TRUE`. Enquanto essa marca estiver ligada, as rotas
`/api/admin/*` respondem `403 PASSWORD_CHANGE_REQUIRED` — só `PATCH /api/admin/account`
continua aberta — e o painel abre na seção *Conta* sem liberar as demais. A trava fica no
servidor de propósito: um painel adulterado não deve conseguir contorná-la. O comando é
idempotente: numa conta que já existe, ele não mexe na senha, a menos que receba `--force`.

`POST /api/auth/password/forgot` grava um token em `password_reset_tokens` — só o SHA-256,
como nas sessões —, válido por uma hora e de uso único. Um token novo apaga os anteriores
do mesmo usuário. A resposta é a mesma para e-mail cadastrado ou não, para a tela não
revelar quem tem acesso ao painel; o campo `delivery` diz apenas se este servidor consegue
enviar e-mail. O envio usa SMTP direto (`api/mailer.mjs`, sem dependência nova) e, sem
`SMTP_HOST`, a API responde `unavailable` em vez de fingir que enviou. Nesse caso o link
sai por `npm run user:reset -- email@dominio`.

Tanto a redefinição por link quanto a troca de senha em *Conta* encerram as demais sessões
do usuário — a de quem está trocando continua valendo.

## Confirmação de pagamento

A tela do aluno oferece Pix e cartão de crédito pela InfinitePay. O pedido nasce pendente,
`POST /api/orders/:numero/checkout` cria ou reutiliza o link externo e não existe rota
administrativa para marcá-lo como pago, nem chave Pix fixa ou envio de comprovante.

A integração cria o link com o número interno em `order_nsu`, redireciona o aluno para o
checkout hospedado e processa o webhook de forma idempotente. Antes de alterar
`orders.payment_status`, o servidor deve conferir pedido, valor e transação com
`POST https://api.checkout.infinitepay.io/payment_check`. O `redirect_url` serve apenas para
experiência do aluno e nunca comprova pagamento.

Somente pedidos pagos entram nos relatórios e no fluxo de entrega. A trava
`INFINITEPAY_CHECKOUT_ENABLED=false` permanece até a homologação real na conta da camisaria.

A migração `007_payment_confirmation_email` cria uma fila transacional e um trigger para a
transição de `payment_status` para `paid`. Havendo `customer_email`, o worker da API envia
uma única mensagem com o número do pedido, campanha, valor e link de acompanhamento. O
link preenche apenas o código; o aluno ainda informa o WhatsApp na página. Se o SMTP
falhar, a notificação fica registrada para nova tentativa sem desfazer a confirmação do
pagamento.

## Enviar a arte da campanha

A arte é gravada como arquivo e a campanha guarda apenas a URL, porque `art_front_url`
aceita no máximo 2048 caracteres — um `data:` URI de imagem não cabe. O upload é feito
com o corpo binário puro e o `Content-Type` da imagem:

```powershell
$bytes = [IO.File]::ReadAllBytes("arte-frente.png")
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3333/api/admin/uploads `
  -Headers @{ Authorization = "Bearer $env:CAMISARIA_SESSION_TOKEN" } `
  -ContentType "image/png" -Body $bytes
```

`CAMISARIA_SESSION_TOKEN` deve conter uma sessão temporária obtida pelo login de uma conta
da camisaria; encerre a sessão depois da manutenção.

A resposta traz `{ "url": "/uploads/<uuid>.png" }`. Aceita `PNG`, `JPG` e `WEBP` com até
`2 MB`, confere a assinatura do arquivo antes de gravar e serve de volta com
`X-Content-Type-Options: nosniff`. Em desenvolvimento o padrão é `uploads/`; em produção,
`UPLOADS_DIR` precisa apontar para armazenamento persistente fora da árvore do projeto.

Vídeos usam `POST /api/admin/video-uploads`, corpo binário `video/mp4`, limite de `10 MB`
e arquivo temporário `.tmp/<uuid>.part`. O servidor confere `Content-Length` quando existe,
grava cada bloco diretamente no disco, valida a assinatura `ftyp` e só então renomeia para
`<uuid>.mp4`. A duração máxima de `15 segundos` e a reprodução são validadas no navegador;
o player público usa `HEAD`, `Range`, `206 Partial Content` e `416` para faixas inválidas.

## Exemplos de corpo

Criar campanha — a arte vem do upload e cada corte declara cores e tamanhos:

```json
{
  "code": "MENDES-ADS-26",
  "title": "Análise e Desenvolvimento de Sistemas — 2026.2",
  "deadlineAt": "2026-09-12T23:59:59.000Z",
  "pickupInstructions": "Retirada com o representante da turma",
  "representative": { "name": "Carla Sousa", "whatsapp": "5598988881234" },
  "artFrontUrl": "/uploads/6f1c….png",
  "artBackUrl": null,
  "models": [
    { "modelCode": "common", "unitPriceCents": 5990, "colors": ["Preto", "Branco"], "sizes": ["P", "M", "G", "PB", "MB", "GB"] },
    { "modelCode": "oversized", "unitPriceCents": 6990, "colors": ["Preto"], "sizes": ["M", "G", "GG"] }
  ]
}
```

Criação idempotente de pedido — `size` é o código do tamanho, e a API recusa com
`INVALID_SIZE` se aquele tamanho não estiver liberado para o corte da variante:

```json
{
  "campaignCode": "MENDES-ADS-26",
  "customer": {
    "name": "Ana Souza",
    "whatsapp": "5598999990000",
    "email": "ana@example.com"
  },
  "items": [
    { "variantId": 1, "size": "MB", "quantity": 1 }
  ]
}
```

Envie também o cabeçalho `Idempotency-Key` com um UUID gerado no navegador.

## Migrações

`npm run db:migrate` registra cada arquivo aplicado em `schema_migrations` e pula o que já
rodou. Isso é obrigatório a partir da `002`, que usa `ALTER TABLE` e não pode ser
reexecutada. Nunca edite uma migração já aplicada: crie a próxima.

## Testes operacionais isolados

Os testes nunca usam o banco configurado em `DB_NAME`. Por padrão criam e recriam
`camisaria_mendes_test`; para escolher outro nome, use `TEST_DB_NAME`, obrigatoriamente
terminado em `_test`.

```powershell
npm.cmd run db:test:reset
npm.cmd run test:smoke
```

`test:smoke` prepara o schema desde zero, carrega apenas as seeds de desenvolvimento,
sobe a API em `127.0.0.1:3334`, percorre a jornada operacional e encerra o processo ao
final. O teste comprova que a antiga rota manual não existe e usa um servidor InfinitePay
falso para validar criação do link, webhook duplicado, `payment_check`, valor divergente,
produção e entrega; ele não cria cobrança real na InfinitePay.
