import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import { pool } from "../database.mjs";
import { uploadsDirectory, migrationsDirectory } from "./constants.mjs";
import { ApiError } from "../http/response.mjs";

/**
 * O processo estar conectado ao MySQL não significa que o schema está pronto. A lista
 * esperada vem dos próprios arquivos versionados de migração, evitando atualizar uma
 * constante manual sempre que uma migração nova for adicionada.
 */
export async function databaseReadiness() {
  await pool.query("SELECT 1");
  const expected = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .map((file) => file.replace(/\.sql$/, ""))
    .sort((left, right) => left.localeCompare(right));
  if (expected.length === 0) {
    throw new ApiError(503, "DATABASE_SCHEMA_UNDEFINED", "Nenhuma migração de banco foi encontrada no servidor.");
  }

  let appliedRows;
  try {
    [appliedRows] = await pool.query("SELECT version FROM schema_migrations");
  } catch {
    throw new ApiError(503, "DATABASE_MIGRATION_REQUIRED", "O banco ainda não foi preparado com as migrações da aplicação.");
  }
  const applied = new Set(appliedRows.map((row) => row.version));
  const missing = expected.filter((version) => !applied.has(version));
  if (missing.length > 0) {
    throw new ApiError(
      503,
      "DATABASE_MIGRATION_REQUIRED",
      "O banco possui migrações pendentes.",
      { missing },
    );
  }
  return { database: "connected", schema: { ready: true, current: expected.at(-1) } };
}

export async function storageReadiness() {
  try {
    await fs.mkdir(uploadsDirectory, { recursive: true });
    await fs.access(uploadsDirectory, fsConstants.R_OK | fsConstants.W_OK);
    return { storage: { ready: true } };
  } catch {
    throw new ApiError(503, "STORAGE_UNAVAILABLE", "O armazenamento de artes não está disponível para leitura e gravação.");
  }
}
