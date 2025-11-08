/**
 * Capsule builder - creates signed execution artifacts (spec §6)
 */

import { build as esbuild } from "esbuild";
import { zip } from "fflate";
import { SignJWT, importPKCS8, type KeyLike } from "jose";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { promisify } from "node:util";
import type {
  Capsule,
  Policy,
  RunJsParams,
  RunPyParams,
} from "@1mcp/shared";
import { intersectPolicies } from "../policy/intersection.js";

const zipAsync = promisify(zip);

export interface BuildOptions {
  cacheDir: string;
  keyPath: string;
  policy: Policy;
}

export class CapsuleBuilder {
  private privateKey: KeyLike | null = null;

  constructor(private options: BuildOptions) {}

  async initialize() {
    const keyPem = await readFile(this.options.keyPath, "utf-8");
    this.privateKey = await importPKCS8(keyPem, "EdDSA");
  }

  async dispose() {
    // Cleanup if needed
  }

  /**
   * Build capsule from run_js request
   */
  async buildJsCapsule(params: RunJsParams): Promise<string> {
    // Bundle code with esbuild - use direct build (creates new service each time)
    // This avoids service state issues in dev mode
    let bundleResult;
    try {
      bundleResult = await esbuild({
        stdin: {
          contents: params.code,
          loader: "js",
          resolveDir: process.cwd(),
        },
        bundle: true,
        format: "iife", // QuickJS doesn't support ESM, use IIFE
        target: "es2019",
        platform: "neutral",
        write: false,
        external: params.npm ? Object.keys(params.npm.dependencies) : [],
        logLevel: "silent", // Suppress esbuild logs
      });
    } catch (error) {
      throw new Error(`esbuild failed: ${error}`);
    }

    if (bundleResult.errors.length > 0) {
      throw new Error(`esbuild failed: ${bundleResult.errors[0]?.text}`);
    }

    const bundledCode = bundleResult.outputFiles?.[0]?.text || "";

    // Generate entry.js (spec §6)
    // For now, inline the shims instead of importing them
    const entryJs = `
// Runtime shims - inline for QuickJS compatibility
const shimConsole = {
  log: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.log(...args),
  info: (...args) => console.log(...args)
};

// Make console available globally if not already defined
if (typeof globalThis.console === 'undefined') {
  globalThis.console = shimConsole;
}

// Execute the bundled code
${bundledCode}
`.trim();

    // Create code layer
    const codeFiles: Record<string, Uint8Array> = {
      "entry.js": new TextEncoder().encode(entryJs),
    };

    // Add stdin if provided
    if (params.stdin) {
      codeFiles["_stdin.txt"] = new TextEncoder().encode(params.stdin);
    }

    const codeZip = await zipAsync(codeFiles);
    const codeHash = createHash("sha256").update(codeZip).digest("hex");

    // TODO: Handle npm dependencies (deps layer)
    // For v1, we bundle everything with esbuild

    // Build capsule manifest
    const capsule: Omit<Capsule, "sig"> = {
      version: "1",
      language: "js",
      runtime: { id: "quickjs@2025-10" },
      entry: {
        path: "/entry.js",
        argv: params.args || [],
        env: params.env || {},
        cwd: params.cwd || "/",
      },
      fsLayers: [
        {
          id: "code",
          sha256: codeHash,
          path: "fs.code.zip",
        },
      ],
      policy: intersectPolicies(this.options.policy, params.policy),
    };

    // Sign capsule
    const sig = await this.signCapsule(capsule);
    const signedCapsule: Capsule = { ...capsule, sig };

    // Save to cache
    const capsuleHash = this.getCapsuleHash(signedCapsule);
    await this.saveCapsule(capsuleHash, signedCapsule, codeZip);

    return capsuleHash;
  }

  /**
   * Build capsule from run_py request
   */
  async buildPyCapsule(params: RunPyParams): Promise<string> {
    // Generate entry.py (spec §6)
    const entryPy = `
import runpy, sys, io

# stdin injection
if hasattr(sys, '_relay_stdin'):
    sys.stdin = io.StringIO(sys._relay_stdin)

# TODO: Install wheels when needed
# For now, just run user code directly

# Run user code
runpy.run_path("/app/main.py", run_name="__main__")
`.trim();

    // Create code layer
    const codeFiles: Record<string, Uint8Array> = {
      "entry.py": new TextEncoder().encode(entryPy),
      "app/main.py": new TextEncoder().encode(params.code),
    };

    if (params.stdin) {
      codeFiles["_stdin.txt"] = new TextEncoder().encode(params.stdin);
    }

    const codeZip = await zipAsync(codeFiles);
    const codeHash = createHash("sha256").update(codeZip).digest("hex");

    // TODO: Handle Python wheels (deps layer)
    // For v1, skip dependencies

    const capsule: Omit<Capsule, "sig"> = {
      version: "1",
      language: "py",
      runtime: { id: "pyodide@0.27" },
      entry: {
        path: "/entry.py",
        argv: params.args || [],
        env: params.env || {},
        cwd: params.cwd || "/",
      },
      fsLayers: [
        {
          id: "code",
          sha256: codeHash,
          path: "fs.code.zip",
        },
      ],
      policy: intersectPolicies(this.options.policy, params.policy),
    };

    const sig = await this.signCapsule(capsule);
    const signedCapsule: Capsule = { ...capsule, sig };

    const capsuleHash = this.getCapsuleHash(signedCapsule);
    await this.saveCapsule(capsuleHash, signedCapsule, codeZip);

    return capsuleHash;
  }

  private async signCapsule(capsule: Omit<Capsule, "sig">): Promise<string> {
    if (!this.privateKey) {
      throw new Error("CapsuleBuilder not initialized");
    }

    const jwt = await new SignJWT({ capsule })
      .setProtectedHeader({ alg: "EdDSA" })
      .setIssuedAt()
      .sign(this.privateKey);

    return jwt;
  }

  private getCapsuleHash(capsule: Capsule): string {
    const json = JSON.stringify(capsule);
    return createHash("sha256").update(json).digest("hex").slice(0, 16);
  }

  private async saveCapsule(
    hash: string,
    capsule: Capsule,
    codeZip: Uint8Array
  ): Promise<void> {
    const dir = resolve(this.options.cacheDir, hash);
    await mkdir(dir, { recursive: true });

    await writeFile(
      join(dir, "capsule.json"),
      JSON.stringify(capsule, null, 2)
    );
    await writeFile(join(dir, "fs.code.zip"), codeZip);
  }

  /**
   * Get capsule directory for serving
   */
  getCapsuleDir(hash: string): string {
    return resolve(this.options.cacheDir, hash);
  }
}
