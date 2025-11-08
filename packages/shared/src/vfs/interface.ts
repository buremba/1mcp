/**
 * Virtual Filesystem Interface
 *
 * Unified API that works across both browser (OPFS) and Node.js (fs/promises)
 * environments. Minimal surface area covering the operations needed for
 * MCP tools (read, write, search from spec §5.2).
 */

export interface ReadFileOptions {
	encoding?: 'utf-8' | 'binary';
	maxBytes?: number; // For policy enforcement (spec §5.2)
}

export interface WriteFileOptions {
	encoding?: 'utf-8' | 'binary';
	mode?: 'create' | 'append' | 'overwrite'; // From spec §5.2
}

export interface DirEntry {
	name: string;
	type: 'file' | 'directory' | 'symlink';
}

export interface Stats {
	type: 'file' | 'directory' | 'symlink';
	size: number;
	mtime: Date;
	atime?: Date;
	ctime?: Date;
	mode?: number; // Unix permissions
}

/**
 * VirtualFilesystem - minimal cross-platform filesystem interface
 *
 * All paths are absolute and start with '/' following POSIX conventions.
 * VFS paths like /host/, /tmp/, /out/ map to different backends:
 * - Browser: OPFS (Origin Private File System)
 * - Node.js: Real filesystem with policy enforcement
 */
export interface VirtualFilesystem {
	/**
	 * Read file contents
	 * @throws Error if file doesn't exist or policy denies access
	 */
	readFile(
		path: string,
		options?: ReadFileOptions
	): Promise<string | Uint8Array>;

	/**
	 * Write file contents
	 * @throws Error if policy denies access or mode conflicts
	 */
	writeFile(
		path: string,
		content: string | Uint8Array,
		options?: WriteFileOptions
	): Promise<void>;

	/**
	 * Append to file (convenience method)
	 * @throws Error if policy denies access
	 */
	appendFile(path: string, content: string | Uint8Array): Promise<void>;

	/**
	 * Read directory entries
	 * @throws Error if path is not a directory or policy denies access
	 */
	readdir(path: string): Promise<DirEntry[]>;

	/**
	 * Create directory
	 * @throws Error if policy denies access
	 */
	mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

	/**
	 * Get file/directory metadata
	 * @throws Error if path doesn't exist or policy denies access
	 */
	stat(path: string): Promise<Stats>;

	/**
	 * Check if file/directory exists
	 */
	exists(path: string): Promise<boolean>;

	/**
	 * Delete file
	 * @throws Error if path is a directory or policy denies access
	 */
	unlink(path: string): Promise<void>;

	/**
	 * Delete directory
	 * @throws Error if path is a file or policy denies access
	 */
	rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;

	/**
	 * Resolve path to absolute canonical form
	 * (resolves symlinks, relative paths, etc.)
	 */
	realpath(path: string): Promise<string>;
}
