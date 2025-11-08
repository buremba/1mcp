import { useCallback, useState, useRef, useEffect } from "react";
import { streamText } from "ai";
import type { AIProviderConfig } from "./use-ai-provider";

export interface ToolCall {
	id: string;
	name: string;
	args: Record<string, unknown>;
	result?: unknown;
	status: "pending" | "complete" | "error";
}

export interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	toolCalls?: ToolCall[];
}

interface UseAssistantOptions {
	tools?: Record<string, unknown>;
	providerConfig: AIProviderConfig;
}

/**
 * Generic assistant hook that works with any AI provider
 */
export function useAssistant(options: UseAssistantOptions) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);

	// Keep a persistent provider reference
	const providerRef = useRef<any>(null);
	// Keep a ref to current messages for synchronous access
	const messagesRef = useRef<Message[]>([]);

	// Update provider when config changes
	useEffect(() => {
		providerRef.current = options.providerConfig.model;
	}, [options.providerConfig.model]);

	// Keep messagesRef in sync with messages state
	useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	// Cleanup Chrome sessions on unmount (if using Chrome provider)
	useEffect(() => {
		return () => {
			if (options.providerConfig.provider === "chrome" && providerRef.current) {
				try {
					providerRef.current.destroySession?.();
				} catch (error) {
					console.warn("Error destroying Chrome session:", error);
				}
			}
		};
	}, [options.providerConfig.provider]);

	const sendMessage = useCallback(async (content: string) => {
		if (!providerRef.current) {
			console.error("AI provider not initialized");
			return;
		}

		// Add user message
		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content,
			timestamp: Date.now(),
		};

		// Create assistant message ID before setMessages for closure access
		const assistantMessageId = crypto.randomUUID();

		// Create assistant message immediately with empty content for streaming
		const assistantMessage: Message = {
			id: assistantMessageId,
			role: "assistant",
			content: "",
			timestamp: Date.now(),
		};

		// Get current messages for API call
		const messagesForApi = [...messagesRef.current, userMessage].map(msg => ({
			role: msg.role,
			content: msg.content
		}));

		// Update messages with user message and empty assistant message
		setMessages((prev) => [...prev, userMessage, assistantMessage]);
		setIsGenerating(true);

		// Start streaming response outside of setState
		const result = streamText({
			model: providerRef.current,
			system: "You are a helpful assistant. When you use tools to help answer questions, always provide a clear, natural language explanation of the results to the user. Never just call a tool without explaining what you found.",
			messages: messagesForApi,
			tools: options.tools as any,
			maxSteps: 5, // Allow multi-step tool calling (stop after 5 steps)
		});

		// Process the stream asynchronously
		(async () => {
			let accumulatedText = "";
			try {
				console.log("Stream result:", result);

				const toolCallsFromSteps: ToolCall[] = [];

				// Stream text chunks incrementally
				for await (const textDelta of result.textStream) {
					accumulatedText += textDelta;
					
					// Update message content incrementally
					setMessages((prevMsgs) =>
						prevMsgs.map((msg) =>
							msg.id === assistantMessageId
								? { ...msg, content: accumulatedText }
								: msg
						)
					);
				}

				// Wait for final result to get steps and tool calls
				const [finalText, finalSteps] = await Promise.all([
					result.text,
					result.steps,
				]);

				console.log("Final result text:", finalText);
				console.log("Final result steps:", finalSteps);

				// Debug: log each step in detail
				if (finalSteps) {
					finalSteps.forEach((step, idx) => {
						console.log(`Step ${idx}:`, {
							text: step.text,
							toolCalls: step.toolCalls,
							toolResults: step.toolResults,
							finishReason: step.finishReason,
							usage: step.usage
						});
						// Log tool results in detail
						if (step.toolResults) {
							step.toolResults.forEach((tr, trIdx) => {
								console.log(`  Tool Result ${trIdx}:`, tr);
								console.log(`  Tool Result.result:`, tr.result);
							});
						}
					});
				}

				// Extract tool calls from steps
				if (finalSteps) {
					for (const step of finalSteps) {
						if (step.toolCalls) {
							for (const tc of step.toolCalls) {
								toolCallsFromSteps.push({
									id: tc.toolCallId,
									name: tc.toolName,
									args: (tc as any).input as Record<string, unknown>,
									result: step.toolResults?.find(r => r.toolCallId === tc.toolCallId)?.result,
									status: "complete",
								});
							}
						}
					}
				}

				// Get final response text
				let responseText = finalText || accumulatedText;

				// If text is empty but we have steps with tool results, format them nicely
				if ((!responseText || responseText.trim() === '') && finalSteps && finalSteps.length > 0) {
					const lastStep = finalSteps[finalSteps.length - 1];
					responseText = lastStep.text || accumulatedText;

					// If still empty and we have tool results, format them
					if ((!responseText || responseText.trim() === '') && lastStep.toolResults && lastStep.toolResults.length > 0) {
						const toolResultsText = lastStep.toolResults.map(tr => {
							const toolCall = lastStep.toolCalls?.find(tc => tc.toolCallId === tr.toolCallId);
							const toolName = toolCall?.toolName || 'tool';
							const output = tr.result;

							// Format the output based on its structure
							if (output && typeof output === 'object') {
								// Check for relay-mcp tool response format
								if ('success' in output && output.success && 'result' in output) {
									const innerResult = (output as any).result;
									if (innerResult && typeof innerResult === 'object' && 'lastValue' in innerResult) {
										return `The ${toolName} executed successfully and returned: **${innerResult.lastValue}**`;
									}
									return `The ${toolName} completed successfully with result: ${JSON.stringify(innerResult)}`;
								}
								// Direct result with lastValue
								if ('lastValue' in output) {
									return `The ${toolName} executed successfully and returned: **${(output as any).lastValue}**`;
								}
								return `The ${toolName} returned: ${JSON.stringify(output, null, 2)}`;
							}
							return `The ${toolName} returned: ${String(output)}`;
						}).join('\n\n');

						responseText = toolResultsText || "Tool executed successfully. Check the Tool Calls sidebar for details.";
					}
				}

				// Fallback if still empty
				if (!responseText || responseText.trim() === '') {
					responseText = accumulatedText || "Tool executed successfully. Check the Tool Calls sidebar for results.";
				}

				// Update final message with complete text and tool calls
				setMessages((prevMsgs) =>
					prevMsgs.map((msg) =>
						msg.id === assistantMessageId
							? {
									...msg,
									content: responseText,
									toolCalls: toolCallsFromSteps.length > 0 ? toolCallsFromSteps : undefined,
								}
							: msg
					)
				);
			} catch (streamError) {
				console.error("Stream processing error:", streamError);
				// Update message with error
				setMessages((prevMsgs) =>
					prevMsgs.map((msg) =>
						msg.id === assistantMessageId
							? {
									...msg,
									content: accumulatedText || `Error during streaming: ${streamError instanceof Error ? streamError.message : String(streamError)}`,
								}
							: msg
					)
				);
			} finally {
				setIsGenerating(false);
			}
		})().catch((error) => {
			console.error("Streaming error:", error);
			setIsGenerating(false);
			// Update message with error or remove empty message
			setMessages((prevMsgs) => {
				const assistantMsg = prevMsgs.find(msg => msg.id === assistantMessageId);
				if (assistantMsg && !assistantMsg.content) {
					// Remove empty message and add error message
					return prevMsgs
						.filter(msg => msg.id !== assistantMessageId)
						.concat({
							id: crypto.randomUUID(),
							role: "assistant",
							content: `Error: ${error instanceof Error ? error.message : String(error)}`,
							timestamp: Date.now(),
						});
				} else {
					// Update existing message with error
					return prevMsgs.map((msg) =>
						msg.id === assistantMessageId
							? {
									...msg,
									content: msg.content || `Error: ${error instanceof Error ? error.message : String(error)}`,
								}
							: msg
					);
				}
			});
		});
	}, [options.tools, options.providerConfig.model]);

	const clearMessages = useCallback(() => {
		setMessages([]);
		// Reset the Chrome session for a fresh start
		if (options.providerConfig.provider === "chrome" && providerRef.current) {
			try {
				providerRef.current.destroySession?.();
			} catch (error) {
				console.warn("Error destroying Chrome session:", error);
			}
		}
	}, [options.providerConfig.provider]);

	return {
		messages,
		sendMessage,
		clearMessages,
		isGenerating,
	};
}
