/**
 * Cryptography utilities (Ed25519 signing for capsules)
 */

import { generateKeyPair, exportSPKI, exportPKCS8 } from "jose";
import { createHash } from "node:crypto";

export async function generateSigningKeys() {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
  });

  const publicKeyPem = await exportSPKI(publicKey);
  const privateKeyPem = await exportPKCS8(privateKey);

  // Generate fingerprint (SHA-256 of public key)
  const fingerprint = createHash("sha256")
    .update(publicKeyPem)
    .digest("hex")
    .slice(0, 16);

  return {
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
    fingerprint,
  };
}
