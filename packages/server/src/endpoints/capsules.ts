/**
 * Capsule file serving (spec §2.2)
 */

import type { Context } from "hono";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CapsuleBuilder } from "../capsule/builder.js";

export function setupCapsuleEndpoints(app: any, capsuleBuilder: CapsuleBuilder) {
  app.get("/capsules/:hash/:file", async (c: Context) => {
    const hash = c.req.param("hash");
    const file = c.req.param("file");

    // Validate file name (security)
    const validFiles = ["capsule.json", "fs.code.zip", "fs.deps.zip"];
    if (!validFiles.includes(file)) {
      return c.json({ error: "Invalid file" }, 400);
    }

    try {
      const dir = capsuleBuilder.getCapsuleDir(hash);
      const filePath = join(dir, file);
      const content = await readFile(filePath);

      // Set appropriate content type
      const contentType =
        file === "capsule.json"
          ? "application/json"
          : "application/zip";

      return c.body(content, 200, {
        "Content-Type": contentType,
      });
    } catch (error) {
      console.error("Capsule file error:", error);
      return c.json({ error: "File not found" }, 404);
    }
  });
}
