/**
 * Session endpoints (spec §2.2)
 */

import type { Context } from "hono";
import { stream } from "hono/streaming";
import type { SessionManager } from "../services/session-manager.js";

export function setupSessionEndpoints(
  app: any,
  sessionManager: SessionManager
) {
  // Create session
  app.post("/session", async (c: Context) => {
    try {
      const { sessionId, attachToken } = await sessionManager.createSession();

      return c.json({
        sessionId,
        attachToken,
      });
    } catch (error) {
      console.error("Session creation error:", error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // SSE events stream to browser
  app.get("/session/:id/events", async (c: Context) => {
    const sessionId = c.req.param("id");
    // TODO: Verify JWT token with c.req.query("token")

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    // Mark browser as attached
    sessionManager.attachBrowser(sessionId);

    // Get or create event emitter for this session
    let emitter = sessionManager.getEventEmitter(sessionId);
    if (!emitter) {
      emitter = sessionManager.createEventEmitter(sessionId);
    }

    // Set up SSE with proper headers
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    return stream(c, async (stream) => {
      stream.onAbort(() => {
        console.log(`Session ${sessionId} disconnected`);
        sessionManager.detachBrowser(sessionId);
      });

      // Listen for commands
      const commandHandler = (command: any) => {
        console.log(`Sending command to browser:`, JSON.stringify(command));
        stream.write(`data: ${JSON.stringify(command)}\n\n`);
      };

      emitter.on("command", commandHandler);

      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        stream.write(": ping\n\n");
      }, 30000);

      try {
        await new Promise(() => {}); // Never resolves (keeps stream open)
      } finally {
        clearInterval(pingInterval);
        emitter.off("command", commandHandler);
      }
    });
  });

  // Backchannel for browser to send results
  app.post("/session/:id/result", async (c: Context) => {
    const sessionId = c.req.param("id");

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    sessionManager.updateLastSeen(sessionId);

    const body = await c.req.json();
    console.log(`Result from session ${sessionId}:`, JSON.stringify(body));

    // Store result
    sessionManager.addResult(sessionId, body);

    return c.json({ success: true });
  });
}
