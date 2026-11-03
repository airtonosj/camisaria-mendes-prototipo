import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../api/config.mjs";

const action = (process.argv[2] || "check").toLowerCase();
const probeFile = path.join(config.uploadsDirectory, ".camisaria-persistence-probe.json");

await fs.mkdir(config.uploadsDirectory, { recursive: true });
if (action === "create") {
  const probe = { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await fs.writeFile(probeFile, `${JSON.stringify(probe, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(`Prova de persistência criada em ${probeFile}. Reinicie ou faça um redeploy e execute "npm run ops:storage:check".`);
} else if (action === "check") {
  const probe = JSON.parse(await fs.readFile(probeFile, "utf8"));
  if (!probe.id || !probe.createdAt) throw new Error("A prova de persistência está inválida.");
  const files = await fs.readdir(config.uploadsDirectory);
  console.log(`Storage persistente confirmado. Prova ${probe.id} criada em ${probe.createdAt}; ${files.length} entrada(s) presentes.`);
} else {
  throw new Error("Ação inválida. Use create ou check.");
}
