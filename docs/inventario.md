# Inventário da aplicação

Referência inicial: 95a0057. Extração preserva os contratos; este índice aponta para suas implementações atuais.

## Rotas e métodos

As condições abaixo são extraídas de api/http/router.mjs. Caminhos variáveis usam os matchers registrados no mesmo arquivo.

```js
  if (request.method === "OPTIONS") {
  if ((request.method === "GET" || request.method === "HEAD") && path === "/controle-licenca") {
  if (request.method === "GET" && path === "/api/license/control") {
  if (request.method === "POST" && path === "/api/license/control") {
  if (request.method === "GET" && path === "/api/health") {
  const uploadMatch = path.match(/^\/uploads\/([^/]+)$/);
  if ((request.method === "GET" || request.method === "HEAD") && uploadMatch) {
  if (request.method === "GET" && path === "/api/settings") {
  if (request.method === "POST" && path === "/api/auth/login") {
  if (request.method === "POST" && path === "/api/auth/password/forgot") {
  if (request.method === "GET" && path === "/api/auth/password/reset") {
  if (request.method === "POST" && path === "/api/auth/password/reset") {
  if (request.method === "PATCH" && path === "/api/admin/account") {
  if (request.method === "POST" && path === "/api/auth/logout") {
  if (request.method === "GET" && path === "/api/auth/session") {
  if (request.method === "GET" && path === "/api/sizes") {
  if (request.method === "POST" && path === "/api/admin/uploads") {
  if (request.method === "POST" && path === "/api/admin/video-uploads") {
  const publicCouponMatch = path.match(/^\/api\/campaigns\/([^/]+)\/coupon$/);
  if (request.method === "GET" && publicCouponMatch) {
  const publicCampaignMatch = path.match(/^\/api\/campaigns\/([^/]+)$/);
  if (request.method === "GET" && publicCampaignMatch) {
  if (request.method === "POST" && path === "/api/orders") {
  const checkoutMatch = path.match(/^\/api\/orders\/([^/]+)\/checkout$/);
  if (request.method === "POST" && checkoutMatch) {
  if (request.method === "POST" && path === "/api/payments/infinitepay/webhook") {
  if (request.method === "POST" && path === "/api/payments/infinitepay/reconcile") {
  const trackingMatch = path.match(/^\/api\/orders\/([^/]+)$/);
  if (request.method === "GET" && trackingMatch) {
  if (request.method === "GET" && path === "/api/admin/campaigns") {
  if (request.method === "POST" && path === "/api/admin/campaigns") {
  const campaignMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)$/);
  if (request.method === "GET" && campaignMatch) {
  if (request.method === "PATCH" && campaignMatch) {
  if (request.method === "DELETE" && campaignMatch) {
  const phaseMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/phase$/);
  if (request.method === "PATCH" && phaseMatch) {
  const pickupMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/pickup-email(?:\/(preview|confirm|history))?$/);
  if (pickupMatch && ['GET', 'POST'].includes(request.method)) {
    const code = pickupMatch[1].toUpperCase();
      if (request.method === 'GET' && !pickupMatch[2]) result = await pickupInfo(code);
      else if (request.method === 'GET' && pickupMatch[2] === 'history') result = await emailHistory(code, requestUrl.searchParams);
      else if (request.method === 'POST' && pickupMatch[2] === 'preview') result = await previewPickup(code, await readJson(request), staff.id);
      else if (request.method === 'POST' && pickupMatch[2] === 'confirm') {
  const campaignOrdersMatch = path.match(/^\/api\/admin\/campaigns\/([^/]+)\/orders$/);
  if (request.method === "GET" && campaignOrdersMatch) {
  const cancelMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/cancel$/);
  if (request.method === "PATCH" && cancelMatch) {
  const refundMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/refund$/);
  if (request.method === "POST" && refundMatch) {
  const deliveryMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/delivery$/);
  if (request.method === "PATCH" && deliveryMatch) {
  if (request.method === "GET" && path === "/api/admin/reports/production") {
  if (request.method === "GET" && path === "/api/admin/reports/delivery") {
  if ((request.method === "GET" || request.method === "HEAD") && !path.startsWith("/api/")) {
```

## Contratos

Respostas tipadas: shared/contracts.d.ts. Validação crítica: shared/response-contracts.mjs. Erros HTTP: api/http/response.mjs; códigos abaixo permanecem sujeitos às validações específicas de cada módulo. Contratos de saúde e licença estão no roteador. Arquivos preservam GET/HEAD/Range em api/modules/media/service.mjs.

