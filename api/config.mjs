import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(apiDirectory, "..");
const envPath = path.join(projectDirectory, ".env");

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function integerFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function textFromEnv(name) {
  return (process.env[name] ?? "").trim();
}

function booleanFromEnv(name, fallback) {
  const value = textFromEnv(name).toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

/**
 * O ambiente da API é `APP_ENV`, e não `NODE_ENV`, de propósito: o Vite também lê o
 * `.env` deste projeto, e um `NODE_ENV=development` ali faria `npm run build` gerar um
 * pacote de desenvolvimento — com campanhas, pedidos e credenciais de demonstração
 * dentro do site publicado. `NODE_ENV` continua valendo quando vem do próprio processo,
 * que é como o systemd costuma configurar o servidor.
 */
const environment = textFromEnv("APP_ENV") || textFromEnv("NODE_ENV") || "development";
const configuredUploadsDirectory = textFromEnv("UPLOADS_DIR");
const officialInfinitePayApiBaseUrl = "https://api.checkout.infinitepay.io";
const platformPort = integerFromEnv("PORT", 0);
const configuredApiPort = integerFromEnv("API_PORT", environment === "production" ? 3000 : 3333);

export const config = {
  environment,
  isProduction: environment === "production",
  // A hospedagem Node.js gerenciada injeta PORT e precisa aceitar conexoes fora
  // do processo. Em desenvolvimento mantemos o bind local e a porta historica.
  host: textFromEnv("API_HOST") || (environment === "production" ? "0.0.0.0" : "127.0.0.1"),
  port: platformPort || configuredApiPort,
  // Aceita lista separada por vírgula: o navegador manda 127.0.0.1 ou localhost
  // conforme o endereço digitado, e a comparação de origem é exata.
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://127.0.0.1:4173,http://localhost:4173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  adminApiTokenEnabled: booleanFromEnv("ADMIN_API_TOKEN_ENABLED", environment !== "production"),
  adminApiToken: process.env.ADMIN_API_TOKEN ?? "",
  // Só aceite cabeçalhos de endereço quando a aplicação estiver atrás do proxy
  // reverso controlado pelo operador, como acontece no Web App gerenciado da Hostinger.
  trustProxy: booleanFromEnv("TRUST_PROXY", false),
  initialAdminPasswordConfigured: Boolean(process.env.ADMIN_INITIAL_PASSWORD),
  // Endereço público do site. Entra nos links de redefinição de senha, que precisam
  // apontar para o navegador do usuário e não para o host interno da API.
  publicAppUrl: (textFromEnv("PUBLIC_APP_URL") || "http://127.0.0.1:4173").replace(/\/+$/, ""),
  /**
   * Pagamento. O checkout integrado da InfinitePay identifica a conta pela InfiniteTag
   * (`handle`). `checkoutEnabled` permanece falso até as rotas de criação do link e de
   * confirmação automática estarem implementadas e verificadas.
   */
  payments: {
    provider: textFromEnv("PAYMENT_PROVIDER") || "infinitepay",
    infinitePay: {
      handle: textFromEnv("INFINITEPAY_HANDLE"),
      checkoutEnabled: booleanFromEnv("INFINITEPAY_CHECKOUT_ENABLED", false),
      apiBaseUrl: (textFromEnv("INFINITEPAY_API_BASE_URL") || officialInfinitePayApiBaseUrl).replace(/\/+$/, ""),
      requestTimeoutMs: Math.max(1000, integerFromEnv("INFINITEPAY_REQUEST_TIMEOUT_MS", 8000)),
      reconciliationIntervalMs: Math.max(1000, integerFromEnv("PAYMENT_RECONCILIATION_INTERVAL_MS", 5000)),
    },
  },
  /**
   * SMTP da recuperação de senha. Opcional: sem host configurado, a API responde que
   * a recuperação por e-mail não está disponível em vez de fingir que enviou.
   */
  smtp: {
    host: textFromEnv("SMTP_HOST"),
    port: integerFromEnv("SMTP_PORT", 465),
    user: textFromEnv("SMTP_USER"),
    password: textFromEnv("SMTP_PASSWORD"),
    from: textFromEnv("SMTP_FROM") || textFromEnv("SMTP_USER"),
    fromName: textFromEnv("SMTP_FROM_NAME") || "Camisaria Mendes",
    deliveryIntervalMs: Math.max(5000, integerFromEnv("EMAIL_DELIVERY_INTERVAL_MS", 30000)),
  },
  uploadsDirectory: path.resolve(configuredUploadsDirectory || path.join(projectDirectory, "uploads")),
  uploadsDirectoryConfigured: Boolean(configuredUploadsDirectory),
  database: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: integerFromEnv("DB_PORT", 3306),
    user: process.env.DB_USER ?? "camisaria",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "camisaria_mendes",
    connectionLimit: integerFromEnv("DB_CONNECTION_LIMIT", 10),
  },
};

