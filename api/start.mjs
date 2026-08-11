import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(apiDirectory, "..");

async function runScript(relativePath) {
  const child = spawn(process.execPath, [relativePath], {
    cwd: projectDirectory,
    env: process.env,
    stdio: "inherit",
  });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`${relativePath} falhou${signal ? ` com sinal ${signal}` : ` com codigo ${code}`}.`);
  }
}

// A hospedagem gerenciada inicia apenas o processo principal. As migracoes sao
// idempotentes e precisam terminar antes de a API validar a versao do schema.
await runScript("api/migrate.mjs");

// Na primeira publicacao, configure estas duas variaveis no hPanel. O script e
// idempotente: reinicios posteriores nao alteram a conta nem a senha existente.
if (process.env.ADMIN_INITIAL_EMAIL?.trim() && process.env.ADMIN_INITIAL_PASSWORD) {
  await runScript("api/create-admin.mjs");
} else {
  console.warn("Atencao: ADMIN_INITIAL_EMAIL/ADMIN_INITIAL_PASSWORD ausentes; nenhuma conta inicial foi provisionada.");
}

await import("./server.mjs");
