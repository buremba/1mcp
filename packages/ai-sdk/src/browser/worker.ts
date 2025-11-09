/**
 * Web Worker for WASM execution in browser
 *
 * This worker receives capsules from the main thread and executes them
 * in QuickJS or Pyodide WASM runtime.
 */

import type { Capsule } from "@1mcp/shared";
import { OPFSVirtualFilesystem } from "./opfs-vfs.js";

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

		// TODO: Load QuickJS WASM and execute
		// For now, use eval as a placeholder (NOT SECURE - only for development)
		postMessage({
			type: "result",
			data: {
				runId,
				type: "stdout",
				chunk: "[Worker] Executing code...\n",
			},
		} satisfies ResultMessage);

		// Inject VFS globals if available
		if (vfs) {
			(globalThis as any).read = async (path: string) => {
				return await vfs!.readFile(path, "utf-8");
			};
			(globalThis as any).write = async (path: string, data: string) => {
				await vfs!.writeFile(path, data);
			};
			(globalThis as any).readdir = async (path: string) => {
				return await vfs!.readdir(path);
			};
			(globalThis as any).mkdir = async (path: string) => {
				await vfs!.mkdir(path, { recursive: true });
			};
			(globalThis as any).exists = async (path: string) => {
				return await vfs!.exists(path);
			};
		}

		// Redirect console.log to postMessage
		const originalLog = console.log;
		const originalError = console.error;

		console.log = (...args: unknown[]) => {
			postMessage({
				type: "result",
				data: {
					runId,
					type: "stdout",
					chunk: args.join(" ") + "\n",
				},
			} satisfies ResultMessage);
		};

		console.error = (...args: unknown[]) => {
			postMessage({
				type: "result",
				data: {
					runId,
					type: "stderr",
					chunk: args.join(" ") + "\n",
				},
			} satisfies ResultMessage);
		};

		try {
			// Execute code (PLACEHOLDER - should use QuickJS WASM)
			// biome-ignore lint/security/noGlobalEval: Temporary placeholder for QuickJS
			const result = eval(code);

			if (result !== undefined) {
				postMessage({
					type: "result",
					data: {
						runId,
						type: "stdout",
						chunk: `Result: ${String(result)}\n`,
					},
				} satisfies ResultMessage);
			}
		} finally {
			// Restore console
			console.log = originalLog;
			console.error = originalError;
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
