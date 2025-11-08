/**
 * Shared constants
 */

/**
 * Browser compatibility (spec v1.3)
 */
export const BROWSER_COMPAT = {
  CHROME_MIN: 102,
  SAFARI_MIN: 17,
  FIREFOX_MIN: 111,
} as const;

/**
 * Runtime distribution (spec §1.5)
 */
export const RUNTIME_CDNS = {
  QUICKJS: {
    PRIMARY: "https://cdn.jsdelivr.net/npm/quickjs-emscripten@0.30.0/dist/",
    FALLBACK: "https://unpkg.com/quickjs-emscripten@0.30.0/dist/",
  },
  PYODIDE: {
    PRIMARY: "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/",
    FALLBACK: "https://unpkg.com/pyodide@0.27.0/",
  },
} as const;

/**
 * Error codes (spec §10)
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  POLICY_DENIED: 403,
  TIMEOUT: 408,
  OUTPUT_LIMIT_EXCEEDED: 413,
  DEPS_RESOLUTION_FAILED: 424,
  NO_EXECUTOR_ATTACHED: 425,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
} as const;

/**
 * HTTP headers
 */
export const HEADERS = {
  CORS_ALLOW_ORIGIN: "*", // spec §2.1 - wildcard for browser as client
  CONTENT_TYPE_NDJSON: "application/x-ndjson",
  CONTENT_TYPE_JSON: "application/json",
} as const;

/**
 * Endpoints (spec §2)
 */
export const ENDPOINTS = {
  MCP: "/mcp",
  SESSION_CREATE: "/session",
  SESSION_EVENTS: "/session/:id/events",
  SESSION_RESULT: "/session/:id/result",
  CAPSULE_FILE: "/capsules/:hash/:file",
  MCPS_RPC: "/mcps-rpc",
} as const;

/**
 * VFS paths (spec §1.2)
 */
export const VFS_PATHS = {
  MCPS: "/mcps",
  HOST: "/host",
  TMP: "/tmp",
  OUT: "/out",
} as const;

/**
 * Retry configuration (spec v1.3)
 */
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BACKOFF_MS: [1000, 2000, 4000], // exponential: 1s, 2s, 4s
} as const;
