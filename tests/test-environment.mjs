import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile() {
  const envPath = path.join(projectDirectory, ".env");
  if (!fs.existsSync(envPath)) return {};
  const values = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    values[key] = value;
  }
  return values;
}

export function testEnvironment() {
  const fromFile = readEnvFile();
  const base = { ...fromFile, ...process.env };
  const primaryDatabase = base.DB_NAME || "camisaria_mendes";
  const testDatabase = base.TEST_DB_NAME || `${primaryDatabase}_test`;
  if (!/^[A-Za-z0-9_]+_test$/.test(testDatabase)) {
    throw new Error("TEST_DB_NAME precisa terminar em `_test` e conter apenas letras, números e sublinhado.");
  }
  if (testDatabase === primaryDatabase) {
    throw new Error("O banco de teste não pode ser o banco principal.");
  }
  return {
    ...base,
    APP_ENV: "test",
    API_HOST: "127.0.0.1",
    API_PORT: base.TEST_API_PORT || "3334",
    DB_NAME: testDatabase,
    CORS_ORIGIN: `http://127.0.0.1:${base.TEST_WEB_PORT || "4175"}`,
    PUBLIC_APP_URL: `http://127.0.0.1:${base.TEST_WEB_PORT || "4175"}`,
    ADMIN_API_TOKEN_ENABLED: "false",
    UPLOADS_DIR: path.join(os.tmpdir(), "camisaria-mendes-tests", testDatabase, "uploads"),
    SMTP_HOST: "",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    SMTP_FROM: "",
  };
}
