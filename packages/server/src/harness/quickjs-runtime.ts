/**
 * QuickJS runtime for Node.js server-side execution
 */

import { getQuickJS } from "quickjs-emscripten";
import type { Capsule, VirtualFilesystem, MCPServerConfig } from "@1mcp/shared";
import type { MCPManager } from "../services/mcp-manager.js";

export class QuickJSRuntime {
  constructor(
    private vfs?: VirtualFilesystem,
    private mcpManager?: MCPManager,
    private mcpConfigs?: MCPServerConfig[]
  ) {}

  async execute(
    code: string,
    capsule: Capsule,
    onStdout: (chunk: string) => void,
    onStderr: (chunk: string) => void
  ): Promise<{ exitCode: number; lastValue?: string }> {
    const QuickJS = await getQuickJS();
    const vm = QuickJS.newContext();
    const timeoutMs = capsule.policy?.limits?.timeoutMs || 60000;
    const memMb = capsule.policy?.limits?.memMb || 256;
    const maxMemBytes = memMb * 1024 * 1024;

    // Set up interrupt handler for timeout and memory monitoring
    const startTime = Date.now();
    let interrupted = false;
    let memoryExceeded = false;
    vm.runtime.setInterruptHandler(() => {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        interrupted = true;
        return true; // Interrupt execution
      }

      // Check memory usage
      const heapUsed = process.memoryUsage().heapUsed;
      if (heapUsed > maxMemBytes) {
        memoryExceeded = true;
        return true; // Interrupt execution
      }

      return false; // Continue execution
    });

