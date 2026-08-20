import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  createLicenseCommand,
  LicenseTokenError,
  parseLicensePublicKey,
  verifyLicenseCommand,
} from "../api/license-token.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ format: "pem", type: "pkcs8" });
const publicBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const verificationKey = parseLicensePublicKey(publicBase64);
const installationId = "cliente-smoke-001";

const suspendToken = createLicenseCommand({
  privateKey: privatePem,
  installationId,
  action: "suspend",
  reason: "Inadimplência prevista no contrato de teste.",
});
const suspend = verifyLicenseCommand(suspendToken, { publicKey: verificationKey, installationId });
assert.equal(suspend.action, "suspend");
assert.equal(suspend.installationId, installationId);
assert.equal(suspend.reason, "Inadimplência prevista no contrato de teste.");

const activationToken = createLicenseCommand({
  privateKey: privatePem,
  installationId,
  action: "activate",
});
assert.equal(verifyLicenseCommand(activationToken, { publicKey: verificationKey, installationId }).action, "activate");

const parts = suspendToken.split(".");
const payloadChars = parts[1].split("");
const tamperIndex = Math.floor(payloadChars.length / 2);
payloadChars[tamperIndex] = payloadChars[tamperIndex] === "A" ? "B" : "A";
const tampered = `${parts[0]}.${payloadChars.join("")}.${parts[2]}`;
assert.throws(
  () => verifyLicenseCommand(tampered, { publicKey: verificationKey, installationId }),
  (error) => error instanceof LicenseTokenError && error.code === "LICENSE_COMMAND_INVALID",
);

assert.throws(
  () => verifyLicenseCommand(suspendToken, { publicKey: verificationKey, installationId: "outro-cliente-001" }),
  (error) => error instanceof LicenseTokenError && error.code === "LICENSE_INSTALLATION_MISMATCH",
);

const expiredToken = createLicenseCommand({
  privateKey: privatePem,
  installationId,
  action: "suspend",
  reason: "Comando expirado de teste.",
  issuedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  lifetimeMs: 60_000,
});
assert.throws(
  () => verifyLicenseCommand(expiredToken, { publicKey: verificationKey, installationId }),
  (error) => error instanceof LicenseTokenError && error.code === "LICENSE_COMMAND_EXPIRED",
);

assert.throws(
  () => createLicenseCommand({ privateKey: privatePem, installationId, action: "suspend", reason: "" }),
  (error) => error instanceof LicenseTokenError && error.code === "LICENSE_REASON_REQUIRED",
);

console.log("✓ comandos de licença usam assinatura Ed25519, expiração e identidade da instalação");

