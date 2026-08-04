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
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
    await connection.query(sql);
    console.log(`Migração aplicada: ${file}`);
  }
} finally {
  await connection.end();
}