    try {
      // Set up console.log to capture output
      const logHandle = vm.newFunction("log", (...args) => {
        const nativeArgs = args.map((arg) => vm.dump(arg));
        onStdout(nativeArgs.join(" ") + "\n");
      });
      const errorHandle = vm.newFunction("error", (...args) => {
        const nativeArgs = args.map((arg) => vm.dump(arg));
        onStderr(nativeArgs.join(" ") + "\n");
      });

      const consoleHandle = vm.newObject();
      vm.setProp(consoleHandle, "log", logHandle);
      vm.setProp(consoleHandle, "error", errorHandle);
      vm.setProp(consoleHandle, "warn", logHandle);
      vm.setProp(consoleHandle, "info", logHandle);

      vm.setProp(vm.global, "console", consoleHandle);

      // Clean up handles
      logHandle.dispose();
      errorHandle.dispose();
      consoleHandle.dispose();

      // Inject VFS functions if available
      if (this.vfs) {
        this.injectVFSFunctions(vm);
      }

      // Inject MCP proxy functions if available
      if (this.mcpManager && this.mcpConfigs) {
        this.injectMCPProxies(vm);
      }

      // Execute the code
      const result = vm.evalCode(code);

      if (result.error) {
        const error = vm.dump(result.error);
        result.error.dispose();

        if (interrupted) {
          onStderr(`Error: Execution timeout after ${timeoutMs}ms\n`);
          return { exitCode: 124 }; // Timeout exit code
        }

        if (memoryExceeded) {
          const heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
          onStderr(`Error: Memory limit exceeded (${memMb}MB limit, using ${heapMb}MB)\n`);
          return { exitCode: 137 }; // Memory limit exit code
        }

        onStderr(`Error: ${error}\n`);
        return { exitCode: 1 };
      }

      // Capture last expression result (skip undefined)
      const value = vm.dump(result.value);
      result.value.dispose();

      const lastValue = value !== undefined ? String(value) : undefined;
      return { exitCode: 0, lastValue };
    } catch (error) {
      if (interrupted) {
        onStderr(`Error: Execution timeout after ${timeoutMs}ms\n`);
        return { exitCode: 124 }; // Timeout exit code
      }
      if (memoryExceeded) {
        const heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        onStderr(`Error: Memory limit exceeded (${memMb}MB limit, using ${heapMb}MB)\n`);
        return { exitCode: 137 }; // Memory limit exit code
      }
      onStderr(`Error: ${error}\n`);
      return { exitCode: 1 };
    } finally {
      vm.runtime.setInterruptHandler(() => false); // Clear handler
      vm.dispose();
    }
  }

  /**
   * Inject VFS functions into QuickJS global scope
   *
   * Creates async-returning functions that user code must await:
   * const content = await read('/tmp/file.txt');
   * await write('/tmp/output.txt', 'hello');
   */
  private injectVFSFunctions(vm: any) {
    const vfs = this.vfs!;

    // Create a promise-based wrapper for async VFS operations
    // Note: QuickJS-emscripten doesn't support async native functions directly,
    // so we use vm.evalCode to create Promise-returning functions

    const vfsCode = `
      // Filesystem read function
      globalThis.read = async function(path, options = {}) {
        return await __vfs_read(path, JSON.stringify(options));
      };

      // Filesystem write function
      globalThis.write = async function(path, content, options = {}) {
        return await __vfs_write(path, content, JSON.stringify(options));
      };

      // List directory
      globalThis.readdir = async function(path) {
        const result = await __vfs_readdir(path);
        return JSON.parse(result);
      };

      // Create directory
      globalThis.mkdir = async function(path, options = {}) {
        return await __vfs_mkdir(path, JSON.stringify(options));
      };

      // Get file stats
      globalThis.stat = async function(path) {
        const result = await __vfs_stat(path);
        return JSON.parse(result);
      };

      // Check if exists
      globalThis.exists = async function(path) {
        return await __vfs_exists(path);
      };
    `;

    // Inject the low-level __vfs_* functions that return promises
    const readHandle = vm.newFunction("__vfs_read", (pathHandle: any, optionsHandle: any) => {
      const path = vm.dump(pathHandle);
      const options = JSON.parse(vm.dump(optionsHandle) || '{}');

      // Return a promise handle
      const promise = vfs.readFile(path, options);
      return vm.newPromise((resolve: any, reject: any) => {
        promise.then(
          (result) => {
            if (result instanceof Uint8Array) {
              // Convert to array for QuickJS
              resolve(vm.newString(Buffer.from(result).toString('utf-8')));
            } else {
              resolve(vm.newString(result));
            }
          },
          (error) => {
            reject(vm.newString(String(error)));
          }
        );
      });
    });

    const writeHandle = vm.newFunction("__vfs_write", (pathHandle: any, contentHandle: any, optionsHandle: any) => {
      const path = vm.dump(pathHandle);
      const content = vm.dump(contentHandle);
      const options = JSON.parse(vm.dump(optionsHandle) || '{}');

      const promise = vfs.writeFile(path, content, options);
      return vm.newPromise((resolve: any, reject: any) => {
        promise.then(
          () => resolve(vm.undefined),
          (error) => reject(vm.newString(String(error)))
        );
      });
    });

    const readdirHandle = vm.newFunction("__vfs_readdir", (pathHandle: any) => {
      const path = vm.dump(pathHandle);

      const promise = vfs.readdir(path);
      return vm.newPromise((resolve: any, reject: any) => {
        promise.then(
          (entries) => resolve(vm.newString(JSON.stringify(entries))),
          (error) => reject(vm.newString(String(error)))
        );
      });
    });

    const mkdirHandle = vm.newFunction("__vfs_mkdir", (pathHandle: any, optionsHandle: any) => {
      const path = vm.dump(pathHandle);
      const options = JSON.parse(vm.dump(optionsHandle) || '{}');

      const promise = vfs.mkdir(path, options);
      return vm.newPromise((resolve: any, reject: any) => {
        promise.then(
          () => resolve(vm.undefined),
          (error) => reject(vm.newString(String(error)))
        );
      });
    });

    const statHandle = vm.newFunction("__vfs_stat", (pathHandle: any) => {
      const path = vm.dump(pathHandle);

      const promise = vfs.stat(path);
      return vm.newPromise((resolve: any, reject: any) => {
        promise.then(
          (stats) => {
            // Convert Date objects to ISO strings for serialization
            const serializable = {
              ...stats,
              mtime: stats.mtime.toISOString(),
              atime: stats.atime?.toISOString(),
              ctime: stats.ctime?.toISOString(),
            };
            resolve(vm.newString(JSON.stringify(serializable)));
          },
          (error) => reject(vm.newString(String(error)))
        );
      });
    });

    const existsHandle = vm.newFunction("__vfs_exists", (pathHandle: any) => {
      const path = vm.dump(pathHandle);

      const promise = vfs.exists(path);
      return vm.newPromise((resolve: any, reject: any) => {
        promise.then(
          (exists) => resolve(vm.newNumber(exists ? 1 : 0)),
          (error) => reject(vm.newString(String(error)))
        );
      });
    });

    // Set the low-level functions
    vm.setProp(vm.global, "__vfs_read", readHandle);
    vm.setProp(vm.global, "__vfs_write", writeHandle);
    vm.setProp(vm.global, "__vfs_readdir", readdirHandle);
    vm.setProp(vm.global, "__vfs_mkdir", mkdirHandle);
    vm.setProp(vm.global, "__vfs_stat", statHandle);
    vm.setProp(vm.global, "__vfs_exists", existsHandle);

    // Execute the wrapper code that creates the nice async API
    const result = vm.evalCode(vfsCode);
    if (result.error) {
      const error = vm.dump(result.error);
      result.error.dispose();
      throw new Error(`Failed to inject VFS functions: ${error}`);
    }
    result.value.dispose();

    // Clean up handles
    readHandle.dispose();
    writeHandle.dispose();
    readdirHandle.dispose();
    mkdirHandle.dispose();
    statHandle.dispose();
    existsHandle.dispose();
  }

  /**
   * Inject MCP proxy objects into QuickJS global scope
   *
   * Dynamically generates proxy objects based on mcpConfigs:
   * const result = await github.getUser({ username: 'foo' });
   * const issues = await github.listIssues({ repo: 'bar' });
   */
  private injectMCPProxies(vm: any) {
    const mcpManager = this.mcpManager!;
    const mcpConfigs = this.mcpConfigs!;

    // Create low-level __mcp_call function that bridges to MCPManager
    const mcpCallHandle = vm.newFunction("__mcp_call", (mcpNameHandle: any, methodHandle: any, paramsHandle: any) => {
      const mcpName = vm.dump(mcpNameHandle);
      const method = vm.dump(methodHandle);
      const params = JSON.parse(vm.dump(paramsHandle) || '{}');

      // Call MCPManager to proxy the request
      const promise = mcpManager.callTool(mcpName, method, params);

      return vm.newPromise((resolve: any, reject: any) => {
        promise.then(
          (result) => {
            // Return result as JSON string
            resolve(vm.newString(JSON.stringify(result)));
          },
          (error) => {
            reject(vm.newString(String(error)));
          }
        );
      });
    });

    vm.setProp(vm.global, "__mcp_call", mcpCallHandle);

    // Generate proxy code for each MCP server
    const proxyCode = mcpConfigs.map((mcpConfig) => {
      const mcpName = mcpConfig.name;

      return `
        // MCP proxy for '${mcpName}'
        globalThis.${mcpName} = new Proxy({}, {
          get: (target, method) => {
            return async function(params = {}) {
              const resultJson = await __mcp_call('${mcpName}', method, JSON.stringify(params));
              return JSON.parse(resultJson);
            };
          }
        });
      `;
    }).join('\n');

    // Execute the proxy generation code
    const result = vm.evalCode(proxyCode);
    if (result.error) {
      const error = vm.dump(result.error);
      result.error.dispose();
      throw new Error(`Failed to inject MCP proxies: ${error}`);
    }
    result.value.dispose();

    // Clean up
    mcpCallHandle.dispose();
  }
}
