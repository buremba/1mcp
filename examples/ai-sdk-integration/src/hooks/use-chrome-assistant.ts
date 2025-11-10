import { useCallback, useState, useRef, useEffect } from "react";
import { generateText } from "ai";
import { chrome, type ChromeProviderCallbacks, type ChromeLanguageModelProvider } from "../providers/chrome-provider";

export interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
}

interface ToolCall {
	id: string;
	name: string;
	args: Record<string, unknown>;
	result?: unknown;
	error?: unknown;
	status: "pending" | "complete" | "error";
	timestamp: number;
}

interface UseChromeAssistantOptions {
	tools?: Record<string, unknown>;
}

export function useChromeAssistant(options: UseChromeAssistantOptions = {}) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);

	// Keep a persistent provider instance
	const providerRef = useRef<ChromeLanguageModelProvider | null>(null);

	// Tool tracking callbacks
	const callbacks: ChromeProviderCallbacks = {
		onToolCallStart: useCallback((data) => {
			setToolCalls((prev) => [
				...prev,
				{
					id: data.id,
					name: data.name,
					args: data.args,
					status: "pending",
					timestamp: Date.now(),
				},
			]);
		}, []),

		onToolCallComplete: useCallback((data) => {
			setToolCalls((prev) =>
				prev.map((call) =>
					call.id === data.id
						? { ...call, result: data.result, status: "complete" as const }
						: call
				)
			);
		}, []),

		onToolCallError: useCallback((data) => {
			setToolCalls((prev) =>
				prev.map((call) =>
					call.id === data.id
						? { ...call, error: data.error, status: "error" as const }
						: call
				)
			);
		}, []),
	};

	// Initialize provider once
	useEffect(() => {
		try {
			providerRef.current = chrome("gemini-nano", callbacks);
		} catch (error) {
			console.error("Failed to create Chrome provider:", error);
		}

		// Cleanup on unmount
		return () => {
			if (providerRef.current) {
				providerRef.current.destroySession();
			}
		};
	}, []);

	const sendMessage = useCallback(async (content: string) => {
		if (!providerRef.current) {
			console.error("Chrome provider not initialized");
			return;
		}

		// Add user message
		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content,
			timestamp: Date.now(),
		};

		setMessages((prev) => {
			const newMessages = [...prev, userMessage];

			// Generate response with full conversation history using persistent provider
			setIsGenerating(true);

			generateText({
				model: providerRef.current as any,
				messages: newMessages.map(msg => ({
					role: msg.role,
					content: msg.content
				})),
				tools: options.tools as any,
			}).then((result) => {
				// Add assistant message
				const assistantMessage: Message = {
					id: crypto.randomUUID(),
					role: "assistant",
					content: result.text,
					timestamp: Date.now(),
				};

				setMessages((prevMsgs) => [...prevMsgs, assistantMessage]);
			}).catch((error) => {
				console.error("Generation error:", error);
				// Add error message
				const errorMessage: Message = {
					id: crypto.randomUUID(),
					role: "assistant",
					content: `Error: ${error instanceof Error ? error.message : String(error)}`,
					timestamp: Date.now(),
				};
				setMessages((prevMsgs) => [...prevMsgs, errorMessage]);
			}).finally(() => {
				setIsGenerating(false);
			});

			return newMessages;
		});
	}, [options.tools]);

	const clearMessages = useCallback(() => {
		setMessages([]);
		setToolCalls([]);
		// Reset the session for a fresh start
		if (providerRef.current) {
			providerRef.current.destroySession();
		}
	}, []);

	return {
		messages,
		sendMessage,
		clearMessages,
		toolCalls,
		clearToolCalls: () => setToolCalls([]),
		isGenerating,
	};
}