- `BODY_TOO_LARGE`
- `CAMPAIGN_CODE_EXISTS`
- `CAMPAIGN_HAS_ORDERS`
- `CAMPAIGN_NOT_FOUND`
- `CAMPAIGN_NOT_READY`
- `CAMPAIGN_NOT_RECEIVING`
- `CAMPAIGN_VISUAL_REQUIRED`
- `CANCEL_REASON_REQUIRED`
- `COLOR_NAME_CONFLICT`
- `CONFIRMED_PAYMENT_NOT_FOUND`
- `COUPON_DISCOUNT_TOO_HIGH`
- `COUPON_EXHAUSTED`
- `COUPON_EXPIRED`
- `COUPON_MINIMUM_QUANTITY`
- `COUPON_MODEL_MISMATCH`
- `COUPON_NOT_FOUND`
- `COUPON_UNAVAILABLE`
- `DATABASE_MIGRATION_REQUIRED`
- `DATABASE_SCHEMA_UNDEFINED`
- `EMAIL_IN_USE`
- `EMAIL_NOT_SENT`
- `EMPTY_FILE`
- `FILE_NOT_FOUND`
- `FILE_TOO_LARGE`
- `FRONTEND_UNAVAILABLE`
- `FULL_REFUND_REQUIRED`
- `INVALID_CAMPAIGN_CODE`
- `INVALID_COLOR`
- `INVALID_COUPON_CODE`
- `INVALID_CREDENTIALS`
- `INVALID_DELIVERY_STATUS`
- `INVALID_EMAIL`
- `INVALID_IMAGE`
- `INVALID_JSON`
- `INVALID_MODEL`
- `INVALID_PHASE`
- `INVALID_REFUND_DATE`
- `INVALID_REFUND_RECEIPT`
- `INVALID_SIZE`
- `INVALID_UPLOAD`
- `INVALID_VARIANT`
- `INVALID_VIDEO`
- `INVALID_VIDEO_DURATION`
- `INVALID_VIDEO_SIZE`
- `LICENSE_SUSPENDED`
- `METHOD_NOT_ALLOWED`
- `MOCKUP_REQUIRED`
- `MULTIPLE_COUPONS_NOT_ALLOWED`
- `NON_ADJACENT_PHASE`
- `ORDER_ALREADY_REFUNDED`
- `ORDER_NOT_FOUND`
- `ORDER_NOT_PAID`
- `ORDER_PAID_NOT_REFUNDED`
- `PASSWORD_CHANGE_REQUIRED`
- `REAL_PHOTO_REQUIRED`
- `REFUND_REASON_REQUIRED`
- `REFUND_REFERENCE_ALREADY_USED`
- `RESET_TOKEN_INVALID`
- `RETURN_REASON_REQUIRED`
- `ROUTE_NOT_FOUND`
- `SIZE_IN_USE`
- `STAFF_ROLE_NOT_ALLOWED`
- `STORAGE_UNAVAILABLE`
- `TOO_MANY_ATTEMPTS`
- `UNAUTHORIZED`
- `UNSUPPORTED_MEDIA_TYPE`
- `UPLOAD_INTERRUPTED`
- `VALIDATION_ERROR`
- `VARIANT_ARTWORK_REQUIRED`
- `VARIANT_IN_USE`
- `VIDEO_TOO_LARGE`
- `WEAK_PASSWORD`

## Tabelas versionadas

- `campaign_color_photos`
- `campaign_color_videos`
- `campaign_coupon_discounts`
- `campaign_coupons`
- `campaign_model_sizes`
- `campaign_phase_history`
- `campaign_variant_artworks`
- `campaign_variants`
- `campaigns`
- `colors`
- `coupon_redemptions`
- `delivery_history`
- `license_state`
- `license_state_history`
- `order_email_notifications`
- `order_items`
- `order_refunds`
- `orders`
- `password_reset_tokens`
- `payment_checkouts`
- `payment_events`
- `payments`
- `pickup_email_batches`
- `schema_migrations`
- `shirt_models`
- `sizes`
- `staff_sessions`
- `users`

## Tarefas periódicas

- Reconciliação InfinitePay: api/infinitepay-payments.mjs; intervalo configurável.
- Confirmações e avisos de retirada: api/order-email-notifications.mjs; fila persistida, elegibilidade revalidada.
- api/runtime/worker.mjs impede sobreposição e aguarda trabalho em curso no encerramento.
- Backups VPS: ops/systemd/camisaria-backup.timer, alternativa à operação Hostinger.

## Comandos

| Comando npm | Execução |
|---|---|
| `dev` | `vite` |
| `api:dev` | `node --watch api/server.mjs` |
| `api:start` | `node api/server.mjs` |
| `start` | `node api/start.mjs` |
| `db:create` | `node api/create-database.mjs` |
| `db:migrate` | `node api/migrate.mjs` |
| `db:seed` | `node api/seed.mjs` |
| `user:admin` | `node api/create-admin.mjs` |
| `user:create` | `node api/create-user.mjs` |
| `user:reset` | `node api/reset-password.mjs` |
| `db:test:reset` | `node tests/reset-test-database.mjs` |
| `test:smoke` | `node tests/smoke.mjs` |
| `test:pickup` | `node tests/pickup-email.mjs` |
| `test:pickup-migration` | `node tests/pickup-email-migration.mjs` |
| `test:contact` | `node tests/contact-validation.mjs` |
| `test` | `npm run typecheck && npm run lint && npm run test:unit && npm run test:integration` |
| `build` | `tsc -b && vite build && node ops/write-build-info.mjs && node ops/verify-build.mjs` |
| `preview` | `vite preview` |
| `typecheck` | `tsc -b --pretty false` |
| `ops:health` | `node ops/healthcheck.mjs` |
| `ops:backup` | `node ops/backup.mjs` |
| `ops:restore:test` | `node ops/restore-backup.mjs` |
| `ops:email:test` | `node ops/test-email.mjs` |
| `ops:storage:create` | `node ops/verify-storage.mjs create` |
| `ops:storage:check` | `node ops/verify-storage.mjs check` |
| `ops:verify-build` | `node ops/verify-build.mjs` |
| `ops:infinitepay:diagnose` | `node ops/infinitepay-diagnose.mjs` |
| `license:keygen` | `node ops/license-keygen.mjs` |
| `license:token` | `node ops/license-token.mjs` |
| `test:license` | `node tests/license-token.mjs` |
| `lint` | `eslint .` |
| `test:unit` | `node --test --test-concurrency=1 tests/unit/*.test.mjs` |
| `test:integration` | `node --test --test-concurrency=1 tests/integration/*.test.mjs` |
| `test:e2e` | `playwright test` |
| `check:release` | `npm test && npm run build && npm run test:e2e` |
| `db:test:setup` | `node ops/setup-test-db.mjs` |
