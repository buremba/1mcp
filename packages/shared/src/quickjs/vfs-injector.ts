/**
 * Shared VFS injection logic for QuickJS
 * Works in both Node.js (server) and browser environments
 */

import type { QuickJSContext, QuickJSHandle } from './utils.js';
import { wrapPromiseForVM } from './utils.js';
import type { VirtualFilesystem } from '../vfs/index.js';

export interface VFSInjectorOptions {
	/**
	 * Whether to include the stat() function (server-only feature currently)
	 */
	includeStat?: boolean;

	/**
	 * Callback for error reporting
	 */
	onError?: (error: string) => void;
}

/**
 * Inject VFS functions into a QuickJS VM context
 */
export function injectVFSFunctions(
	vm: QuickJSContext,
	vfs: VirtualFilesystem,
	options: VFSInjectorOptions = {}
): void {
	const { includeStat = true, onError } = options;

	// Helper to report errors
	const reportError = (error: string) => {
		if (onError) {
			onError(error);
		} else {
			console.error(error);
		}
	};

	// Low-level __vfs_read handler
	const vfsReadHandle = vm.newFunction("__vfs_read", (pathHandle: QuickJSHandle, optionsHandle?: QuickJSHandle) => {
		const path = vm.dump(pathHandle);
		const options = optionsHandle ? vm.dump(optionsHandle) : {};

		return wrapPromiseForVM(vm, vfs.readFile(path, options), (result) => {
			if (typeof result === 'string') {
				return vm.newString(result);
			}
			// For Uint8Array, convert to string (base64 or similar could be added)
			return vm.newString(String(result));
		});
	});

	// Low-level __vfs_write handler
	const vfsWriteHandle = vm.newFunction("__vfs_write", (pathHandle: QuickJSHandle, contentHandle: QuickJSHandle, optionsHandle?: QuickJSHandle) => {
		const path = vm.dump(pathHandle);
		const content = vm.dump(contentHandle);
		const options = optionsHandle ? vm.dump(optionsHandle) : {};

		return wrapPromiseForVM(vm, vfs.writeFile(path, content, options));
	});

	// Low-level __vfs_readdir handler
	const vfsReaddirHandle = vm.newFunction("__vfs_readdir", (pathHandle: QuickJSHandle) => {
		const path = vm.dump(pathHandle);

		return wrapPromiseForVM(vm, vfs.readdir(path), (result) => {
			return vm.newString(JSON.stringify(result));
		});
	});

	// Low-level __vfs_mkdir handler
	const vfsMkdirHandle = vm.newFunction("__vfs_mkdir", (pathHandle: QuickJSHandle, optionsHandle?: QuickJSHandle) => {
		const path = vm.dump(pathHandle);
		const options = optionsHandle ? vm.dump(optionsHandle) : {};

		return wrapPromiseForVM(vm, vfs.mkdir(path, options));
	});

	// Low-level __vfs_exists handler
	const vfsExistsHandle = vm.newFunction("__vfs_exists", (pathHandle: QuickJSHandle) => {
		const path = vm.dump(pathHandle);

		return wrapPromiseForVM(vm, vfs.exists(path), (result) => {
			return vm.newString(String(result));
		});
	});

	// Optional: Low-level __vfs_stat handler (if VFS supports it)
	let vfsStatHandle: QuickJSHandle | undefined;
	if (includeStat && vfs.stat) {
		vfsStatHandle = vm.newFunction("__vfs_stat", (pathHandle: QuickJSHandle) => {
			const path = vm.dump(pathHandle);

			return wrapPromiseForVM(vm, vfs.stat!(path), (result) => {
				return vm.newString(JSON.stringify(result));
			});
		});
	}

	// Set low-level handlers on global object
	vm.setProp(vm.global, "__vfs_read", vfsReadHandle);
	vm.setProp(vm.global, "__vfs_write", vfsWriteHandle);
	vm.setProp(vm.global, "__vfs_readdir", vfsReaddirHandle);
	vm.setProp(vm.global, "__vfs_mkdir", vfsMkdirHandle);
	vm.setProp(vm.global, "__vfs_exists", vfsExistsHandle);

	if (vfsStatHandle) {
		vm.setProp(vm.global, "__vfs_stat", vfsStatHandle);
	}

	// Inject high-level JavaScript wrapper code
	const wrapperCode = generateVFSWrapperCode(includeStat && !!vfs.stat);

	const wrapperResult = vm.evalCode(wrapperCode);
	if (wrapperResult.error) {
		const errorMsg = vm.dump(wrapperResult.error);
		wrapperResult.error.dispose();
		reportError(`VFS wrapper injection failed: ${errorMsg}`);
		throw new Error(`VFS wrapper injection failed: ${errorMsg}`);
	}
	if (wrapperResult.value) {
		wrapperResult.value.dispose();
	}

	// Cleanup handles
	vfsReadHandle.dispose();
	vfsWriteHandle.dispose();
	vfsReaddirHandle.dispose();
	vfsMkdirHandle.dispose();
	vfsExistsHandle.dispose();
	if (vfsStatHandle) {
		vfsStatHandle.dispose();
	}
}

/**
 * Generate the JavaScript wrapper code that will be injected into the VM
 * This provides a nice Promise-based API on top of the low-level handlers
 */
function generateVFSWrapperCode(includeStat: boolean): string {
	const statFunction = includeStat ? `
	async stat(path) {
		const result = await __vfs_stat(path);
		return JSON.parse(result);
	},
	` : '';

	return `
(function() {
	globalThis.fs = {
		async read(path, options = {}) {
			return await __vfs_read(path, options);
		},

		async write(path, content, options = {}) {
			await __vfs_write(path, content, options);
		},

		async readdir(path) {
			const result = await __vfs_readdir(path);
			return JSON.parse(result);
		},

		async mkdir(path, options = {}) {
			await __vfs_mkdir(path, options);
		},

		async exists(path) {
			const result = await __vfs_exists(path);
			return result === 'true';
		},
		${statFunction}
	};
})();
`;
}
