/**
 * Session types (spec §1.3, v1.3 updates)
 */

export interface Session {
  id: string;
  attachToken: string; // JWT with 5min expiry, Ed25519 signed
  createdAt: number;
  lastSeen: number;
  browserAttached: boolean;
}

export interface SessionCreateResponse {
  sessionId: string;
  attachToken: string;
}

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  TOKEN_TTL_MS: 5 * 60 * 1000, // 5 minutes
  CLEANUP_TTL_MS: 5 * 60 * 1000, // 5 minutes idle
  GRACE_PERIOD_MS: 30 * 1000, // 30 seconds on shutdown
  MAX_QUEUE_DEPTH: 100, // max concurrent requests queued
  QUEUE_ENTRY_TTL_MS: 5 * 60 * 1000, // 5 minutes max wait
} as const;
