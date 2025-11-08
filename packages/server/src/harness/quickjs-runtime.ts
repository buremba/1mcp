/**
 * QuickJS runtime for Node.js server-side execution
 */

import { getQuickJS } from "quickjs-emscripten";
import type { Capsule } from "@1mcp/shared";

export class QuickJSRuntime {
  async execute(
    code: string,
    _capsule: Capsule,
    onStdout: (chunk: string) => void,
    onStderr: (chunk: string) => void
  ): Promise<number> {
    const QuickJS = await getQuickJS();
    const vm = QuickJS.newContext();

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

      // Execute the code
      const result = vm.evalCode(code);

      if (result.error) {
        const error = vm.dump(result.error);
        result.error.dispose();
        onStderr(`Error: ${error}\n`);
        return 1;
      }

      result.value.dispose();
      return 0;
    } catch (error) {
      onStderr(`Error: ${error}\n`);
      return 1;
    } finally {
      vm.dispose();
    }
  }
}
