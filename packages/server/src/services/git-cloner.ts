/**
 * Git repository cloning service for mount support
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Logger } from "pino";

const execAsync = promisify(exec);

export interface GitCloneOptions {
  url: string;
  ref?: string; // branch, tag, or commit SHA
  depth?: number; // shallow clone depth (default: 1)
  logger?: Logger;
}

export interface GitCloneResult {
  path: string; // Path to cloned repository
  commit: string; // Actual commit SHA cloned
  cleanup: () => Promise<void>; // Function to clean up temp directory
}

export class GitCloner {
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Clone a git repository to a temporary directory
   */
  async clone(options: GitCloneOptions): Promise<GitCloneResult> {
    const { url, ref = "HEAD", depth = 1 } = options;

    // Create temporary directory
    const tempDir = await mkdtemp(join(tmpdir(), "1mcp-git-"));
    const clonePath = join(tempDir, "repo");

    this.logger?.info({ url, ref, clonePath }, "Cloning git repository");

    try {
      // Check if git is available
      try {
        await execAsync("git --version");
      } catch (error) {
        throw new Error(
          "git command not found. Please install git to use git mounts."
        );
      }

      // Build git clone command
      // Using --depth for shallow clone, --single-branch for efficiency
      const cloneCmd = [
        "git clone",
        `--depth ${depth}`,
        "--single-branch",
        "--branch",
        ref,
        `"${url}"`,
        `"${clonePath}"`,
      ].join(" ");

      // Execute clone
      const { stderr } = await execAsync(cloneCmd, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr && !stderr.includes("Cloning into")) {
        this.logger?.warn({ stderr }, "Git clone warnings");
      }

      // Get the actual commit SHA
      const { stdout: commitSha } = await execAsync(
        'git rev-parse HEAD',
        { cwd: clonePath }
      );

      const commit = commitSha.trim();

      this.logger?.info({ commit, path: clonePath }, "Git clone successful");

      // Return result with cleanup function
      return {
        path: clonePath,
        commit,
        cleanup: async () => {
          await rm(tempDir, { recursive: true, force: true });
          this.logger?.debug({ tempDir }, "Cleaned up git clone temp directory");
        },
      };
    } catch (error) {
      // Clean up on error
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger?.error({ url, ref, error: errorMessage }, "Git clone failed");

      throw new Error(`Failed to clone git repository: ${errorMessage}`);
    }
  }

  /**
   * Validate if a string is a git URL
   */
  static isGitUrl(url: string): boolean {
    return (
      url.startsWith("https://") ||
      url.startsWith("http://") ||
      url.startsWith("git@") ||
      url.startsWith("ssh://") ||
      url.endsWith(".git")
    );
  }
}
