import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { config } from "./config.mjs";

/**
 * Carga de demonstração: campanhas fictícias e o usuário `admin@teste.com`. Serve para
 * desenvolver sem depender de dados reais e não pode existir no ambiente publicado —
 * a equipe olhando pedidos inventados achando que são reais é o pior desfecho possível.
 */
if (config.isProduction) {
  console.error("A carga de demonstração não roda em produção (APP_ENV=production).");
  console.error("Em produção, use `npm run db:migrate` e depois `npm run user:admin`.");
  process.exit(1);
}

const apiDirectory = path.dirname(fileURLToPath(import.meta.url));
const seedsDirectory = path.resolve(apiDirectory, "..", "database", "seeds");
const files = (await fs.readdir(seedsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));

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
  for (const file of files) {
    const sql = await fs.readFile(path.join(seedsDirectory, file), "utf8");
    await connection.query(sql);
    console.log(`Carga local aplicada: ${file}`);
  }
} finally {
  await connection.end();
}
