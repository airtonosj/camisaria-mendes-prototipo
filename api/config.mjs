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

export const config = {
  host: process.env.API_HOST ?? "127.0.0.1",
  port: integerFromEnv("API_PORT", 3333),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173",
  adminApiToken: process.env.ADMIN_API_TOKEN ?? "",
  database: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: integerFromEnv("DB_PORT", 3306),
    user: process.env.DB_USER ?? "camisaria",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "camisaria_mendes",
    connectionLimit: integerFromEnv("DB_CONNECTION_LIMIT", 10),
  },
};
