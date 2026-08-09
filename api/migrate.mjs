import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { config } from "./config.mjs";

const apiDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(apiDirectory, "..", "database", "migrations");
const files = (await fs.readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));

if (files.length === 0) {
  console.log("Nenhuma migração SQL encontrada.");
  process.exit(0);
}

const connection = await mysql.createConnection({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  charset: "utf8mb4",
  timezone: "Z",
  multipleStatements: true,
});

try {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version VARCHAR(64) PRIMARY KEY,
       applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  const [appliedRows] = await connection.query("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.version));

  let pending = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) {
      console.log(`Migração já aplicada: ${file}`);
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
    await connection.query(sql);
    await connection.execute(
      "INSERT INTO schema_migrations (version) VALUES (?) ON DUPLICATE KEY UPDATE version = VALUES(version)",
      [version],
    );
    console.log(`Migração aplicada: ${file}`);
    pending += 1;
  }
  if (pending === 0) console.log("O banco já está atualizado.");
} finally {
  await connection.end();
}
