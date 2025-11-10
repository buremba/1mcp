/**
 * Shared QuickJS utilities for both server and browser environments
 */

export interface QuickJSHandle {
	dispose(): void;
}

export interface QuickJSContext {
	newFunction(name: string, fn: (...args: any[]) => any): QuickJSHandle;
	newString(value: string): QuickJSHandle;
	newPromise(executor: (resolve: any, reject: any) => void): QuickJSHandle;
	setProp(target: QuickJSHandle, key: string, value: QuickJSHandle): void;
	global: QuickJSHandle;
	dump(handle: QuickJSHandle): any;
	evalCode(code: string): { error?: QuickJSHandle; value?: QuickJSHandle };
}

export interface ConsoleCallbacks {
	onStdout: (chunk: string) => void;
	onStderr: (chunk: string) => void;
}

/**
 * Setup console object in QuickJS VM with logging callbacks
 */
export function setupConsole(vm: QuickJSContext, callbacks: ConsoleCallbacks): void {
	const { onStdout, onStderr } = callbacks;

	// console.log
	const logHandle = vm.newFunction("log", (...args: QuickJSHandle[]) => {
		const nativeArgs = args.map((arg) => vm.dump(arg));
		onStdout(`${nativeArgs.join(" ")}\n`);
	});

	// console.error
	const errorHandle = vm.newFunction("error", (...args: QuickJSHandle[]) => {
		const nativeArgs = args.map((arg) => vm.dump(arg));
		onStderr(`${nativeArgs.join(" ")}\n`);
	});

	// console.warn
	const warnHandle = vm.newFunction("warn", (...args: QuickJSHandle[]) => {
		const nativeArgs = args.map((arg) => vm.dump(arg));
		onStderr(`[WARN] ${nativeArgs.join(" ")}\n`);
	});

	// console.info (alias to log)
	const infoHandle = vm.newFunction("info", (...args: QuickJSHandle[]) => {
		const nativeArgs = args.map((arg) => vm.dump(arg));
		onStdout(`${nativeArgs.join(" ")}\n`);
	});

	// Create console object
	const consoleHandle = vm.newFunction("console", () => {});
	vm.setProp(consoleHandle, "log", logHandle);
	vm.setProp(consoleHandle, "error", errorHandle);
	vm.setProp(consoleHandle, "warn", warnHandle);
	vm.setProp(consoleHandle, "info", infoHandle);
	vm.setProp(vm.global, "console", consoleHandle);

	// Cleanup
	logHandle.dispose();
	errorHandle.dispose();
	warnHandle.dispose();
	infoHandle.dispose();
	consoleHandle.dispose();
}

/**
 * Wrap a promise for use in QuickJS VM
 */
export function wrapPromiseForVM(
	vm: QuickJSContext,
	promise: Promise<any>,
	transform?: (value: any) => QuickJSHandle
): QuickJSHandle {
	return vm.newPromise((resolve: any, reject: any) => {
		promise.then(
			(result) => {
				const handle = transform ? transform(result) : vm.newString(String(result));
				resolve(handle);
				if (!transform) {
					handle.dispose();
				}
			},
			(error) => {
				const errorHandle = vm.newString(String(error));
				reject(errorHandle);
				errorHandle.dispose();
			}
		);
	});
}

/**
 * Safely dump a QuickJS result handle to a native JavaScript value
 * Handles objects by serializing to JSON
 */
export function dumpResult(vm: QuickJSContext, handle: QuickJSHandle): string | undefined {
	const value = vm.dump(handle);

	// Handle undefined/null
	if (value === undefined || value === null) {
		return undefined;
	}

	// If it's an object, serialize it to JSON
	if (typeof value === 'object') {
		try {
			const jsonStr = JSON.stringify(value);
			// Verify stringify actually worked (it returns a string, not the object)
			if (typeof jsonStr === 'string' && jsonStr !== '[object Object]') {
				return jsonStr;
			}
			// If stringify somehow failed silently, log and convert to string
			console.error('JSON.stringify produced invalid output:', jsonStr, 'for value:', value);
			return String(value);
		} catch (e) {
			// Fallback to string conversion if JSON serialization fails
			console.error('JSON.stringify threw error:', e, 'for value:', value);
			return String(value);
		}
	}

	// For primitives, convert to string for consistency
	return String(value);
}

/**
 * Wrap multi-line code to capture the last expression value
 * This handles cases where code ends with an expression that should be returned
 */
export function wrapCodeForReturn(code: string): string {
	// QuickJS's evalCode naturally returns the value of the last expression
	// No wrapping needed!
	return code.trim();
}
