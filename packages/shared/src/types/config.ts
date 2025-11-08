/**
 * Configuration types - relay.config.json (spec §5.1)
 */

import type { Policy } from "./capsule.js";

export interface RelayConfig {
  language: "js";
  npm?: NpmConfig;
  policy: Policy;
  mcps: MCPServerConfig[];
  aiSdkTools?: AiSdkToolConfig[]; // Optional AI SDK tools to load
  sessionTtlMs?: number; // default 300000 (5 min)
  signingKeyPath?: string; // default ".relay/keys/"
  cacheDir?: string; // default ".relay/capsules/"
}

export interface NpmConfig {
  dependencies: Record<string, string>;
  lockfile?: string;
}

export interface MCPServerConfig {
  name: string;
  transport: "http" | "stdio";
  endpoint?: string; // for HTTP transport
  command?: string; // for stdio transport
  args?: string[]; // for stdio transport
}

export interface AiSdkToolConfig {
  /** Path to the tool file (relative to project root or absolute) */
  path: string;
  /** Name to expose the tool as in MCP (defaults to export name or filename) */
  name?: string;
  /** Export name to use (defaults to 'default' or the only named export) */
  export?: string;
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
