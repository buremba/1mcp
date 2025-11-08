/**
 * MCP protocol endpoint (spec §2.1)
 */

import type { Context } from "hono";
import { nanoid } from "nanoid";
import type { RunJsParams, RunPyParams, BackchannelEvent } from "@1mcp/shared";
import { CapsuleBuilder } from "../capsule/builder.js";
import { NodeExecutor } from "../harness/executor.js";

export function setupMcpEndpoint(
  app: any,
  capsuleBuilder: CapsuleBuilder,
  sessionManager: any,
  nodeExecutor: NodeExecutor
) {
  app.post("/mcp", async (c: Context) => {
    try {
      const body = await c.req.json();

      // MCP JSON-RPC handling
      const { id, method, params } = body;

      // Handle MCP protocol methods
      if (method === "initialize") {
        return c.json({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "1mcp",
              version: "0.1.0",
            },
          },
        });
      }

      if (method === "notifications/initialized") {
        // Client notification, no response needed
        return c.json({ jsonrpc: "2.0" });
      }

      if (method === "tools/list") {
        return c.json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "run_js",
                description: "Execute JavaScript code in a sandboxed QuickJS environment",
                inputSchema: {
                  type: "object",
                  properties: {
                    code: {
                      type: "string",
                      description: "JavaScript code to execute",
                    },
                    stdin: {
                      type: "string",
                      description: "Standard input (optional)",
                    },
                    args: {
                      type: "array",
                      items: { type: "string" },
                      description: "Command-line arguments (optional)",
                    },
                    env: {
                      type: "object",
                      additionalProperties: { type: "string" },
                      description: "Environment variables (optional)",
                    },
                    cwd: {
                      type: "string",
                      description: "Working directory (optional)",
                    },
                  },
                  required: ["code"],
                },
              },
              {
                name: "run_py",
                description: "Execute Python code in a sandboxed Pyodide environment",
                inputSchema: {
                  type: "object",
                  properties: {
                    code: {
                      type: "string",
                      description: "Python code to execute",
                    },
                    stdin: {
                      type: "string",
                      description: "Standard input (optional)",
                    },
                    args: {
                      type: "array",
                      items: { type: "string" },
                      description: "Command-line arguments (optional)",
                    },
                    env: {
                      type: "object",
                      additionalProperties: { type: "string" },
                      description: "Environment variables (optional)",
                    },
                    cwd: {
                      type: "string",
                      description: "Working directory (optional)",
                    },
                  },
                  required: ["code"],
                },
              },
            ],
          },
        });
      }

      if (method === "tools/call") {
        const { name: toolName, arguments: toolArgs } = params;

        if (toolName === "run_js") {
          const runParams = toolArgs as RunJsParams;

          // Build capsule
          const capsuleHash = await capsuleBuilder.buildJsCapsule(runParams);

          const hasBrowser = sessionManager.hasBrowserAttached();

          if (hasBrowser) {
            const sessionId = sessionManager.getAttachedSessionId()!;
            const runId = nanoid();

            // Get base URL for capsule endpoints
            const baseUrl = `${c.req.url.split("/mcp")[0]}`;

            // Send command to browser via SSE
            sessionManager.sendCommand(sessionId, {
              type: "capsule",
              capsule: {
                hash: capsuleHash,
                manifestUrl: `${baseUrl}/capsules/${capsuleHash}/capsule.json`,
                codeUrl: `${baseUrl}/capsules/${capsuleHash}/fs.code.zip`,
              },
              runId,
            });

            // Wait for completion (with timeout)
            const timeout = 60000; // 60 seconds
            const startTime = Date.now();

            while (Date.now() - startTime < timeout) {
              const results = sessionManager.getResults(sessionId, runId);
              const exitEvent = results.find(
                (r: BackchannelEvent) =>
                  r.event.type === "exit" || r.event.type === "error"
              );

              if (exitEvent) {
                sessionManager.clearResults(sessionId, runId);

                if (exitEvent.event.type === "error") {
                  return c.json({
                    success: false,
                    error: exitEvent.event.error,
                  });
                }

                // Collect stdout
                const stdoutEvents = results.filter(
                  (r: BackchannelEvent) => r.event.type === "stdout"
                );
                const output = stdoutEvents
                  .map((e: BackchannelEvent) =>
                    Buffer.from(
                      (e.event as any).chunk,
                      "base64"
                    ).toString()
                  )
                  .join("");

                return c.json({
                  success: true,
                  output,
                  exitCode: (exitEvent.event as any).exitCode,
                });
              }

              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            return c.json({
              success: false,
              error: "Execution timeout",
            });
          } else {
            // Use Node harness
            try {
              const result = await nodeExecutor.executeCapsule(capsuleHash);
              return c.json({
                jsonrpc: "2.0",
                id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: result.stdout || "",
                    },
                  ],
                  isError: result.exitCode !== 0,
                },
              });
            } catch (error) {
              return c.json({
                jsonrpc: "2.0",
                id,
                error: {
                  code: -32603,
                  message: String(error),
                },
              });
            }
          }
        } else if (toolName === "run_py") {
          const runParams = toolArgs as RunPyParams;

          // Build capsule
          const capsuleHash = await capsuleBuilder.buildPyCapsule(runParams);

          const hasBrowser = sessionManager.hasBrowserAttached();

          if (hasBrowser) {
            const sessionId = sessionManager.getAttachedSessionId()!;
            const runId = nanoid();

            // Get base URL for capsule endpoints
            const baseUrl = `${c.req.url.split("/mcp")[0]}`;

            // Send command to browser via SSE
            sessionManager.sendCommand(sessionId, {
              type: "capsule",
              capsule: {
                hash: capsuleHash,
                manifestUrl: `${baseUrl}/capsules/${capsuleHash}/capsule.json`,
                codeUrl: `${baseUrl}/capsules/${capsuleHash}/fs.code.zip`,
              },
              runId,
            });

            // Wait for completion (with timeout)
            const timeout = 60000; // 60 seconds
            const startTime = Date.now();

            while (Date.now() - startTime < timeout) {
              const results = sessionManager.getResults(sessionId, runId);
              const exitEvent = results.find(
                (r: BackchannelEvent) =>
                  r.event.type === "exit" || r.event.type === "error"
              );

              if (exitEvent) {
                sessionManager.clearResults(sessionId, runId);

                if (exitEvent.event.type === "error") {
                  return c.json({
                    success: false,
                    error: exitEvent.event.error,
                  });
                }

                // Collect stdout
                const stdoutEvents = results.filter(
                  (r: BackchannelEvent) => r.event.type === "stdout"
                );
                const output = stdoutEvents
                  .map((e: BackchannelEvent) =>
                    Buffer.from(
                      (e.event as any).chunk,
                      "base64"
                    ).toString()
                  )
                  .join("");

                return c.json({
                  success: true,
                  output,
                  exitCode: (exitEvent.event as any).exitCode,
                });
              }

              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            return c.json({
              success: false,
              error: "Execution timeout",
            });
          } else {
            // Use Node harness
            try {
              const result = await nodeExecutor.executeCapsule(capsuleHash);
              return c.json({
                jsonrpc: "2.0",
                id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: result.stdout || "",
                    },
                  ],
                  isError: result.exitCode !== 0,
                },
              });
            } catch (error) {
              return c.json({
                jsonrpc: "2.0",
                id,
                error: {
                  code: -32603,
                  message: String(error),
                },
              });
            }
          }
        } else if (toolName === "read") {
          // TODO: Implement read tool
          return c.json({ success: false, error: "Not implemented" });
        } else if (toolName === "write") {
          // TODO: Implement write tool
          return c.json({ success: false, error: "Not implemented" });
        } else if (toolName === "search") {
          // TODO: Implement search tool
          return c.json({ success: false, error: "Not implemented" });
        }
      }

      return c.json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: "Method not found",
        },
      });
    } catch (error) {
      console.error("MCP endpoint error:", error);
      return c.json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: String(error),
        },
      }, 500);
    }
  });
}
