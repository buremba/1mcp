/**
 * Web Worker for WASM execution in browser
 *
 * This worker receives capsules from the main thread and executes them
 * in QuickJS or Pyodide WASM runtime.
 */

import type { Capsule } from "@1mcp/shared";
import { OPFSVirtualFilesystem } from "./opfs-vfs.js";
import { RUNTIME_CDNS } from "@1mcp/shared";

interface WorkerMessage {
	type: "execute";
	capsule: {
		runId: string;
		manifest: Capsule;
		urls: {
			capsule: string;
			fsLayers: string[];
		};
	};
}

interface ResultMessage {
	type: "result";
	data: {
		runId: string;
		type: "stdout" | "stderr" | "exit" | "error";
		chunk?: string;
		exitCode?: number;
		error?: string;
	};
}

/**
 * Execute a capsule in WASM runtime
 */
async function executeCapsule(message: WorkerMessage["capsule"]): Promise<void> {
	const { runId, manifest } = message;

	try {
		// TODO: Implement actual WASM execution
		// This is a placeholder that demonstrates the structure

		postMessage({
			type: "result",
			data: {
				runId,
				type: "stdout",
				chunk: "Worker: Placeholder execution started\n",
			},
		} satisfies ResultMessage);

		// Load runtime based on manifest.language
		if (manifest.language === "js") {
			await executeJavaScript(runId, manifest, message.urls);
		} else if (manifest.language === "py") {
			await executePython(runId, manifest, message.urls);
		}

		// Success exit
		postMessage({
			type: "result",
			data: {
				runId,
				type: "exit",
				exitCode: 0,
			},
		} satisfies ResultMessage);
	} catch (error) {
		// Error exit
		postMessage({
			type: "result",
			data: {
				runId,
				type: "error",
				error: error instanceof Error ? error.message : String(error),
			},
		} satisfies ResultMessage);

		postMessage({
			type: "result",
			data: {
				runId,
				type: "exit",
				exitCode: 1,
			},
		} satisfies ResultMessage);
	}
}

// Global VFS instance (persists across executions for session)
let vfs: OPFSVirtualFilesystem | null = null;

// Global QuickJS instance (loaded once)
let QuickJS: any = null;

/**
 * Load QuickJS WASM from CDN
 */
async function loadQuickJS(): Promise<any> {
	if (QuickJS) return QuickJS;

	try {
		// Try primary CDN first
		const module = await import(
			/* webpackIgnore: true */
			`${RUNTIME_CDNS.QUICKJS.PRIMARY}index.mjs`
		);
		QuickJS = await module.getQuickJS();
		return QuickJS;
	} catch (error) {
		console.warn("Primary CDN failed, trying fallback:", error);

		// Try fallback CDN
		try {
			const module = await import(
				/* webpackIgnore: true */
				`${RUNTIME_CDNS.QUICKJS.FALLBACK}index.mjs`
			);
			QuickJS = await module.getQuickJS();
			return QuickJS;
		} catch (fallbackError) {
			throw new Error(`Failed to load QuickJS from both CDNs: ${fallbackError}`);
		}
	}
}

/**
 * Execute JavaScript capsule using QuickJS WASM
 */
