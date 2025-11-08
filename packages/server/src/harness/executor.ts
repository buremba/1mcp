/**
 * Node harness executor - runs capsules server-side
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { Capsule } from "@1mcp/shared";
import { QuickJSRuntime } from "./quickjs-runtime.js";
import { PyodideRuntime } from "./pyodide-runtime.js";

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  wallMs: number;
}

export class NodeExecutor {
  private pyodideRuntime: PyodideRuntime | null = null;

  constructor(private cacheDir: string) {}

  async initialize() {
    // Pre-initialize Pyodide (it's slow to load)
    this.pyodideRuntime = new PyodideRuntime();
    await this.pyodideRuntime.initialize();
  }

  async executeCapsule(capsuleHash: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Load capsule manifest
    const capsuleDir = join(this.cacheDir, capsuleHash);
    const capsuleJson = await readFile(
      join(capsuleDir, "capsule.json"),
      "utf-8"
    );
    const capsule: Capsule = JSON.parse(capsuleJson);

    // Load code layer
    const codeZip = await readFile(join(capsuleDir, "fs.code.zip"));
    const codeFiles = unzipSync(codeZip);

    // Get entry file
    const entryPath = capsule.entry.path.replace(/^\//, ""); // Remove leading slash
    const entryCode = codeFiles[entryPath];
    if (!entryCode) {
      throw new Error(`Entry file not found: ${entryPath}`);
    }

    const code = new TextDecoder().decode(entryCode);

    // Capture stdout/stderr
    let stdout = "";
    let stderr = "";
    const onStdout = (chunk: string) => {
      stdout += chunk;
    };
    const onStderr = (chunk: string) => {
      stderr += chunk;
    };

    // Execute with appropriate runtime
    let exitCode: number;
    if (capsule.language === "js") {
      const runtime = new QuickJSRuntime();
      exitCode = await runtime.execute(code, capsule, onStdout, onStderr);
    } else if (capsule.language === "py") {
      if (!this.pyodideRuntime) {
        throw new Error("Pyodide runtime not initialized");
      }
      exitCode = await this.pyodideRuntime.execute(
        code,
        capsule,
        onStdout,
        onStderr,
        codeFiles
      );
    } else {
      throw new Error(`Unsupported language: ${capsule.language}`);
    }

    const wallMs = Date.now() - startTime;

    return {
      exitCode,
      stdout,
      stderr,
      wallMs,
    };
  }

  dispose() {
    if (this.pyodideRuntime) {
      this.pyodideRuntime.dispose();
    }
  }
}
