import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const indexFile = path.join(root, "index.html");
const assetsDirectory = path.join(root, "assets");

await fs.access(indexFile);
const assets = await fs.readdir(assetsDirectory);
const javascript = assets.filter((name) => name.endsWith(".js"));
if (javascript.length === 0) throw new Error("Build inválido: nenhum bundle JavaScript em dist/assets.");

const bundle = (await Promise.all(javascript.map((name) => fs.readFile(path.join(assetsDirectory, name), "utf8")))).join("\n");
const forbidden = [
  ["admin@teste.com", "credencial de demonstração"],
  ["http://127.0.0.1:3333/api", "URL local da API"],
  ["http://localhost:3333/api", "URL local da API"],
];

const leaks = forbidden.filter(([value]) => bundle.includes(value));
if (leaks.length > 0) {
  throw new Error(`Build de produção contém ${leaks.map(([, label]) => label).join(", ")}.`);
}

console.log(`Build de produção verificado: ${javascript.length} bundle(s), sem credencial demo nem API local.`);
