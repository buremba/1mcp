/**
 * Configuration types - relay.config.json (spec §5.1)
 */

import type { Policy } from "./capsule.js";

export interface RelayConfig {
  language: "js" | "py";
  npm?: NpmConfig;
  pip?: PipConfig;
  policy: Policy;
  mcps: MCPServerConfig[];
  sessionTtlMs?: number; // default 300000 (5 min)
  signingKeyPath?: string; // default ".relay/keys/"
  cacheDir?: string; // default ".relay/capsules/"
}

export interface NpmConfig {
  dependencies: Record<string, string>;
  lockfile?: string;
}

export interface PipConfig {
  requirements: string[]; // e.g., ["requests==2.32.0"]
  wheelUrls?: string[]; // URLs to .whl files
}

export interface MCPServerConfig {
  name: string;
  transport: "http" | "stdio";
  endpoint?: string; // for HTTP transport
  command?: string; // for stdio transport
  args?: string[]; // for stdio transport
}

/**
 * Default policy (spec §5.1)
 */
export const DEFAULT_POLICY: Policy = {
  network: {
    allowedDomains: ["api.github.com", "*.npmjs.org"],
    deniedDomains: [],
    denyIpLiterals: true,
    blockPrivateRanges: true,
    maxBodyBytes: 5 * 1024 * 1024, // 5MB
    maxRedirects: 5,
  },
  filesystem: {
    readonly: ["/"],
    writable: ["/tmp", "/out"],
  },
  limits: {
    timeoutMs: 60000, // 60s
    memMb: 256,
    stdoutBytes: 1024 * 1024, // 1MB
  },
};
