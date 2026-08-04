import mysql from "mysql2/promise";
import { config } from "./config.mjs";

const databaseName = config.database.database;
if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error("DB_NAME deve conter somente letras, números e sublinhado.");
}

const connection = await mysql.createConnection({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  charset: "utf8mb4",
  timezone: "Z",
});

try {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  console.log(`Banco disponível: ${databaseName}`);
} finally {
  await connection.end();
}