function isInsideProject(target) {
  const relative = path.relative(projectDirectory, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** Configurações que seriam inseguras ou incompletas demais para aceitar pedidos reais. */
export function productionConfigurationErrors() {
  if (!config.isProduction) return [];
  const errors = [];
  let publicOrigin = "";
  try {
    const url = new URL(config.publicAppUrl);
    publicOrigin = url.origin;
    if (url.protocol !== "https:") errors.push("PUBLIC_APP_URL precisa usar HTTPS.");
  } catch {
    errors.push("PUBLIC_APP_URL precisa ser uma URL pública válida.");
  }
  if (publicOrigin && !config.corsOrigins.includes(publicOrigin)) {
    errors.push("CORS_ORIGIN precisa incluir a origem de PUBLIC_APP_URL.");
  }
  if (config.corsOrigins.some((origin) => !origin.startsWith("https://"))) {
    errors.push("Todas as origens de CORS_ORIGIN precisam usar HTTPS em produção.");
  }
  if (config.adminApiTokenEnabled && config.adminApiToken.length < 32) {
    errors.push("ADMIN_API_TOKEN_ENABLED exige ADMIN_API_TOKEN com pelo menos 32 caracteres.");
  }
  if (!config.trustProxy) {
    errors.push("TRUST_PROXY precisa ser true em produção para os limites por cliente funcionarem atrás do proxy reverso.");
  }
  if (config.initialAdminPasswordConfigured) {
    errors.push("ADMIN_INITIAL_PASSWORD deve ser removida depois que a conta inicial trocar a senha.");
  }
  if (!config.smtp.host || !config.smtp.user || !config.smtp.password || !config.smtp.from) {
    errors.push("SMTP_HOST, SMTP_USER, SMTP_PASSWORD e SMTP_FROM são obrigatórios em produção.");
  }
  if (["root", "admin", "administrator"].includes(config.database.user.toLowerCase())) {
    errors.push("DB_USER precisa ser um usuário restrito da aplicação, nunca root/administrador.");
  }
  if (!config.uploadsDirectoryConfigured || isInsideProject(config.uploadsDirectory)) {
    errors.push("UPLOADS_DIR precisa apontar para um caminho persistente fora da pasta do projeto.");
  }
  if (config.payments.provider !== "infinitepay") {
    errors.push("PAYMENT_PROVIDER precisa ser infinitepay.");
  }
  // Produção e vendas públicas são estados diferentes. A API precisa poder operar em
  // produção, com HTTPS/SMTP/storage reais, enquanto o checkout continua fechado para
  // a homologação. A conta só se torna obrigatória quando a trava pública é aberta.
  if (config.payments.infinitePay.checkoutEnabled && !config.payments.infinitePay.handle) {
    errors.push("INFINITEPAY_HANDLE é obrigatória quando INFINITEPAY_CHECKOUT_ENABLED=true.");
  }
  if (config.payments.infinitePay.apiBaseUrl !== officialInfinitePayApiBaseUrl) {
    errors.push("INFINITEPAY_API_BASE_URL must use the official endpoint in production.");
  }
  return errors;
}
