/**
 * MCP protocol types (spec §2.1, §5.2)
 */

import type { Policy } from "./capsule.js";

/**
 * MCP tool call requests
 */
export interface RunJsParams {
  code: string;
  stdin?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  npm?: {
    dependencies: Record<string, string>;
  };
  policy?: Partial<Policy>; // client can override (intersection applied)
}

export interface RunPyParams {
  code: string;
  stdin?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  pip?: {
    requirements: string[];
    wheelUrls?: string[];
  };
  policy?: Partial<Policy>;
}

export interface ReadParams {
  path: string;
  encoding?: "utf-8" | "base64" | "binary";
  maxBytes?: number; // default 1MB
}

export interface ReadResult {
  content: string;
  encoding: string;
  size: number;
}

export interface WriteParams {
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
  mode?: "create" | "append" | "overwrite";
}

export interface WriteResult {
  path: string;
  bytesWritten: number;
}

export interface SearchParams {
  pattern: string; // grep-compatible regex
  paths: string[];
  filePattern?: string; // glob filter
  caseSensitive?: boolean;
  maxResults?: number; // default 100
}

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  text: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  totalMatches: number;
  truncated: boolean;
}

/**
 * Upstream MCP RPC (spec §1.4)
 */
export interface McpsRpcRequest {
  mcp: string; // MCP server name from config
  tool: string; // tool name
  params: unknown; // tool parameters
}
