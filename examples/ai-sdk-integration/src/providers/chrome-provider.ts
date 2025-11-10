import { z } from "zod";

/**
 * Chrome Prompt API types
 */
interface ChromeLanguageModelStatic {
	availability(): Promise<
		"available" | "downloadable" | "downloading" | "unavailable"
	>;
	create(options?: ChromeLanguageModelOptions): Promise<ChromeLanguageModel>;
}

interface ChromeLanguageModelOptions {
	expectedOutputs?: Array<{
		type: "text";
		languages: string[];
	}>;
	initialPrompts?: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
	tools?: ChromeTool[];
	monitor?: (m: ChromeMonitor) => void;
}

interface ChromeMonitor {
	addEventListener(
		event: "downloadprogress",
		callback: (e: { loaded: number }) => void,
	): void;
}

interface ChromeTool {
	name: string;
	description: string;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
	execute: (args: Record<string, unknown>) => Promise<string> | string;
}

interface ChromeLanguageModel {
	prompt(text: string): Promise<string>;
	destroy(): void;
}

/**
 * Declare Chrome's window.LanguageModel
 */
declare global {
	interface Window {
		LanguageModel?: ChromeLanguageModelStatic;
	}
}

/**
 * Convert Zod schema to JSON Schema for Chrome's tool format
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
	if (schema instanceof z.ZodObject) {
		const shape = schema.shape as Record<string, z.ZodType>;
		const properties: Record<string, unknown> = {};
		const required: string[] = [];

		for (const [key, value] of Object.entries(shape)) {
			properties[key] = zodToJsonSchemaField(value);
			if (!value.isOptional()) {
				required.push(key);
			}
		}

		return {
			type: "object",
			properties,
			...(required.length > 0 ? { required } : {}),
		};
	}

	return zodToJsonSchemaField(schema);
}

function zodToJsonSchemaField(schema: z.ZodType): Record<string, unknown> {
	if (schema instanceof z.ZodString) {
		const def = schema._def as { description?: string };
		return {
			type: "string",
			...(def.description ? { description: def.description } : {}),
		};
	}

	if (schema instanceof z.ZodNumber) {
		const def = schema._def as { description?: string };
		return {
			type: "number",
			...(def.description ? { description: def.description } : {}),
		};
	}

	if (schema instanceof z.ZodBoolean) {
		const def = schema._def as { description?: string };
		return {
			type: "boolean",
			...(def.description ? { description: def.description } : {}),
		};
	}

	if (schema instanceof z.ZodArray) {
		return {
			type: "array",
			items: zodToJsonSchemaField(schema.element),
		};
	}

	if (schema instanceof z.ZodOptional) {
		return zodToJsonSchemaField(schema.unwrap());
	}

	// Default fallback
	return { type: "string" };
}

/**
 * Callback interface for tracking tool calls
 */
export interface ChromeProviderCallbacks {
	onToolCallStart?: (data: { id: string; name: string; args: Record<string, unknown> }) => void;
	onToolCallComplete?: (data: { id: string; result: unknown }) => void;
	onToolCallError?: (data: { id: string; error: unknown }) => void;
}

/**
 * Chrome Prompt API Language Model Provider for AI SDK
 *
 * This is a simplified provider that works directly with Chrome's Prompt API.
 * It provides a basic language model interface compatible with AI SDK.
 */
export class ChromeLanguageModelProvider {
	readonly specificationVersion = "v2" as const;
	readonly provider = "chrome" as const;
	readonly modelId: string;
	readonly defaultObjectGenerationMode = "json" as const;
	private callbacks?: ChromeProviderCallbacks;
	private session: ChromeLanguageModel | null = null;
	private sessionTools: ChromeTool[] = [];

	constructor(modelId = "gemini-nano", callbacks?: ChromeProviderCallbacks) {
		this.modelId = modelId;
		this.callbacks = callbacks;
		// Check if Chrome Prompt API is available
		if (typeof window === "undefined" || !window.LanguageModel) {
			throw new Error(
				"Chrome Prompt API is not available. Requires Chrome 129+ with flags enabled.",
			);
		}
	}

