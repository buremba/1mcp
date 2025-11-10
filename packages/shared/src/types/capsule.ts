/**
 * Capsule types - portable execution artifacts (spec §1.1)
 */

export interface Capsule {
  version: "1";
  language: "js";
  runtime: RuntimeInfo;
  entry: EntryPoint;
  fsLayers: FSLayer[];
  policy: Policy;
  sig: string; // JWS signature
}

export interface RuntimeInfo {
  id: string; // e.g., "quickjs@2025-10"
}

export interface EntryPoint {
  path: string; // e.g., "/entry.js"
  argv: string[];
  env: Record<string, string>;
  cwd: string;
}

export interface FSLayer {
  id: "code" | "deps" | string; // string allows "mount-{name}"
  sha256: string;
  path: string; // e.g., "fs.code.zip" or "fs.mount-workspace.zip"
  target?: string; // VFS mount point (e.g., "/workspace")
}

export interface Policy {
  network: NetworkPolicy;
  filesystem: FilesystemPolicy;
  limits: LimitsPolicy;
}

export interface NetworkPolicy {
  allowedDomains: string[];
  deniedDomains: string[];
  denyIpLiterals: boolean;
  blockPrivateRanges: boolean;
  maxBodyBytes: number;
  maxRedirects: number;
}

export interface Mount {
  source: string; // Local path or git URL
  target: string; // VFS path (e.g., "/workspace")
  type: "directory" | "git";
  readonly: boolean;
  gitRef?: string; // For git mounts: branch, tag, or commit SHA
}

export interface FilesystemPolicy {
  readonly: string[];
  writable: string[];
  mounts?: Mount[]; // Optional mount configuration
}

export interface LimitsPolicy {
  timeoutMs: number;
  memMb: number;
  stdoutBytes: number;
}

/**
 * Capsule size limits (spec v1.3)
 */
export const CAPSULE_LIMITS = {
  CODE_MAX_BYTES: 2 * 1024 * 1024, // 2MB
  DEPS_MAX_BYTES: 20 * 1024 * 1024, // 20MB
  TOTAL_MAX_BYTES: 22 * 1024 * 1024, // 22MB
} as const;
