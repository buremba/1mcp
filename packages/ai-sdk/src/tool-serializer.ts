/**
 * Tool serializer - writes AI SDK tools to files for relay-mcp
 */

import type { CoreTool } from "ai";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";

export interface ToolMetadata {
	name: string;
	description: string;
	parameters: unknown;
}

/**
 * Write AI SDK tools to the relay-mcp working directory
 *
 * Tools are written as:
 * - {workDir}/tools/{name}.json - Tool metadata (name, description, parameters)
 * - {workDir}/tools/{name}.js - Executable wrapper code
 */
export async function writeToolsToWorkDir(
	workDir: string,
	tools: Record<string, CoreTool>,
): Promise<void> {
	const toolsDir = join(workDir, "tools");
	await mkdir(toolsDir, { recursive: true });

	for (const [name, tool] of Object.entries(tools)) {
		// Write tool metadata
		const metadata: ToolMetadata = {
			name,
			description: tool.description || `Execute ${name} tool`,
			parameters: extractZodSchema(tool.parameters),
		};

		await writeFile(
			join(toolsDir, `${name}.json`),
			JSON.stringify(metadata, null, 2),
		);

		// Write executable wrapper
		// This generates code that can be run via run_js tool
		const wrapperCode = generateToolWrapper(name, tool);
		await writeFile(join(toolsDir, `${name}.js`), wrapperCode);
	}
}

/**
 * Extract Zod schema definition for JSON serialization
 */
function extractZodSchema(schema: z.ZodType<unknown> | undefined): unknown {
	if (!schema) return {};

	// Access the _def property which contains the schema definition
	const def = (schema as { _def?: unknown })._def;
	if (!def) return {};

	return def;
}

/**
 * Generate executable wrapper code for a tool
 *
 * This creates a JavaScript module that can be loaded and executed
 * by relay-mcp's run_js tool
 */
function generateToolWrapper(name: string, tool: CoreTool): string {
	return `/**
 * AI SDK Tool: ${name}
 * ${tool.description || ""}
 *
 * This is a generated wrapper for use with relay-mcp.
 * DO NOT EDIT - regenerated on each conversion.
 */

// Tool is available in global scope via relay-mcp injection
const toolExecute = globalThis.__aiSdkTools?.['${name}'];

if (!toolExecute) {
  throw new Error('Tool ${name} not found in global context');
}

export async function execute(params) {
  return await toolExecute(params);
}

export const metadata = ${JSON.stringify(
		{
			name,
			description: tool.description,
		},
		null,
		2,
	)};
`;
}
