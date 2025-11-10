/**
 * Model configuration system
 * Supports both local (static) and remote (API-fetched) model configurations
 */

import type { AIProvider } from "../storage";

export interface ModelConfig {
	id: string; // e.g., "chrome-gemini-nano", "openai-gpt-4o-mini"
	name: string; // Display name
	provider: AIProvider;
	description: string;
	enabled: boolean; // Whether this model is available
	capabilities?: string[]; // e.g., ["chat", "function-calling", "vision"]
}

/**
 * Static model configurations for local mode
 * Reads from environment variables to determine availability
 */
export const LOCAL_MODELS: ModelConfig[] = [
	{
		id: "chrome-gemini-nano",
		name: "Gemini Nano",
		provider: "chrome",
		description: "On-device AI (Chrome built-in)",
		enabled: true, // Always available in supported browsers
		capabilities: ["chat"],
	},
	{
		id: "openai-gpt-4o-mini",
		name: "GPT-4o Mini",
		provider: "openai",
		description: "Fast and affordable OpenAI model",
		enabled: !!import.meta.env.VITE_OPENAI_API_KEY,
		capabilities: ["chat", "function-calling"],
	},
	{
		id: "openai-gpt-4o",
		name: "GPT-4o",
		provider: "openai",
		description: "Advanced OpenAI model",
		enabled: !!import.meta.env.VITE_OPENAI_API_KEY,
		capabilities: ["chat", "function-calling", "vision"],
	},
	{
		id: "anthropic-claude-3-5-sonnet-20241022",
		name: "Claude 3.5 Sonnet",
		provider: "anthropic",
		description: "Advanced reasoning and analysis",
		enabled: !!import.meta.env.VITE_ANTHROPIC_API_KEY,
		capabilities: ["chat", "function-calling"],
	},
	{
		id: "anthropic-claude-3-5-haiku-20241022",
		name: "Claude 3.5 Haiku",
		provider: "anthropic",
		description: "Fast and efficient",
		enabled: !!import.meta.env.VITE_ANTHROPIC_API_KEY,
		capabilities: ["chat", "function-calling"],
	},
];

/**
 * Get all enabled models
 */
export function getEnabledModels(): ModelConfig[] {
	return LOCAL_MODELS.filter((model) => model.enabled);
}

/**
 * Get model configuration by ID
 */
export function getModelById(id: string): ModelConfig | undefined {
	return LOCAL_MODELS.find((model) => model.id === id);
}

/**
 * Parse model ID to get provider and model name
 * Format: "provider-modelname"
 * Example: "openai-gpt-4o-mini" → { provider: "openai", modelName: "gpt-4o-mini" }
 */
export function parseModelId(modelId: string): {
	provider: AIProvider;
	modelName: string;
} {
	const parts = modelId.split("-");
	const provider = parts[0] as AIProvider;
	const modelName = parts.slice(1).join("-");

	return { provider, modelName };
}

/**
 * Create model ID from provider and model name
 */
export function createModelId(provider: AIProvider, modelName: string): string {
	return `${provider}-${modelName}`;
}

/**
 * Get default model (first enabled model, preferably Chrome AI)
 */
export function getDefaultModel(): ModelConfig {
	const enabledModels = getEnabledModels();

	// Prefer Chrome AI as default (no API key needed)
	const chromeModel = enabledModels.find((m) => m.provider === "chrome");
	if (chromeModel) return chromeModel;

	// Otherwise return first enabled model
	if (enabledModels.length > 0) return enabledModels[0];

	// Fallback to Chrome AI even if not enabled (will show error in UI)
	return LOCAL_MODELS[0];
}
