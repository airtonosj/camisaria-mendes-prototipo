import fs from "node:fs/promises";
import { createLicenseCommand } from "../api/license-token.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function durationMs(value) {
  const match = String(value || "15m").trim().match(/^(\d+)(m|h)$/i);
  if (!match) throw new Error("Use --expires com minutos ou horas, por exemplo 15m ou 2h.");
  const amount = Number.parseInt(match[1], 10);
  return amount * (match[2].toLowerCase() === "h" ? 60 * 60 * 1000 : 60 * 1000);
}

const action = String(process.argv[2] ?? "").trim().toLowerCase();
const installationId = option("--installation");
const privateKeyPath = option("--private-key");
const reason = option("--reason");
if (!new Set(["suspend", "activate"]).has(action) || !installationId || !privateKeyPath) {
  console.error("Uso: npm run license:token -- <suspend|activate> --installation <id> --private-key <arquivo.pem> [--expires 15m] [--reason texto]");
  process.exit(1);
}

try {
  const privateKey = await fs.readFile(privateKeyPath, "utf8");
  const token = createLicenseCommand({
    privateKey,
    installationId,
    action,
    reason: reason || (action === "suspend" ? "Suspensão contratual da licença." : "Licença reativada pelo fornecedor."),
    lifetimeMs: durationMs(option("--expires")),
  });
  process.stdout.write(`${token}\n`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

