import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "../api/config.mjs";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupRoot = path.resolve(process.env.BACKUP_DIR || path.join(projectDirectory, "backups"));
const retentionDays = Math.max(1, Number.parseInt(process.env.BACKUP_RETENTION_DAYS || "14", 10));
const dumpBinary = (process.env.MYSQLDUMP_BIN || "mysqldump").trim();

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

if (config.isProduction && isInside(projectDirectory, backupRoot)) {
  throw new Error("BACKUP_DIR precisa ficar fora da pasta do projeto em produção.");
}

function snapshotId(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function sha256(file) {
  const hash = crypto.createHash("sha256");
  const content = await fs.readFile(file);
  hash.update(content);
  return hash.digest("hex");
}

async function fileInventory(directory) {
  const entries = [];
  async function visit(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) {
        const stat = await fs.stat(absolute);
        entries.push({ path: path.relative(directory, absolute).replaceAll("\\", "/"), bytes: stat.size });
      }
    }
  }
  await visit(directory);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function runDump(outputFile) {
  const user = (process.env.BACKUP_DB_USER || config.database.user).trim();
  const password = process.env.BACKUP_DB_PASSWORD ?? config.database.password;
  const args = [
    `--host=${config.database.host}`,
    `--port=${config.database.port}`,
    `--user=${user}`,
    "--single-transaction",
    "--quick",
    "--routines",
    "--triggers",
    "--events",
    "--no-tablespaces",
    "--set-gtid-purged=OFF",
    `--result-file=${outputFile}`,
    config.database.database,
  ];
  await new Promise((resolve, reject) => {
    const child = spawn(dumpBinary, args, {
      env: { ...process.env, MYSQL_PWD: password },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 16_384); });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`mysqldump terminou com código ${code}: ${stderr.trim()}`)));
  });
}

async function pruneOldSnapshots(now) {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of await fs.readdir(backupRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{8}T\d{6}Z$/.test(entry.name)) continue;
    const candidate = path.resolve(backupRoot, entry.name);
    if (!isInside(backupRoot, candidate) || candidate === backupRoot) continue;
    const stat = await fs.stat(candidate);
    if (stat.mtimeMs < cutoff) await fs.rm(candidate, { recursive: true, force: false });
  }
}

const now = new Date();
const id = snapshotId(now);
const finalDirectory = path.join(backupRoot, id);
const partialDirectory = path.join(backupRoot, `.partial-${id}-${process.pid}`);

await fs.mkdir(backupRoot, { recursive: true });
if (await fs.stat(finalDirectory).catch(() => null)) throw new Error(`Backup já existe: ${finalDirectory}`);
await fs.mkdir(partialDirectory, { recursive: false });

try {
  const databaseFile = path.join(partialDirectory, "database.sql");
  const uploadBackup = path.join(partialDirectory, "uploads");
  await runDump(databaseFile);
  if (await fs.stat(config.uploadsDirectory).catch(() => null)) {
    await fs.cp(config.uploadsDirectory, uploadBackup, { recursive: true, force: false, errorOnExist: true });
  } else {
    await fs.mkdir(uploadBackup, { recursive: true });
  }
  const uploads = await fileInventory(uploadBackup);
  const databaseStat = await fs.stat(databaseFile);
  const manifest = {
    createdAt: now.toISOString(),
    database: config.database.database,
    databaseBytes: databaseStat.size,
    databaseSha256: await sha256(databaseFile),
    uploadsDirectory: config.uploadsDirectory,
    uploadsFiles: uploads.length,
    uploadsBytes: uploads.reduce((total, file) => total + file.bytes, 0),
    uploads,
  };
  await fs.writeFile(path.join(partialDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.rename(partialDirectory, finalDirectory);
  await pruneOldSnapshots(now);
  console.log(`Backup concluído: ${finalDirectory}`);
} catch (error) {
  await fs.rm(partialDirectory, { recursive: true, force: true });
  throw error;
}
