/**
 * V8 Isolates runtime - fast server-side JavaScript execution
 * Uses isolated-vm for secure sandboxing with full ES6+ support
 */

import ivm from 'isolated-vm';
import type { Capsule } from '@1mcp/shared';

export interface IsolateExecutionResult {
  exitCode: number;
  lastValue?: string;
}

export class IsolateRuntime {
  /**
   * Execute JavaScript code in a V8 Isolate
   * Much faster than QuickJS (~1ms startup vs ~20ms)
   * Full ES6+ support (ES2024)
   */
  async execute(
    code: string,
    capsule: Capsule,
    onStdout: (chunk: string) => void,
    onStderr: (chunk: string) => void
  ): Promise<IsolateExecutionResult> {
    // Create new isolate with memory limit
    const memoryLimitMB = capsule.policy?.limits?.memMb || 256;
    const isolate = new ivm.Isolate({ memoryLimit: memoryLimitMB });

    try {
      // Create execution context
      const context = await isolate.createContext();

      // Inject console.log that calls onStdout
      const jail = context.global;
      await jail.set('global', jail.derefInto());

      // Create console object
      const consoleLog = new ivm.Reference(function(...args: any[]) {
        const message = args.map(arg => String(arg)).join(' ') + '\n';
        onStdout(message);
      });

      const consoleError = new ivm.Reference(function(...args: any[]) {
        const message = args.map(arg => String(arg)).join(' ') + '\n';
        onStderr(message);
      });

      await jail.set('console', {
        log: consoleLog,
        error: consoleError,
        warn: consoleLog, // Map warn to log
        info: consoleLog,  // Map info to log
      });

      // Inject process.argv and process.env
      await jail.set('process', {
        argv: capsule.entry.argv,
        env: capsule.entry.env,
        cwd: () => capsule.entry.cwd,
      });

      // TODO: Inject guarded fetch for network policy enforcement
      // For now, fetch is not available (safer default)

      // Compile and run code with timeout
      const script = await isolate.compileScript(code);
      const timeoutMs = capsule.policy?.limits?.timeoutMs || 60000;

      let lastValue: string | undefined;
      const result = await script.run(context, {
        timeout: timeoutMs,
        release: true
      });

      // Get last value if any
      if (result !== undefined) {
        lastValue = String(result);
      }

      return {
        exitCode: 0,
        lastValue,
      };
    } catch (error) {
      // Handle execution errors
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check for timeout
      if (errorMessage.includes('Script execution timed out')) {
        onStderr(`Error: Execution timeout (${capsule.policy?.limits?.timeoutMs}ms exceeded)\n`);
        return {
          exitCode: 124, // Standard timeout exit code
        };
      }

      // Check for memory limit
      if (errorMessage.includes('memory limit')) {
        onStderr(`Error: Memory limit exceeded (${memoryLimitMB}MB)\n`);
        return {
          exitCode: 137, // Standard OOM exit code
        };
      }

      // General error
      onStderr(`Error: ${errorMessage}\n`);
      return {
        exitCode: 1,
      };
    } finally {
      // Cleanup isolate
      isolate.dispose();
    }
  }
}
