import mysql from "mysql2/promise";
import { pathToFileURL } from "node:url";
import { testEnvironment } from "./test-environment.mjs";

export async function resetTestDatabase(environment = testEnvironment()) {
  const databaseName = environment.DB_NAME;
  if (!/^[A-Za-z0-9_]+_test$/.test(databaseName)) {
    throw new Error("Reset recusado: o banco precisa terminar em `_test`.");
  }
  const connection = await mysql.createConnection({
    host: environment.DB_HOST || "127.0.0.1",
    port: Number.parseInt(environment.DB_PORT || "3306", 10),
    user: environment.DB_USER,
    password: environment.DB_PASSWORD || "",
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await connection.query(
      `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
  return databaseName;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const databaseName = await resetTestDatabase();
  console.log(`Banco de teste recriado: ${databaseName}`);
}
