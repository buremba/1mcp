/**
 * TypeScript Stub Generator for MCP Tools
 *
 * Generates .ts.d files for each MCP server to provide type safety and autocomplete
 * for tools available in sandboxed code execution.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { compile } from "json-schema-to-typescript";
import type { MCPManager } from "./mcp-manager.js";
import type pino from "pino";

interface MCPTool {
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
}

interface MCPToolsResponse {
	tools: MCPTool[];
}

export class StubGenerator {
	constructor(
		private mcpManager: MCPManager,
		private outputDir: string = ".relay/mcp",
		private log?: pino.Logger,
	) {}

	/**
	 * Generate TypeScript stub files for all MCP servers
	 */
	async generateAllStubs(mcpNames: string[]): Promise<void> {
		// Create output directory
		await mkdir(this.outputDir, { recursive: true });

		let totalTools = 0;

		for (const mcpName of mcpNames) {
			try {
				const toolCount = await this.generateStubForMcp(mcpName);
				totalTools += toolCount;
				this.log?.info(
					`Generated stub for ${mcpName}: ${toolCount} tool(s)`,
				);
			} catch (error) {
				this.log?.error(
					{ error, mcpName },
					`Failed to generate stub for ${mcpName}`,
				);
			}
		}

		this.log?.info(
			`TypeScript stubs generated: ${totalTools} tools across ${mcpNames.length} MCP servers`,
		);
	}

	/**
	 * Generate TypeScript stub file for a single MCP server
	 */
	private async generateStubForMcp(mcpName: string): Promise<number> {
		// Fetch tools from MCP server
		const response = (await this.mcpManager.listTools(
			mcpName,
		)) as MCPToolsResponse;
		const tools = response.tools || [];

		if (tools.length === 0) {
			this.log?.warn(`No tools found for MCP server: ${mcpName}`);
			return 0;
		}

		// Generate TypeScript interfaces for each tool
		const interfaces: string[] = [];
		const toolMap: Record<string, string> = {};

		for (const tool of tools) {
			const interfaceName = this.toInterfaceName(tool.name);
			const tsInterface = await this.generateInterface(
				interfaceName,
				tool.inputSchema,
				tool.description,
			);
			interfaces.push(tsInterface);
			toolMap[tool.name] = interfaceName;
		}

		// Generate complete stub file
		const stubContent = this.generateStubFile(
			mcpName,
			interfaces,
			toolMap,
			tools,
		);

		// Write to file
		const filePath = join(this.outputDir, `${mcpName}.ts.d`);
		await writeFile(filePath, stubContent, "utf-8");

		return tools.length;
	}

	/**
	 * Generate TypeScript interface from JSON Schema
	 */
	private async generateInterface(
		name: string,
		schema: Record<string, unknown>,
		description?: string,
	): Promise<string> {
		try {
			// Use json-schema-to-typescript to generate interface
			const ts = await compile(schema, name, {
				bannerComment: "",
				additionalProperties: false,
				unreachableDefinitions: true,
				style: {
					tabWidth: 2,
					useTabs: false,
					singleQuote: false,
				},
			});

			// Add JSDoc comment if description exists
			if (description) {
				return `/**\n * ${description}\n */\n${ts}`;
			}

			return ts;
		} catch (error) {
			this.log?.warn(
				{ error, name },
				`Failed to generate interface for ${name}, using fallback`,
			);
			// Fallback to simple interface
			return `/**\n * ${description || name}\n */\nexport interface ${name} {\n  [key: string]: unknown;\n}\n`;
		}
	}

	/**
	 * Generate complete stub file content
	 */
	private generateStubFile(
		mcpName: string,
		interfaces: string[],
		toolMap: Record<string, string>,
		tools: MCPTool[],
	): string {
		const header = `/**
 * MCP Server: ${mcpName}
 * Auto-generated TypeScript definitions
 *
 * DO NOT EDIT - This file is automatically regenerated when the server starts.
 *
 * Generated on: ${new Date().toISOString()}
 */

`;

		const interfacesSection = interfaces.join("\n");

		const toolsInterface = `
/**
 * Available tools in the ${mcpName} MCP server
 */
export interface ${this.toPascalCase(mcpName)}Tools {
${Object.entries(toolMap)
	.map(([toolName, interfaceName]) => {
		const tool = tools.find((t) => t.name === toolName);
		const desc = tool?.description
			? `\n  /** ${tool.description} */`
			: "";
		return `${desc}\n  ${toolName}: (params: ${interfaceName}) => Promise<unknown>;`;
	})
	.join("\n")}
}
`;

		const usageExample = `
/**
 * Call a tool on the ${mcpName} MCP server
 *
 * @example
 * \`\`\`typescript
 * // Using the mcps-rpc endpoint
 * const result = await fetch('/mcps-rpc', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     mcp: '${mcpName}',
 *     tool: '${tools[0]?.name || "tool_name"}',
 *     params: { /* tool parameters */ }
 *   })
 * });
 * \`\`\`
 */
export declare function callTool<K extends keyof ${this.toPascalCase(mcpName)}Tools>(
  tool: K,
  params: Parameters<${this.toPascalCase(mcpName)}Tools[K]>[0]
): Promise<unknown>;
`;

		return (
			header +
			interfacesSection +
			toolsInterface +
			usageExample
		);
	}

	/**
	 * Convert tool name to PascalCase interface name
	 * Example: "read_file" -> "ReadFileParams"
	 */
	private toInterfaceName(toolName: string): string {
		return this.toPascalCase(toolName) + "Params";
	}

	/**
	 * Convert string to PascalCase
	 * Example: "my_tool_name" -> "MyToolName"
	 */
	private toPascalCase(str: string): string {
		return str
			.split(/[_-]/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join("");
	}
}
