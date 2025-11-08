import { useMemo } from "react";
import { chrome, type ChromeProviderCallbacks } from "@1mcp/ai-sdk/chrome";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

export type AIProvider = "chrome" | "openai" | "anthropic";

export interface AIProviderConfig {
	provider: AIProvider;
	model: any;
	name: string;
	isAvailable: boolean;
	error?: string;
}

interface UseAIProviderOptions {
	chromeCallbacks?: ChromeProviderCallbacks;
}

/**
 * Hook that reads environment variables and returns the configured AI provider
 */
export function useAIProvider(options?: UseAIProviderOptions): AIProviderConfig {
	return useMemo(() => {
		const provider = (import.meta.env.VITE_AI_PROVIDER || "chrome") as AIProvider;

		switch (provider) {
			case "openai": {
				const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
				const modelName = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";

				if (!apiKey) {
					return {
						provider: "openai",
						model: null,
						name: modelName,
						isAvailable: false,
						error: "OpenAI API key not configured. Set VITE_OPENAI_API_KEY in .env.local",
					};
				}

				const openai = createOpenAI({ apiKey });
				return {
					provider: "openai",
					model: openai(modelName),
					name: modelName,
					isAvailable: true,
				};
			}

			case "anthropic": {
				const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
				const modelName = import.meta.env.VITE_ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

				if (!apiKey) {
					return {
						provider: "anthropic",
						model: null,
						name: modelName,
						isAvailable: false,
						error: "Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY in .env.local",
					};
				}

				const anthropic = createAnthropic({ apiKey });
				return {
					provider: "anthropic",
					model: anthropic(modelName),
					name: modelName,
					isAvailable: true,
				};
			}

			case "chrome":
			default: {
				try {
					const chromeModel = chrome("gemini-nano", options?.chromeCallbacks);
					return {
						provider: "chrome",
						model: chromeModel,
						name: "gemini-nano",
						isAvailable: true,
					};
				} catch (error) {
					return {
						provider: "chrome",
						model: null,
						name: "gemini-nano",
						isAvailable: false,
						error: error instanceof Error ? error.message : "Chrome Prompt API not available",
					};
				}
			}
		}
	}, [options?.chromeCallbacks]);
}
