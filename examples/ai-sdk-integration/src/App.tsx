import { useState, useEffect, useCallback } from "react";
import { useAIProvider } from "./hooks/use-ai-provider";
import { useAssistant } from "./hooks/use-assistant";
import { useThreadStorage } from "./hooks/use-thread-storage";
import { ThreadSidebar } from "./components/thread-sidebar";
import { ChatThread } from "./components/chat-thread";
import { Select } from "./components/ui/select";
import { browserTools } from "./tools/browser";
import {
	relayTools,
	initializeRelay,
	cleanupRelay,
	getRelayStatus,
} from "./tools/relay";
import type { ChromeProviderCallbacks } from "@1mcp/ai-sdk/chrome";

function App() {
	const [relayConnected, setRelayConnected] = useState(false);

	// Theme detection based on system preference
	useEffect(() => {
		const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
			document.documentElement.classList.toggle('dark', e.matches);
		};

		// Set initial theme
		updateTheme(darkModeMediaQuery);

		// Listen for changes
		darkModeMediaQuery.addEventListener('change', updateTheme);

		return () => darkModeMediaQuery.removeEventListener('change', updateTheme);
	}, []);

	// Thread storage
	const {
		threads,
		currentThreadId,
		createThread,
		selectThread,
		deleteThread,
	} = useThreadStorage();

	// Tool tracking callbacks for Chrome provider
	const chromeCallbacks: ChromeProviderCallbacks = {
		onToolCallStart: useCallback((data) => {
			console.log("Tool call started:", data);
		}, []),
		onToolCallComplete: useCallback((data) => {
			console.log("Tool call completed:", data);
		}, []),
		onToolCallError: useCallback((data) => {
			console.error("Tool call error:", data);
		}, []),
	};

	// Get AI provider configuration
	const providerConfig = useAIProvider({ chromeCallbacks });

	// Prepare tools - only include relay tools if relay is connected AND initialized
	const relayStatus = getRelayStatus();
	const allTools = {
		...browserTools,
		...(relayConnected && relayStatus.connected ? relayTools : {}),
	};

	// Generic assistant that works with any provider
	const { messages, sendMessage, clearMessages, isGenerating } = useAssistant({
		tools: allTools,
		providerConfig,
	});

	// Clean up auto-created "New Chat" threads on mount
	useEffect(() => {
		const autoCreatedThreads = threads.filter(t => t.title === "New Chat");
		if (autoCreatedThreads.length > 0) {
			const shouldClearCurrent = autoCreatedThreads.some(t => t.id === currentThreadId);
			autoCreatedThreads.forEach(thread => {
				deleteThread(thread.id);
			});
			if (shouldClearCurrent) {
				clearMessages();
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Only run once on mount

	// Initialize relay-mcp connection
	useEffect(() => {
		const initRelay = async () => {
			try {
				await initializeRelay("http://127.0.0.1:7888");
				setRelayConnected(true);
				console.log("Relay-MCP connected");
			} catch (error) {
				console.warn(
					"Relay-MCP not available. Only browser tools will work.",
					error
				);
				setRelayConnected(false);
			}
		};

		initRelay();

		return () => {
			cleanupRelay();
		};
	}, []);


	const handleCreateThread = () => {
		createThread(`Chat ${threads.length + 1}`);
		clearMessages();
	};

	const handleSelectThread = (id: string) => {
		selectThread(id);
		clearMessages();
		// TODO: Load thread messages from storage
	};

	const handleDeleteThread = (id: string) => {
		deleteThread(id);
		if (currentThreadId === id) {
			clearMessages();
		}
	};

	const handleSendMessage = async (content: string) => {
		// Create a new thread if none exists
		if (!currentThreadId) {
			const threadTitle = content.length > 50 ? content.substring(0, 50) + "..." : content;
			createThread(threadTitle);
		}
		
		// Send the message
		await sendMessage(content);
	};

	const renderStatusBadge = () => {
		return (
			<div className="flex items-center gap-2">
				{relayConnected && (
					<div className="flex items-center gap-1.5">
						<div className="h-1.5 w-1.5 rounded-full bg-green-500" />
						<span>MCP</span>
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="flex h-screen bg-background">
			{/* Thread Sidebar */}
			<ThreadSidebar
				threads={threads}
				currentThreadId={currentThreadId}
				onSelectThread={handleSelectThread}
				onCreateThread={handleCreateThread}
				onDeleteThread={handleDeleteThread}
			/>

			{/* Main Content */}
			<div className="flex-1 flex flex-col">
				{/* Minimal Top Bar */}
				<div className="border-b px-4 py-3">
					<div className="flex items-center justify-between">
						{/* Model Selector */}
						<div className="relative inline-flex items-center">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
							>
								<circle cx="12" cy="12" r="3" />
								<path d="M12 1v6m0 6v6" />
								<path d="m4.93 4.93 4.24 4.24m5.66 5.66 4.24 4.24" />
								<path d="m19.07 4.93-4.24 4.24m-5.66 5.66-4.24 4.24" />
							</svg>
							<Select
								value={providerConfig.provider}
								className="pl-9 pr-8 w-auto min-w-[180px]"
								disabled
							>
								<option value="chrome">Chrome AI ({providerConfig.provider === 'chrome' ? providerConfig.name : 'gemini-nano'})</option>
								<option value="openai">OpenAI ({providerConfig.provider === 'openai' ? providerConfig.name : 'gpt-4o-mini'})</option>
								<option value="anthropic">Claude ({providerConfig.provider === 'anthropic' ? providerConfig.name : 'claude-3-5-sonnet-20241022'})</option>
							</Select>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</div>

						<div className="flex items-center gap-2">
							{/* Status Badge */}
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								{renderStatusBadge()}
							</div>

							{/* Share Button */}
							<button
								className="p-2 hover:bg-accent rounded-md transition-colors cursor-pointer"
								title="Share"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
									<polyline points="16 6 12 2 8 6" />
									<line x1="12" x2="12" y1="2" y2="15" />
								</svg>
							</button>
						</div>
					</div>
				</div>

				{!providerConfig.isAvailable && providerConfig.error && (
					<div className="m-4 p-4 bg-destructive/10 border border-destructive rounded-md text-sm text-destructive">
						{providerConfig.error}
					</div>
				)}

				{/* Chat Area */}
				<div className="flex-1 overflow-hidden">
					<ChatThread
						messages={messages}
						onSendMessage={handleSendMessage}
						isGenerating={isGenerating}
					/>
				</div>
			</div>
		</div>
	);
}

export default App;
