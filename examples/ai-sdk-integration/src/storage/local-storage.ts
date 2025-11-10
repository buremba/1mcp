/**
 * LocalStorage implementation of thread storage
 */

import type {
	Thread,
	IThreadStorage,
	MessagePage,
	ListMessagesOptions,
} from "./thread-storage.interface";
import type { Message } from "../hooks/use-assistant";

const THREADS_KEY = "chrome-assistant-threads";
const CURRENT_THREAD_KEY = "chrome-assistant-current-thread";
const MESSAGES_KEY_PREFIX = "chrome-assistant-messages-";

export class LocalStorageThreadStorage implements IThreadStorage {
	// Thread operations

	async listThreads(): Promise<Thread[]> {
		try {
			const stored = localStorage.getItem(THREADS_KEY);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error("Failed to load threads from localStorage:", error);
			return [];
		}
	}

	async getThread(id: string): Promise<Thread | null> {
		const threads = await this.listThreads();
		return threads.find((t) => t.id === id) || null;
	}

	async createThread(
		thread: Omit<Thread, "id" | "createdAt" | "updatedAt">,
	): Promise<Thread> {
		const now = Date.now();
		const newThread: Thread = {
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now,
			...thread,
		};

		const threads = await this.listThreads();
		threads.unshift(newThread);
		await this.saveThreads(threads);

		return newThread;
	}

	async updateThread(
		id: string,
		updates: Partial<Pick<Thread, "title" | "modelId">>,
	): Promise<void> {
		const threads = await this.listThreads();
		const index = threads.findIndex((t) => t.id === id);

		if (index === -1) {
			throw new Error(`Thread ${id} not found`);
		}

		threads[index] = {
			...threads[index],
			...updates,
			updatedAt: Date.now(),
		};

		await this.saveThreads(threads);
	}

	async deleteThread(id: string): Promise<void> {
		const threads = await this.listThreads();
		const filtered = threads.filter((t) => t.id !== id);
		await this.saveThreads(filtered);

		// Also delete thread messages
		await this.deleteThreadMessages(id);

		// Clear current thread if it was deleted
		const currentId = await this.getCurrentThreadId();
		if (currentId === id) {
			await this.setCurrentThreadId(null);
		}
	}

	// Current thread tracking

	async getCurrentThreadId(): Promise<string | null> {
		try {
			return localStorage.getItem(CURRENT_THREAD_KEY);
		} catch (error) {
			console.error("Failed to get current thread ID from localStorage:", error);
			return null;
		}
	}

	async setCurrentThreadId(threadId: string | null): Promise<void> {
		try {
			if (threadId) {
				localStorage.setItem(CURRENT_THREAD_KEY, threadId);
			} else {
				localStorage.removeItem(CURRENT_THREAD_KEY);
			}
		} catch (error) {
			console.error("Failed to save current thread ID to localStorage:", error);
			throw error;
		}
	}

	// Message operations

	async listMessages(
		threadId: string,
		options?: ListMessagesOptions,
	): Promise<MessagePage> {
		try {
			const key = `${MESSAGES_KEY_PREFIX}${threadId}`;
			const stored = localStorage.getItem(key);
			const allMessages: Message[] = stored ? JSON.parse(stored) : [];

			// Simulate cursor-based pagination
			const limit = options?.limit || 50;
			const direction = options?.direction || "before";

			if (!options?.cursor) {
				// First page: return most recent messages
				const messages = allMessages.slice(-limit);
				const hasMore = allMessages.length > limit;
				const nextCursor = hasMore
					? allMessages[allMessages.length - limit - 1]?.id
					: undefined;

				return {
					messages,
					nextCursor,
					hasMore,
				};
			}

			// Find cursor position
			const cursorIndex = allMessages.findIndex((m) => m.id === options.cursor);
			if (cursorIndex === -1) {
				// Cursor not found, return empty page
				return {
					messages: [],
					nextCursor: undefined,
					hasMore: false,
				};
			}

			// Get messages based on direction
			let messages: Message[];
			let hasMore: boolean;
			let nextCursor: string | undefined;

			if (direction === "before") {
				// Load older messages (before cursor)
				const startIndex = Math.max(0, cursorIndex - limit);
				messages = allMessages.slice(startIndex, cursorIndex);
				hasMore = startIndex > 0;
				nextCursor = hasMore ? allMessages[startIndex - 1]?.id : undefined;
			} else {
				// Load newer messages (after cursor)
				const endIndex = Math.min(allMessages.length, cursorIndex + 1 + limit);
				messages = allMessages.slice(cursorIndex + 1, endIndex);
				hasMore = endIndex < allMessages.length;
				nextCursor = hasMore ? allMessages[endIndex]?.id : undefined;
			}

			return {
				messages,
				nextCursor,
				hasMore,
			};
		} catch (error) {
			console.error("Failed to load messages from localStorage:", error);
			return {
				messages: [],
				nextCursor: undefined,
				hasMore: false,
			};
		}
	}

	async appendMessage(threadId: string, message: Message): Promise<void> {
		try {
			const key = `${MESSAGES_KEY_PREFIX}${threadId}`;
			const stored = localStorage.getItem(key);
			const messages: Message[] = stored ? JSON.parse(stored) : [];

			// Check if message already exists (avoid duplicates)
			const existingIndex = messages.findIndex((m) => m.id === message.id);
			if (existingIndex !== -1) {
				// Update existing message
				messages[existingIndex] = message;
			} else {
				// Append new message
				messages.push(message);
			}

			localStorage.setItem(key, JSON.stringify(messages));
		} catch (error) {
			console.error("Failed to append message to localStorage:", error);
			throw error;
		}
	}

	async deleteThreadMessages(threadId: string): Promise<void> {
		try {
			const key = `${MESSAGES_KEY_PREFIX}${threadId}`;
			localStorage.removeItem(key);
		} catch (error) {
			console.error("Failed to delete thread messages from localStorage:", error);
			throw error;
		}
	}

	// Helper method (private)
	private async saveThreads(threads: Thread[]): Promise<void> {
		try {
			localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
		} catch (error) {
			console.error("Failed to save threads to localStorage:", error);
			throw error;
		}
	}
}
