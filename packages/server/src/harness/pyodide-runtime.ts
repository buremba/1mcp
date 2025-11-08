/**
 * Pyodide runtime for Node.js server-side execution
 */

import { loadPyodide, type PyodideInterface } from "pyodide";
import type { Capsule } from "@1mcp/shared";

export class PyodideRuntime {
  private pyodide: PyodideInterface | null = null;

  async initialize() {
    if (!this.pyodide) {
      this.pyodide = await loadPyodide({
        stdout: (_msg: string) => {}, // Will be overridden per execution
        stderr: (_msg: string) => {},
      });
    }
  }

  async execute(
    code: string,
    _capsule: Capsule,
    onStdout: (chunk: string) => void,
    onStderr: (chunk: string) => void,
    files: Record<string, Uint8Array>
  ): Promise<number> {
    if (!this.pyodide) {
      await this.initialize();
    }

    if (!this.pyodide) {
      throw new Error("Pyodide not initialized");
    }

    // Set up stdout/stderr capture
    this.pyodide.setStdout({ batched: (msg) => onStdout(msg) });
    this.pyodide.setStderr({ batched: (msg) => onStderr(msg) });

    try {
      // Mount files to Pyodide's virtual filesystem
      for (const [path, content] of Object.entries(files)) {
        // Ensure path starts with /
        const fullPath = path.startsWith("/") ? path : `/${path}`;
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));

        if (dirPath && dirPath !== "/") {
          // Create directory if it doesn't exist
          await this.pyodide.runPythonAsync(`
import os
os.makedirs("${dirPath}", exist_ok=True)
          `);
        }

        // Write the file
        this.pyodide.FS.writeFile(fullPath, content);
      }

      // Execute the entry code
      await this.pyodide.runPythonAsync(code);
      return 0;
    } catch (error) {
      onStderr(`Error: ${error}\n`);
      return 1;
    }
  }

  dispose() {
    this.pyodide = null;
  }
}
