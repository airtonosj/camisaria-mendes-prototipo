import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import './config.mjs';
import { migrationsOnStart, migrationDatabase } from './migration-config.mjs';

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

// Reinícios com schema pronto não precisam abrir outro processo de migração.
// Se houver pendências, elas terminam antes de a API começar a atender.
migrationDatabase({}); // Reject incomplete migration credentials in either mode.
{
  const autoMigrate = migrationsOnStart();
  const { databaseReadiness } = await import('./runtime/readiness.mjs');
  const { pool } = await import('./database.mjs');
  try {
    try { await databaseReadiness(); }
    catch (error) {
      if (!autoMigrate || error.code !== 'DATABASE_MIGRATION_REQUIRED') throw error;
      await runScript("api/migrate.mjs");
      await databaseReadiness();
    }
  } catch (error) { await pool.end(); throw error; }
}

// Na primeira publicacao, configure estas duas variaveis no hPanel. O script e
// idempotente: reinicios posteriores nao alteram a conta nem a senha existente.
if (process.env.ADMIN_INITIAL_EMAIL?.trim() && process.env.ADMIN_INITIAL_PASSWORD) {
  await runScript("api/create-admin.mjs");
} else {
  console.warn("Atencao: ADMIN_INITIAL_EMAIL/ADMIN_INITIAL_PASSWORD ausentes; nenhuma conta inicial foi provisionada.");
}

await import("./server.mjs");
