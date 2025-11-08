/**
 * Main server entry point (spec §2)
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import pino from "pino";
import { SessionManager } from "./services/session-manager.js";
import { CapsuleBuilder } from "./capsule/builder.js";
import { MCPManager } from "./services/mcp-manager.js";
import { NodeExecutor } from "./harness/executor.js";
import { setupMcpEndpoint } from "./endpoints/mcp.js";
import { setupSessionEndpoints } from "./endpoints/session.js";
import { setupCapsuleEndpoints } from "./endpoints/capsules.js";
import { setupMcpsRpcEndpoint } from "./endpoints/mcps-rpc.js";
import type { RelayConfig } from "@1mcp/shared";

export interface ServerConfig {
  config: RelayConfig;
  port: number;
  bindAddress: string;
  headless: boolean;
  keyPath: string;
  cacheDir: string;
}

export async function startServer(serverConfig: ServerConfig) {
  const app = new Hono();

  // Logger
  const log = pino({
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  });

  // CORS middleware - wildcard for browser as MCP client (spec §2.1)
  app.use("*", cors({ origin: "*" }));

  // Request logging
  app.use("*", logger());

  // Initialize services
  const sessionManager = new SessionManager(serverConfig.keyPath);
  await sessionManager.initialize();

  const capsuleBuilder = new CapsuleBuilder({
    cacheDir: serverConfig.cacheDir,
    keyPath: serverConfig.keyPath,
    policy: serverConfig.config.policy,
  });
  await capsuleBuilder.initialize();

  // Initialize Node harness executor
  const nodeExecutor = new NodeExecutor(serverConfig.cacheDir);
  await nodeExecutor.initialize();
  log.info("Node harness initialized (QuickJS + Pyodide)");

  // Initialize MCP manager for upstream MCP servers
  const mcpManager = new MCPManager(serverConfig.config.mcps, log);

  // Setup endpoints
  setupMcpEndpoint(app, capsuleBuilder, sessionManager, nodeExecutor);
  setupSessionEndpoints(app, sessionManager);
  setupCapsuleEndpoints(app, capsuleBuilder);
  setupMcpsRpcEndpoint(app, mcpManager);

  // Static file serving for UI
  if (!serverConfig.headless) {
    const { serveStatic } = await import("@hono/node-server/serve-static");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    // Serve website dist (built by Vite)
    // When built: packages/server/dist/server/src/index.js
    // Need to go up 5 levels to project root, then to website/dist
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const websiteDist = resolve(__dirname, "../../../../../website/dist");

    app.use("/*", serveStatic({ root: websiteDist }));
  }

  // Health check (headless mode only)
  if (serverConfig.headless) {
    app.get("/", (c) => {
      return c.json({
        name: "relay-mcp",
        status: "running",
        mode: "headless",
        executionMode: "node-harness-only",
        endpoints: {
          mcp: `POST http://${serverConfig.bindAddress}:${serverConfig.port}/mcp`,
        },
      });
    });
  }

  // Start server
  const server = serve(
    {
      fetch: app.fetch,
      port: serverConfig.port,
      hostname: serverConfig.bindAddress,
    },
    (info) => {
      log.info(
        `Server listening on http://${info.address}:${info.port}`
      );
    }
  );

  // Graceful shutdown (spec v1.3)
  process.on("SIGTERM", async () => {
    log.info("SIGTERM received, shutting down gracefully...");

    // Shutdown MCP manager first
    await mcpManager.shutdown();

    // Dispose node executor
    nodeExecutor.dispose();

    server.close(() => {
      log.info("Server closed");
      process.exit(0);
    });

    // Force close after grace period
    setTimeout(() => {
      log.warn("Forcing shutdown after grace period");
      process.exit(1);
    }, 30_000); // 30s grace period
  });

  return server;
}
