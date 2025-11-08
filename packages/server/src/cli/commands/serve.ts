/**
 * serve command - starts MCP server + UI (spec §12)
 */

import { existsSync } from "node:fs";
import { readFile, mkdir, access, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import kleur from "kleur";
import open from "open";
import { startServer } from "../../index.js";
import { generateSigningKeys } from "../../services/crypto.js";
import type { RelayConfig } from "@1mcp/shared";

interface ServeOptions {
  config: string;
  port: string;
  bind: string;
  open: boolean;
  ui: boolean;
}

export async function serveCommand(options: ServeOptions) {
  const configPath = resolve(process.cwd(), options.config);

  // Load config
  if (!existsSync(configPath)) {
    console.log(kleur.red("❌ 1mcp.config.json not found"));
    console.log("Run: npx 1mcp init");
    process.exit(1);
  }

  const configText = await readFile(configPath, "utf-8");
  const config: RelayConfig = JSON.parse(configText);

  // First-run initialization (spec §12)
  const keyPath = resolve(
    process.cwd(),
    config.signingKeyPath || ".1mcp/keys/"
  );
  const cacheDir = resolve(
    process.cwd(),
    config.cacheDir || ".1mcp/capsules/"
  );

  // Ensure directories exist
  await mkdir(keyPath, { recursive: true });
  await mkdir(cacheDir, { recursive: true });

  // Generate signing keys if not exists
  const privateKeyPath = resolve(keyPath, "signing.key");
  const publicKeyPath = resolve(keyPath, "signing.pub");

  try {
    await access(privateKeyPath);
  } catch {
    console.log(kleur.cyan("🔑 Generating Ed25519 signing keys..."));
    const { privateKey, publicKey, fingerprint } =
      await generateSigningKeys();
    await writeFile(privateKeyPath, privateKey, "utf-8");
    await writeFile(publicKeyPath, publicKey, "utf-8");
    console.log(kleur.gray(`   Fingerprint: ${fingerprint}`));
  }

  // Detect Docker environment (spec §12)
  let bindAddress = options.bind;
  if (
    bindAddress === "127.0.0.1" &&
    (existsSync("/.dockerenv") || process.env.DOCKER_CONTAINER === "true")
  ) {
    console.log(kleur.cyan("🐳 Docker detected, binding to 0.0.0.0"));
    bindAddress = "0.0.0.0";
  }

  const port = parseInt(options.port, 10);
  const baseUrl = `http://${bindAddress === "0.0.0.0" ? "127.0.0.1" : bindAddress}:${port}`;

  // Start server
  console.log(kleur.cyan(`🚀 Starting 1mcp server...`));
  await startServer({
    config,
    port,
    bindAddress,
    headless: !options.ui,
    keyPath: privateKeyPath,
    cacheDir,
  });

  console.log(kleur.green(`✅ Server started at ${baseUrl}`));
  console.log(kleur.gray(`   MCP endpoint: POST ${baseUrl}/mcp`));

  if (options.ui) {
    // Auto-open browser (spec §12)
    if (options.open) {
      console.log(kleur.cyan("🌐 Opening browser..."));
      await open(baseUrl);
    } else {
      console.log(kleur.gray(`   UI: ${baseUrl}/`));
    }
  } else {
    console.log(kleur.yellow("   Headless mode: no UI, Node harness only"));
  }
}
