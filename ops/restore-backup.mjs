import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { config } from "../api/config.mjs";

const backupRoot = path.resolve(process.env.BACKUP_DIR || path.resolve("backups"));
const requestedSnapshot = process.argv[2] ? path.resolve(process.argv[2]) : null;
const targetDatabase = (process.env.RESTORE_DB_NAME || "").trim();
const mysqlBinary = (process.env.MYSQL_BIN || "mysql").trim();
const restoreUploadsDirectory = process.env.RESTORE_UPLOADS_DIR ? path.resolve(process.env.RESTORE_UPLOADS_DIR) : null;

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function latestSnapshot() {
  const entries = await fs.readdir(backupRoot, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory() && /^\d{8}T\d{6}Z$/.test(entry.name)).map((entry) => entry.name).sort();
  if (names.length === 0) throw new Error(`Nenhum snapshot completo encontrado em ${backupRoot}.`);
  return path.join(backupRoot, names.at(-1));
}

async function sha256(file) {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(file));
  return hash.digest("hex");
}

async function inventory(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) files.push({ path: path.relative(directory, absolute).replaceAll("\\", "/"), bytes: (await fs.stat(absolute)).size });
    }
  }
  await visit(directory);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

if (!/^[A-Za-z0-9_]+_restore_test$/.test(targetDatabase) || targetDatabase === config.database.database) {
  throw new Error("RESTORE_DB_NAME precisa ser um banco novo, com nome seguro terminado em _restore_test.");
}
const snapshot = requestedSnapshot || await latestSnapshot();
if (!inside(backupRoot, snapshot)) throw new Error("O snapshot precisa estar dentro de BACKUP_DIR.");
const databaseFile = path.join(snapshot, "database.sql");
const triggersFile = path.join(snapshot, "triggers.sql");
const uploadsSnapshot = path.join(snapshot, "uploads");
const manifest = JSON.parse(await fs.readFile(path.join(snapshot, "manifest.json"), "utf8"));
if (manifest.databaseSha256 !== await sha256(databaseFile)) throw new Error("SHA-256 do database.sql não confere com o manifesto.");
if (manifest.triggersSha256 !== await sha256(triggersFile)) throw new Error("SHA-256 do triggers.sql não confere com o manifesto.");
const uploadFiles = await inventory(uploadsSnapshot);
const uploadBytes = uploadFiles.reduce((total, file) => total + file.bytes, 0);
if (manifest.uploadsFiles !== uploadFiles.length || manifest.uploadsBytes !== uploadBytes) {
  throw new Error("Inventário de uploads não confere com o manifesto.");
}

const admin = await mysql.createConnection({
  host: config.database.host,
  port: config.database.port,
  user: process.env.RESTORE_DB_USER || config.database.user,
  password: process.env.RESTORE_DB_PASSWORD ?? config.database.password,
  charset: "utf8mb4",
});
try {
  const [existing] = await admin.query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", [targetDatabase]);
  if (existing.length > 0) throw new Error(`O banco de restauração já existe: ${targetDatabase}. Nenhum dado foi sobrescrito.`);
  await admin.query(`CREATE DATABASE \`${targetDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
} finally {
  await admin.end();
}

async function importSql(file) {
  await new Promise((resolve, reject) => {
    const child = spawn(mysqlBinary, [
      `--host=${config.database.host}`,
      `--port=${config.database.port}`,
      `--user=${process.env.RESTORE_DB_USER || config.database.user}`,
      `--database=${targetDatabase}`,
      "--default-character-set=utf8mb4",
      "--binary-mode=1",
    ], {
      env: { ...process.env, MYSQL_PWD: process.env.RESTORE_DB_PASSWORD ?? config.database.password },
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 16_384); });
    createReadStream(file).pipe(child.stdin);
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`mysql terminou com código ${code} ao importar ${path.basename(file)}: ${stderr.trim()}`)));
  });
}

await importSql(databaseFile);
await importSql(triggersFile);

if (restoreUploadsDirectory) {
  if (await fs.stat(restoreUploadsDirectory).catch(() => null)) throw new Error("RESTORE_UPLOADS_DIR já existe; nenhum arquivo foi sobrescrito.");
  await fs.cp(uploadsSnapshot, restoreUploadsDirectory, { recursive: true, force: false, errorOnExist: true });
}

const source = await mysql.createConnection({ ...config.database, charset: "utf8mb4" });
const restored = await mysql.createConnection({ ...config.database, database: targetDatabase, charset: "utf8mb4" });
const comparisons = {};
try {
  const tables = ["schema_migrations", "campaigns", "orders", "payments", "order_refunds", "users"];
  for (const table of tables) {
    const [sourceExists] = await source.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [config.database.database, table]);
    if (sourceExists.length === 0) continue;
    const [[sourceCount]] = await source.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    const [[restoredCount]] = await restored.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    comparisons[table] = { source: Number(sourceCount.total), restored: Number(restoredCount.total) };
    if (comparisons[table].source !== comparisons[table].restored) throw new Error(`Contagem divergente em ${table}.`);
  }
} finally {
  await source.end();
  await restored.end();
}

console.log(JSON.stringify({ ok: true, snapshot, targetDatabase, uploads: { files: uploadFiles.length, bytes: uploadBytes, restoredTo: restoreUploadsDirectory }, comparisons }, null, 2));