	/**
	 * Initialize a persistent session with tools
	 */
	async initializeSession(tools?: Record<string, {
		type: string;
		name: string;
		description?: string;
		parameters: z.ZodType;
		execute?: (args: unknown) => Promise<unknown>;
	}>): Promise<void> {
		// Clean up existing session
		if (this.session) {
			this.session.destroy();
			this.session = null;
		}

		// Convert AI SDK tools to Chrome tools with tracking
		this.sessionTools = tools
			? Object.values(tools).map((tool) => ({
					name: tool.name,
					description: tool.description || "",
					inputSchema: zodToJsonSchema(tool.parameters) as {
						type: "object";
						properties: Record<string, unknown>;
						required?: string[];
					},
					execute: async (args: Record<string, unknown>) => {
						// Generate unique call ID for tracking
						const callId = crypto.randomUUID();

						// Track START
						this.callbacks?.onToolCallStart?.({
							id: callId,
							name: tool.name,
							args
						});

						try {
							if (tool.execute) {
								// AI SDK tools expect (params, context) but we only have params
								const result = await (tool.execute as any)(args);

								console.log(`[Chrome Tool] ${tool.name} returned:`, result);

								// Track COMPLETE
								this.callbacks?.onToolCallComplete?.({
									id: callId,
									result
								});

								// Chrome needs strings - convert result to string
								// If result is already a string, return as-is
								// Otherwise JSON.stringify it
								if (typeof result === 'string') {
									console.log(`[Chrome Tool] Returning string directly: ${result}`);
									return result;
								}

								const stringified = JSON.stringify(result);
								console.log(`[Chrome Tool] Returning JSON stringified: ${stringified}`);
								return stringified;
							}

							const errorResult = { error: "Tool execution not implemented" };

							// Track ERROR
							this.callbacks?.onToolCallError?.({
								id: callId,
								error: errorResult.error
							});

							return JSON.stringify(errorResult);
						} catch (error) {
							console.error(`[Chrome Tool] ${tool.name} error:`, error);

							// Track ERROR
							this.callbacks?.onToolCallError?.({
								id: callId,
								error
							});

							throw error;
						}
					},
				}))
			: [];

		// Create Chrome session with tools
		const sessionConfig: ChromeLanguageModelOptions = {
			expectedOutputs: [{ type: "text", languages: ["en"] }],
		};

		// Add improved system prompt if tools are available
		if (this.sessionTools.length > 0) {
			const toolDescriptions = this.sessionTools
				.map(t => `- ${t.name}: ${t.description}`)
				.join('\n');

			sessionConfig.initialPrompts = [{
				role: "system",
				content: `You are a helpful assistant with access to tools. When a user asks you to do something that requires using a tool, you MUST use the appropriate tool instead of just describing what you would do.

Available tools:
${toolDescriptions}

IMPORTANT:
- If the user asks you to execute code, calculate something, or perform an action that requires a tool, USE THE TOOL.
- Do not just output text descriptions like "javascript" or "here's the code". Actually execute the tool.
- After using a tool, summarize the result for the user in a natural way.`
			}];
			sessionConfig.tools = this.sessionTools;
		}

		this.session = await window.LanguageModel!.create(sessionConfig);
	}

	/**
	 * Destroy the current session
	 */
	destroySession(): void {
		if (this.session) {
			this.session.destroy();
			this.session = null;
			this.sessionTools = [];
		}
	}

	async doGenerate(options: Record<string, unknown>): Promise<Record<string, unknown>> {
		const { prompt, tools } = options as {
			prompt: Array<{ role: string; content: Array<{ type: string; text: string }> | string }>;
			tools?: Record<string, {
				type: string;
				name: string;
				description?: string;
				parameters: z.ZodType;
				execute?: (args: unknown) => Promise<unknown>;
			}>;
		};

		// Initialize session only once on first request
		if (!this.session) {
			await this.initializeSession(tools);
		}

		// Extract the last user message (Chrome's prompt() only takes the latest prompt)
		// The session maintains context from initialPrompts and previous turns
		const lastMessage = prompt[prompt.length - 1];
		if (!lastMessage) {
			throw new Error("No messages provided");
		}

		let promptText = "";
		if (typeof lastMessage.content === "string") {
			promptText = lastMessage.content;
		} else {
			promptText = lastMessage.content
				.filter((c) => c.type === "text")
				.map((c) => c.text)
				.join(" ");
		}

		// Get response from Chrome model using persistent session
		const response = await this.session!.prompt(promptText);

		return {
			text: response,
			finishReason: "stop",
			usage: {
				promptTokens: 0, // Chrome doesn't provide token counts
				completionTokens: 0,
			},
			rawCall: {
				rawPrompt: promptText,
				rawSettings: { tools: this.sessionTools },
			},
		};
	}

	async doStream(options: Record<string, unknown>): Promise<Record<string, unknown>> {
		// Chrome Prompt API doesn't support native streaming yet,
		// so we simulate it by chunking the response
		const result = await this.doGenerate(options);
		const text = (result as any).text || "";

		// Create ReadableStream that yields AI SDK v2 event objects
		const stream = new ReadableStream({
			async start(controller) {
				// Emit stream-start event
				controller.enqueue({
					type: 'stream-start',
					warnings: [],
				});

				// Simulate streaming by yielding text chunks
				const chunkSize = 5; // Characters per chunk
				for (let i = 0; i < text.length; i += chunkSize) {
					const textChunk = text.slice(i, i + chunkSize);

					// Emit text-delta event for AI SDK v2
					controller.enqueue({
						type: 'text-delta',
						delta: textChunk,
					});

					// Small delay to simulate streaming (can be removed for instant display)
					await new Promise(resolve => setTimeout(resolve, 10));
				}

				// Emit finish event
				controller.enqueue({
					type: 'finish',
					usage: {
						inputTokens: 0,
						outputTokens: 0,
					},
					finishReason: 'stop',
				});

				controller.close();
			}
		});

		return {
			stream,
			warnings: [],
		};
	}
}

/**
 * Create a Chrome language model instance
 */
export function chrome(modelId?: string, callbacks?: ChromeProviderCallbacks): ChromeLanguageModelProvider {
	return new ChromeLanguageModelProvider(modelId, callbacks);
}

/**
 * Check Chrome Prompt API availability
 */
export async function checkChromeAvailability(): Promise<{
	available: boolean;
	status: "available" | "downloadable" | "downloading" | "unavailable";
	message: string;
}> {
	if (typeof window === "undefined" || !window.LanguageModel) {
		return {
			available: false,
			status: "unavailable",
			message:
				"Chrome Prompt API not found. Requires Chrome 129+ with flags enabled.",
		};
	}

	const status = await window.LanguageModel.availability();

	const messages = {
		available: "Model is ready to use",
		downloadable: "Model can be downloaded",
		downloading: "Model is currently downloading",
		unavailable: "Model is not supported on this device",
	};

	return {
		available: status === "available",
		status,
		message: messages[status],
	};
}
