import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { MarkdownContent } from "./markdown/markdown-content";

interface ToolCall {
	id: string;
	name: string;
	args: Record<string, unknown>;
	result?: unknown;
	status: "pending" | "complete" | "error";
}

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	toolCalls?: ToolCall[];
}

interface ChatThreadProps {
	onSendMessage: (message: string) => Promise<void>;
	messages: Message[];
	isGenerating?: boolean;
}

export function ChatThread({ onSendMessage, messages, isGenerating }: ChatThreadProps) {
	const [input, setInput] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages]);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "44px";
			const scrollHeight = textareaRef.current.scrollHeight;
			textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
		}
	}, [input]);

	const handleSubmit = async () => {
		if (!input.trim() || isGenerating) return;

		const message = input;
		setInput("");
		await onSendMessage(message);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const suggestedPrompts = [
		"What's the weather in San Francisco?",
		"Explain React hooks like useState and useEffect",
	];

	const handlePromptClick = (prompt: string) => {
		if (!isGenerating) {
			onSendMessage(prompt);
		}
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			const file = files[0];
			const reader = new FileReader();
			reader.onload = (event) => {
				const content = event.target?.result as string;
				const message = `[File: ${file.name}]\n\`\`\`\n${content}\n\`\`\``;
				onSendMessage(message);
			};
			reader.readAsText(file);
		}
		e.target.value = "";
	};

	const handleAddFileClick = () => {
		fileInputRef.current?.click();
	};

	return (
		<div className="flex flex-col h-full w-full bg-background">
			{/* Messages Area */}
			<div ref={scrollRef} className="flex-1 overflow-auto w-full">
				{messages.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full px-4">
						<div className="text-center mb-12">
							<h1 className="text-4xl font-bold mb-2">Hello there!</h1>
							<p className="text-xl text-muted-foreground">How can I help you today?</p>
						</div>
						<div className="flex flex-wrap gap-3 justify-center max-w-2xl">
							{suggestedPrompts.map((prompt, index) => (
								<button
									key={index}
									onClick={() => handlePromptClick(prompt)}
									disabled={isGenerating}
									className="px-6 py-3 bg-card border border-border rounded-full text-sm hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
								>
									{prompt}
								</button>
							))}
						</div>
					</div>
				) : (
					<div className="max-w-3xl mx-auto px-4 py-8">
						{messages.map((message) => (
							<div key={message.id} className="mb-8">
								{message.role === "user" ? (
									/* User Message */
									<div className="flex justify-end">
										<div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2.5 max-w-[85%] shadow-sm">
											{message.content}
										</div>
									</div>
								) : (
									/* Assistant Message */
									<div className="space-y-4">
										{/* Tool calls (show before message content for assistant) */}
										{message.toolCalls && message.toolCalls.length > 0 && (
											<div className="space-y-2">
												{message.toolCalls.map((call) => (
													<div
														key={call.id}
														className="bg-muted/50 border border-border/50 rounded-md p-4 text-sm"
													>
														<div className="flex items-center gap-2 mb-3">
															<div className="flex items-center gap-2 font-medium text-sm">
																<span className="text-muted-foreground">🔧</span>
																<span>{call.name}</span>
															</div>
															<div
																className={`ml-auto text-xs px-2 py-1 rounded-md font-medium ${
																	call.status === "error"
																		? "bg-destructive/10 text-destructive"
																		: call.status === "complete"
																		? "bg-green-500/10 text-green-700 dark:text-green-400"
																		: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
																}`}
															>
																{call.status}
															</div>
														</div>
														{Object.keys(call.args).length > 0 && (
															<div className="text-xs text-muted-foreground mb-3">
																<div className="font-medium mb-1.5">Input:</div>
																<pre className="bg-background/50 rounded-md p-2 overflow-x-auto font-mono">
																	{JSON.stringify(call.args, null, 2)}
																</pre>
															</div>
														)}
														{call.result && (
															<div className="text-xs">
																<div className="font-medium mb-1.5 text-muted-foreground">Output:</div>
																<pre className="bg-background/50 rounded-md p-2 overflow-x-auto font-mono text-foreground">
																	{JSON.stringify(call.result, null, 2)}
																</pre>
															</div>
														)}
													</div>
												))}
											</div>
										)}

										{/* Message content */}
										<div className="prose prose-sm max-w-none dark:prose-invert">
											<MarkdownContent content={message.content} />
										</div>
									</div>
								)}
							</div>
						))}
						{isGenerating && (
							<div className="mb-8">
								<div className="flex items-center gap-2 text-muted-foreground">
									<div className="flex gap-1">
										<div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" />
										<div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.2s]" />
										<div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.4s]" />
									</div>
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Composer */}
			<div className="bg-background px-4 py-6">
				<div className="max-w-3xl mx-auto">
					<div className="relative bg-input border border-border rounded-3xl p-1">
						<input
							ref={fileInputRef}
							type="file"
							className="hidden"
							onChange={handleFileSelect}
							accept=".txt,.md,.js,.ts,.tsx,.jsx,.json,.py,.html,.css"
						/>
						<textarea
							ref={textareaRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							className="w-full px-4 py-3 bg-transparent border-0 focus:outline-none resize-none text-sm placeholder:text-muted-foreground overflow-hidden"
							placeholder="Send a message..."
							disabled={isGenerating}
							rows={1}
							style={{
								minHeight: "44px",
								maxHeight: "200px",
							}}
						/>
						<div className="flex items-center justify-between px-2 pb-1">
							<button
								type="button"
								onClick={handleAddFileClick}
								disabled={isGenerating}
								className="p-2 hover:bg-accent rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								aria-label="Add attachment"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="text-muted-foreground"
								>
									<path d="M12 5v14M5 12h14" />
								</svg>
							</button>
							<button
								onClick={handleSubmit}
								disabled={isGenerating || !input.trim()}
								className="p-2.5 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
								aria-label="Send message"
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
									<path d="M12 19V5M5 12l7-7 7 7" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
