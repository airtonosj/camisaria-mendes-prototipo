import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function staysInsideProject(target) {
  const relative = path.relative(projectDirectory, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const outputDirectory = path.resolve(option("--out-dir") || "");
if (!option("--out-dir")) {
  console.error("Uso: npm run license:keygen -- --out-dir <pasta fora do projeto>");
  process.exit(1);
}
if (staysInsideProject(outputDirectory)) {
  console.error("A pasta das chaves precisa ficar fora do projeto e do repositório.");
  process.exit(1);
}

const privatePath = path.join(outputDirectory, "license-private.pem");
const publicPath = path.join(outputDirectory, "license-public-base64.txt");
await fs.mkdir(outputDirectory, { recursive: true, mode: 0o700 });
for (const target of [privatePath, publicPath]) {
  try {
    await fs.access(target);
    console.error(`Arquivo já existe; geração recusada: ${target}`);
    process.exit(1);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ format: "pem", type: "pkcs8" });
const publicBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
await fs.writeFile(privatePath, privatePem, { encoding: "utf8", mode: 0o600, flag: "wx" });
await fs.writeFile(publicPath, `${publicBase64}\n`, { encoding: "utf8", mode: 0o644, flag: "wx" });

console.log(`Chave privada criada em: ${privatePath}`);
console.log(`Chave pública criada em: ${publicPath}`);
console.log("Guarde a chave privada fora da host do cliente e fora de backups compartilhados.");

