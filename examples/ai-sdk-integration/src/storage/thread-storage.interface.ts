/**
 * Thread storage interface
 * Allows swapping between localStorage, remote API, or other backends
 */

import type { Message } from "../hooks/use-assistant";

export type AIProvider = "chrome" | "openai" | "anthropic";

export interface Thread {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	modelId: string; // e.g., "chrome-gemini-nano", "openai-gpt-4o-mini"
}

export interface MessagePage {
	messages: Message[];
	nextCursor?: string;
	hasMore: boolean;
}

export interface ListMessagesOptions {
	cursor?: string;
	limit?: number;
	direction?: "before" | "after";
}

export interface IThreadStorage {
	// Thread operations (resource-oriented)
	listThreads(): Promise<Thread[]>;
	getThread(id: string): Promise<Thread | null>;
	createThread(
		thread: Omit<Thread, "id" | "createdAt" | "updatedAt">,
	): Promise<Thread>;
	updateThread(
		id: string,
		updates: Partial<Pick<Thread, "title" | "modelId">>,
	): Promise<void>;
	deleteThread(id: string): Promise<void>;

	// Current thread tracking
	getCurrentThreadId(): Promise<string | null>;
	setCurrentThreadId(threadId: string | null): Promise<void>;

	// Message operations (paginated)
	listMessages(
		threadId: string,
		options?: ListMessagesOptions,
	): Promise<MessagePage>;
	appendMessage(threadId: string, message: Message): Promise<void>;
	deleteThreadMessages(threadId: string): Promise<void>;
}
