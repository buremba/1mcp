/**
 * Model provider hook
 * Supports both local (static) and remote (API-fetched) model configurations
 */

import { useState, useEffect, useMemo } from "react";
import type { ModelConfig } from "../config/models";
import { getEnabledModels, getDefaultModel, getModelById } from "../config/models";

type ModelProviderMode = "local" | "remote";

interface UseModelProviderOptions {
	mode?: ModelProviderMode; // defaults to "local"
	apiEndpoint?: string; // for remote mode
}

export function useModelProvider(options: UseModelProviderOptions = {}) {
	const mode = options.mode || "local";
	const [models, setModels] = useState<ModelConfig[]>([]);
	const [selectedModelId, setSelectedModelId] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load models based on mode
	useEffect(() => {
		if (mode === "local") {
			// Local mode: use static configuration
			const enabledModels = getEnabledModels();
			const defaultModel = getDefaultModel();

			setModels(enabledModels);
			setSelectedModelId(defaultModel.id);
			setIsLoading(false);
		} else if (mode === "remote" && options.apiEndpoint) {
			// Remote mode: fetch from API
			setIsLoading(true);
			setError(null);

			fetch(`${options.apiEndpoint}/api/models`)
				.then((res) => {
					if (!res.ok) {
						throw new Error(`HTTP error! status: ${res.status}`);
					}
					return res.json();
				})
				.then((data) => {
					const remoteModels = data.models || [];
					setModels(remoteModels);

					// Set default to first model if available
					if (remoteModels.length > 0) {
						setSelectedModelId(remoteModels[0].id);
					}

					setIsLoading(false);
				})
				.catch((err) => {
					console.error("Failed to fetch models from API:", err);
					setError(err.message);
					setIsLoading(false);

					// Fallback to local models on error
					const fallbackModels = getEnabledModels();
					const defaultModel = getDefaultModel();
					setModels(fallbackModels);
					setSelectedModelId(defaultModel.id);
				});
		}
	}, [mode, options.apiEndpoint]);

	// Get currently selected model
	const selectedModel = useMemo(() => {
		return models.find((m) => m.id === selectedModelId) || null;
	}, [models, selectedModelId]);

	// Switch to a different model
	const switchModel = (modelId: string) => {
		const model = getModelById(modelId);
		if (model && model.enabled) {
			setSelectedModelId(modelId);
		} else {
			console.warn(`Model ${modelId} is not available or not enabled`);
		}
	};

	return {
		models, // Available models
		selectedModel, // Currently selected model
		selectedModelId, // ID of selected model
		switchModel, // Function to switch models
		isLoading, // Loading state (for remote mode)
		error, // Error state (for remote mode)
		mode, // Current mode
	};
}