async function executeJavaScript(
	runId: string,
	manifest: Capsule,
	urls: { capsule: string; fsLayers: string[] },
): Promise<void> {
	try {
		// Initialize OPFS VFS if not already done
		if (!vfs && manifest.policy?.filesystem) {
			vfs = new OPFSVirtualFilesystem(manifest.policy.filesystem);
			await vfs.initialize();

			postMessage({
				type: "result",
				data: {
					runId,
					type: "stdout",
					chunk: "[OPFS] Virtual filesystem initialized\n",
				},
			} satisfies ResultMessage);
		}

		// Download capsule code
		postMessage({
			type: "result",
			data: {
				runId,
				type: "stdout",
				chunk: "[Worker] Downloading capsule...\n",
			},
		} satisfies ResultMessage);

		const capsuleResponse = await fetch(urls.capsule);
		const code = await capsuleResponse.text();

		// Setup guarded fetch for network policy
		if (manifest.policy?.network) {
			setupGuardedFetch(manifest.policy.network);
		}

		// Load QuickJS WASM
		postMessage({
			type: "result",
			data: {
				runId,
				type: "stdout",
				chunk: "[Worker] Loading QuickJS WASM...\n",
			},
		} satisfies ResultMessage);

		const quickjs = await loadQuickJS();
		const vm = quickjs.newContext();

		try {
			postMessage({
				type: "result",
				data: {
					runId,
					type: "stdout",
					chunk: "[Worker] Executing code in QuickJS...\n",
				},
			} satisfies ResultMessage);

			// Setup console.log to capture output
			const logHandle = vm.newFunction("log", (...args: any[]) => {
				const nativeArgs = args.map((arg: any) => vm.dump(arg));
				postMessage({
					type: "result",
					data: {
						runId,
						type: "stdout",
						chunk: nativeArgs.join(" ") + "\n",
					},
				} satisfies ResultMessage);
			});

			const errorHandle = vm.newFunction("error", (...args: any[]) => {
				const nativeArgs = args.map((arg: any) => vm.dump(arg));
				postMessage({
					type: "result",
					data: {
						runId,
						type: "stderr",
						chunk: nativeArgs.join(" ") + "\n",
					},
				} satisfies ResultMessage);
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
			if (vfs) {
				await injectVFSIntoQuickJS(vm, vfs, runId);
			}

			// Execute the code
			const result = vm.evalCode(code);

			if (result.error) {
				const error = vm.dump(result.error);
				result.error.dispose();

				postMessage({
					type: "result",
					data: {
						runId,
						type: "stderr",
						chunk: `Error: ${error}\n`,
					},
				} satisfies ResultMessage);
			} else {
				// Capture last expression result
				const value = vm.dump(result.value);
				result.value.dispose();

				if (value !== undefined) {
					postMessage({
						type: "result",
						data: {
							runId,
							type: "stdout",
							chunk: `Result: ${String(value)}\n`,
						},
					} satisfies ResultMessage);
				}
			}
		} finally {
			vm.dispose();
		}
	} catch (error) {
		postMessage({
			type: "result",
			data: {
				runId,
				type: "stderr",
				chunk: `Error: ${error instanceof Error ? error.message : String(error)}\n`,
			},
		} satisfies ResultMessage);
		throw error;
	}
}

/**
 * Inject VFS functions into QuickJS VM
 */
async function injectVFSIntoQuickJS(
	vm: any,
	vfs: OPFSVirtualFilesystem,
	runId: string
): Promise<void> {
	// Create VFS wrapper code that uses async functions
	const vfsCode = `
		globalThis.read = async function(path, options = {}) {
			return await __vfs_read(path);
		};

		globalThis.write = async function(path, content) {
			return await __vfs_write(path, content);
		};

		globalThis.readdir = async function(path) {
			const result = await __vfs_readdir(path);
			return JSON.parse(result);
		};

		globalThis.mkdir = async function(path) {
			return await __vfs_mkdir(path);
		};

		globalThis.exists = async function(path) {
			return await __vfs_exists(path);
		};
	`;

	// Inject low-level VFS functions
	const readHandle = vm.newFunction("__vfs_read", (pathHandle: any) => {
		const path = vm.dump(pathHandle);
		const promise = vfs.readFile(path, "utf-8");

		return vm.newPromise((resolve: any, reject: any) => {
			promise.then(
				(result) => {
					resolve(vm.newString(result as string));
				},
				(error) => {
					reject(vm.newString(String(error)));
				}
			);
		});
	});

	const writeHandle = vm.newFunction("__vfs_write", (pathHandle: any, dataHandle: any) => {
		const path = vm.dump(pathHandle);
		const data = vm.dump(dataHandle);
		const promise = vfs.writeFile(path, data);

		return vm.newPromise((resolve: any, reject: any) => {
			promise.then(
				() => {
					resolve(vm.undefined);
				},
				(error) => {
					reject(vm.newString(String(error)));
				}
			);
		});
	});

	const readdirHandle = vm.newFunction("__vfs_readdir", (pathHandle: any) => {
		const path = vm.dump(pathHandle);
		const promise = vfs.readdir(path);

		return vm.newPromise((resolve: any, reject: any) => {
			promise.then(
				(result) => {
					resolve(vm.newString(JSON.stringify(result)));
				},
				(error) => {
					reject(vm.newString(String(error)));
				}
			);
		});
	});

	const mkdirHandle = vm.newFunction("__vfs_mkdir", (pathHandle: any) => {
		const path = vm.dump(pathHandle);
		const promise = vfs.mkdir(path, { recursive: true });

		return vm.newPromise((resolve: any, reject: any) => {
			promise.then(
				() => {
					resolve(vm.undefined);
				},
				(error) => {
					reject(vm.newString(String(error)));
				}
			);
		});
	});

	const existsHandle = vm.newFunction("__vfs_exists", (pathHandle: any) => {
		const path = vm.dump(pathHandle);
		const promise = vfs.exists(path);

		return vm.newPromise((resolve: any, reject: any) => {
			promise.then(
				(result) => {
					resolve(vm.newNumber(result ? 1 : 0));
				},
				(error) => {
					reject(vm.newString(String(error)));
				}
			);
		});
	});

	vm.setProp(vm.global, "__vfs_read", readHandle);
	vm.setProp(vm.global, "__vfs_write", writeHandle);
	vm.setProp(vm.global, "__vfs_readdir", readdirHandle);
	vm.setProp(vm.global, "__vfs_mkdir", mkdirHandle);
	vm.setProp(vm.global, "__vfs_exists", existsHandle);

	readHandle.dispose();
	writeHandle.dispose();
	readdirHandle.dispose();
	mkdirHandle.dispose();
	existsHandle.dispose();

	// Execute VFS wrapper code
	const wrapperResult = vm.evalCode(vfsCode);
	if (wrapperResult.error) {
		const error = vm.dump(wrapperResult.error);
		wrapperResult.error.dispose();

		postMessage({
			type: "result",
			data: {
				runId,
				type: "stderr",
				chunk: `Warning: Failed to inject VFS: ${error}\n`,
			},
		} satisfies ResultMessage);
	} else {
		wrapperResult.value.dispose();
	}
}

/**
 * Setup guarded fetch with network policy enforcement
 */
function setupGuardedFetch(networkPolicy: any) {
	const originalFetch = globalThis.fetch;

	(globalThis as any).fetch = async (url: string | URL, options?: RequestInit) => {
		const urlString = url.toString();

		// Policy checks
		const allowedDomains = networkPolicy.allowedDomains || [];
		const deniedDomains = networkPolicy.deniedDomains || [];
		const maxBodyBytes = networkPolicy.maxBodyBytes || 5 * 1024 * 1024;

		// Parse URL
		const urlObj = new URL(urlString);

		// Check denied domains
		for (const denied of deniedDomains) {
			if (urlObj.hostname.endsWith(denied.replace("*.", ""))) {
				throw new Error(`Network policy violation: Domain ${urlObj.hostname} is denied`);
			}
		}

		// Check allowed domains (if specified)
		if (allowedDomains.length > 0) {
			let allowed = false;
			for (const allowedDomain of allowedDomains) {
				if (allowedDomain.startsWith("*.")) {
					// Wildcard domain
					const suffix = allowedDomain.slice(2);
					if (urlObj.hostname.endsWith(suffix)) {
						allowed = true;
						break;
					}
				} else if (urlObj.hostname === allowedDomain) {
					allowed = true;
					break;
				}
			}

			if (!allowed) {
				throw new Error(`Network policy violation: Domain ${urlObj.hostname} not in allowed list`);
			}
		}

		// Check IP literals
		if (networkPolicy.denyIpLiterals) {
			const ipPattern = /^\d+\.\d+\.\d+\.\d+$/;
			if (ipPattern.test(urlObj.hostname)) {
				throw new Error("Network policy violation: IP literals not allowed");
			}
		}

		// Execute fetch
		const response = await originalFetch(url, options);

		// Check response size
		const contentLength = response.headers.get("content-length");
		if (contentLength && parseInt(contentLength) > maxBodyBytes) {
			throw new Error(`Network policy violation: Response too large (${contentLength} > ${maxBodyBytes})`);
		}

		return response;
	};
}

/**
 * Execute Python capsule using Pyodide WASM
 */
async function executePython(
	runId: string,
	_manifest: Capsule,
	_urls: { capsule: string; fsLayers: string[] },
): Promise<void> {
	// TODO: Implement Pyodide execution
	// 1. Load Pyodide WASM from CDN (with SRI verification)
	// 2. Download and mount VFS layers
	// 3. Install Python packages from wheels
	// 4. Execute manifest.entry.path
	// 5. Stream stdout/stderr via postMessage

	postMessage({
		type: "result",
		data: {
			runId,
			type: "stdout",
			chunk: "TODO: Pyodide execution not yet implemented\n",
		},
	} satisfies ResultMessage);
}

// Worker message handler
self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
	const { type, capsule } = event.data;

	if (type === "execute") {
		await executeCapsule(capsule);
	}
});

// Export for type checking
export type {};
