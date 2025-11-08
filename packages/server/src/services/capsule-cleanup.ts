/**
 * Capsule cleanup service - prevents unlimited disk accumulation
 * Implements LRU eviction and TTL-based cleanup
 */

import { readdir, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from 'pino';

export interface CleanupConfig {
  cacheDir: string;
  maxSizeBytes: number; // Max total cache size (default: 1GB)
  maxAgeDays: number;   // Max capsule age (default: 7 days)
  intervalMs: number;   // Cleanup interval (default: 1 hour)
}

interface CapsuleInfo {
  hash: string;
  path: string;
  sizeBytes: number;
  mtimeMs: number; // Last modified time
}

export class CapsuleCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  // Metrics
  private totalCleanups = 0;
  private totalCapsules = 0;
  private totalSizeBytes = 0;
  private lastCleanupTime = 0;

  constructor(
    private config: CleanupConfig,
    private log: Logger
  ) {}

  /**
   * Start background cleanup task
   */
  start(): void {
    if (this.running) {
      this.log.warn('Capsule cleanup already running');
      return;
    }

    this.running = true;
    this.log.info({
      maxSizeMB: Math.round(this.config.maxSizeBytes / 1024 / 1024),
      maxAgeDays: this.config.maxAgeDays,
      intervalHours: Math.round(this.config.intervalMs / 1000 / 60 / 60),
    }, 'Starting capsule cleanup service');

    // Run immediately on start
    this.runCleanup().catch(err => {
      this.log.error({ err }, 'Initial cleanup failed');
    });

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup().catch(err => {
        this.log.error({ err }, 'Periodic cleanup failed');
      });
    }, this.config.intervalMs);
  }

  /**
   * Stop background cleanup task
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    this.log.info('Capsule cleanup service stopped');
  }

  /**
   * Run cleanup immediately (for testing/manual trigger)
   */
  async runCleanup(): Promise<void> {
    const startTime = Date.now();
    this.log.info('Running capsule cleanup...');

    try {
      // Scan all capsules
      const capsules = await this.scanCapsules();

      // Update metrics
      this.totalCapsules = capsules.length;
      this.totalSizeBytes = capsules.reduce((sum, c) => sum + c.sizeBytes, 0);

      this.log.info({
        totalCapsules: this.totalCapsules,
        totalSizeMB: Math.round(this.totalSizeBytes / 1024 / 1024),
      }, 'Scanned capsules');

      // Cleanup old capsules (TTL-based)
      const toDelete = await this.selectCapsulesForCleanup(capsules);

      if (toDelete.length > 0) {
        await this.deleteCapsules(toDelete);
        this.totalCleanups++;
      }

      this.lastCleanupTime = Date.now();
      const durationMs = this.lastCleanupTime - startTime;

      this.log.info({
        deleted: toDelete.length,
        remaining: this.totalCapsules - toDelete.length,
        durationMs,
      }, 'Cleanup completed');

    } catch (error) {
      this.log.error({ err: error }, 'Cleanup failed');
      throw error;
    }
  }

  /**
   * Scan cache directory and collect capsule info
   */
  private async scanCapsules(): Promise<CapsuleInfo[]> {
    const capsules: CapsuleInfo[] = [];

    try {
      const entries = await readdir(this.config.cacheDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const capsulePath = join(this.config.cacheDir, entry.name);
        const hash = entry.name;

        try {
          // Get directory size and mtime
          const { size, mtime } = await this.getDirectoryStats(capsulePath);

          capsules.push({
            hash,
            path: capsulePath,
            sizeBytes: size,
            mtimeMs: mtime.getTime(),
          });
        } catch (err) {
          // Skip inaccessible capsules
          this.log.warn({ hash, err }, 'Failed to stat capsule');
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // Cache dir doesn't exist yet, that's fine
        return [];
      }
      throw err;
    }

    return capsules;
  }

  /**
   * Get total size and mtime of a directory
   */
  private async getDirectoryStats(dirPath: string): Promise<{ size: number; mtime: Date }> {
    let totalSize = 0;
    let latestMtime = new Date(0);

    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const stats = await stat(fullPath);

      totalSize += stats.size;

      if (stats.mtime > latestMtime) {
        latestMtime = stats.mtime;
      }
    }

    return {
      size: totalSize,
      mtime: latestMtime,
    };
  }

  /**
   * Select capsules for deletion based on TTL and LRU
   */
  private async selectCapsulesForCleanup(capsules: CapsuleInfo[]): Promise<CapsuleInfo[]> {
    const now = Date.now();
    const maxAgeMs = this.config.maxAgeDays * 24 * 60 * 60 * 1000;

    // 1. Delete capsules older than TTL
    const tooOld = capsules.filter(c => now - c.mtimeMs > maxAgeMs);

    // 2. If still over size limit, delete oldest first (LRU)
    const remaining = capsules.filter(c => now - c.mtimeMs <= maxAgeMs);
    const currentSize = remaining.reduce((sum, c) => sum + c.sizeBytes, 0);

    const toDelete = [...tooOld];

    if (currentSize > this.config.maxSizeBytes) {
      // Sort by mtime (oldest first)
      remaining.sort((a, b) => a.mtimeMs - b.mtimeMs);

      let size = currentSize;
      for (const capsule of remaining) {
        if (size <= this.config.maxSizeBytes) break;

        toDelete.push(capsule);
        size -= capsule.sizeBytes;
      }
    }

    return toDelete;
  }

  /**
   * Delete capsules from disk
   */
  private async deleteCapsules(capsules: CapsuleInfo[]): Promise<void> {
    this.log.info({ count: capsules.length }, 'Deleting capsules');

    const deletePromises = capsules.map(async (capsule) => {
      try {
        await rm(capsule.path, { recursive: true, force: true });
        this.log.debug({ hash: capsule.hash }, 'Deleted capsule');
      } catch (err) {
        this.log.warn({ hash: capsule.hash, err }, 'Failed to delete capsule');
      }
    });

    await Promise.all(deletePromises);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      totalCapsules: this.totalCapsules,
      totalSizeMB: Math.round(this.totalSizeBytes / 1024 / 1024),
      maxSizeMB: Math.round(this.config.maxSizeBytes / 1024 / 1024),
      totalCleanups: this.totalCleanups,
      lastCleanupTime: this.lastCleanupTime,
      running: this.running,
    };
  }
}
