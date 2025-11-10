import { useMemo } from "react";
import { chrome, type ChromeProviderCallbacks } from "../providers/chrome-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { parseModelId, getModelById, getDefaultModel } from "../config/models";
import type { AIProvider } from "../storage";

export interface AIProviderConfig {
	provider: AIProvider;
	model: any;
	name: string;
	modelId: string;
	isAvailable: boolean;
	error?: string;
}

interface UseAIProviderOptions {
	modelId?: string; // e.g., "openai-gpt-4o-mini", "chrome-gemini-nano"
	chromeCallbacks?: ChromeProviderCallbacks;
}

/**
 * Hook that initializes an AI provider based on modelId
 * Supports dynamic model switching
 */
export function useAIProvider(options?: UseAIProviderOptions): AIProviderConfig {
	return useMemo(() => {
		// Get modelId from options or use default
		let selectedModelId = options?.modelId;

		if (!selectedModelId) {
			// Fallback to env or default model
			const envProvider = import.meta.env.VITE_AI_PROVIDER as AIProvider | undefined;
			if (envProvider) {
				// Try to construct from env variables
				if (envProvider === "openai") {
					const modelName = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";
					selectedModelId = `openai-${modelName}`;
				} else if (envProvider === "anthropic") {
					const modelName = import.meta.env.VITE_ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
					selectedModelId = `anthropic-${modelName}`;
				} else {
					selectedModelId = "chrome-gemini-nano";
				}
			} else {
				// Use default from model config
				const defaultModel = getDefaultModel();
				selectedModelId = defaultModel.id;
			}
		}

		// Parse modelId to get provider and model name
		const { provider, modelName } = parseModelId(selectedModelId);

		// Check if model is enabled
		const modelConfig = getModelById(selectedModelId);
		if (modelConfig && !modelConfig.enabled) {
			return {
				provider,
				model: null,
				name: modelName,
				modelId: selectedModelId,
				isAvailable: false,
				error: `${modelConfig.name} is not available. ${provider === "openai" ? "Set VITE_OPENAI_API_KEY" : provider === "anthropic" ? "Set VITE_ANTHROPIC_API_KEY" : ""}`,
			};
		}

		switch (provider) {
			case "openai": {
				const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

				if (!apiKey) {
					return {
						provider: "openai",
						model: null,
						name: modelName,
						modelId: selectedModelId,
						isAvailable: false,
						error: "OpenAI API key not configured. Set VITE_OPENAI_API_KEY in .env.local",
					};
				}

				const openai = createOpenAI({ apiKey });
				return {
					provider: "openai",
					model: openai(modelName),
					name: modelName,
					modelId: selectedModelId,
					isAvailable: true,
				};
			}

			case "anthropic": {
				const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

				if (!apiKey) {
					return {
						provider: "anthropic",
						model: null,
						name: modelName,
						modelId: selectedModelId,
						isAvailable: false,
						error: "Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY in .env.local",
					};
				}

				const anthropic = createAnthropic({ apiKey });
				return {
					provider: "anthropic",
					model: anthropic(modelName),
					name: modelName,
					modelId: selectedModelId,
					isAvailable: true,
				};
			}

			case "chrome":
			default: {
				try {
					const chromeModel = chrome(modelName, options?.chromeCallbacks);
					return {
						provider: "chrome",
						model: chromeModel,
						name: modelName,
						modelId: selectedModelId,
						isAvailable: true,
					};
				} catch (error) {
					return {
						provider: "chrome",
						model: null,
						name: modelName,
						modelId: selectedModelId,
						isAvailable: false,
						error: error instanceof Error ? error.message : "Chrome Prompt API not available",
					};
				}
			}
		}
	}, [options?.modelId, options?.chromeCallbacks]);
}
