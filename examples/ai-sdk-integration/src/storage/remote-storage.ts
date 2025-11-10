/**
 * Remote API implementation of thread storage
 */

import type {
	Thread,
	IThreadStorage,
	MessagePage,
	ListMessagesOptions,
} from "./thread-storage.interface";
import type { Message } from "../hooks/use-assistant";

export interface RemoteStorageConfig {
	baseUrl: string;
	apiKey?: string;
}

export class RemoteThreadStorage implements IThreadStorage {
	private config: RemoteStorageConfig;

	constructor(config: RemoteStorageConfig) {
		this.config = config;
	}

	// Thread operations

	async listThreads(): Promise<Thread[]> {
		try {
			const response = await fetch(`${this.config.baseUrl}/threads`, {
				method: "GET",
				headers: this.getHeaders(),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Failed to load threads from remote API:", error);
			return [];
		}
	}

	async getThread(id: string): Promise<Thread | null> {
		try {
			const response = await fetch(`${this.config.baseUrl}/threads/${id}`, {
				method: "GET",
				headers: this.getHeaders(),
			});

			if (!response.ok) {
				if (response.status === 404) {
					return null;
				}
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Failed to get thread from remote API:", error);
			return null;
		}
	}

	async createThread(
		thread: Omit<Thread, "id" | "createdAt" | "updatedAt">,
	): Promise<Thread> {
		try {
			const response = await fetch(`${this.config.baseUrl}/threads`, {
				method: "POST",
				headers: this.getHeaders(),
				body: JSON.stringify(thread),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Failed to create thread via remote API:", error);
			throw error;
		}
	}

	async updateThread(
		id: string,
		updates: Partial<Pick<Thread, "title" | "modelId">>,
	): Promise<void> {
		try {
			const response = await fetch(`${this.config.baseUrl}/threads/${id}`, {
				method: "PATCH",
				headers: this.getHeaders(),
				body: JSON.stringify(updates),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (error) {
			console.error("Failed to update thread via remote API:", error);
			throw error;
		}
	}

	async deleteThread(id: string): Promise<void> {
		try {
			const response = await fetch(`${this.config.baseUrl}/threads/${id}`, {
				method: "DELETE",
				headers: this.getHeaders(),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (error) {
			console.error("Failed to delete thread via remote API:", error);
			throw error;
		}
	}

	// Current thread tracking

	async getCurrentThreadId(): Promise<string | null> {
		try {
			const response = await fetch(
				`${this.config.baseUrl}/threads/current`,
				{
					method: "GET",
					headers: this.getHeaders(),
				},
			);

			if (!response.ok) {
				if (response.status === 404) {
					return null;
				}
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			return data.threadId || null;
		} catch (error) {
			console.error("Failed to get current thread ID from remote API:", error);
			return null;
		}
	}

	async setCurrentThreadId(threadId: string | null): Promise<void> {
		try {
			const response = await fetch(
				`${this.config.baseUrl}/threads/current`,
				{
					method: "PUT",
					headers: this.getHeaders(),
					body: JSON.stringify({ threadId }),
				},
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (error) {
			console.error(
				"Failed to save current thread ID to remote API:",
				error,
			);
			throw error;
		}
	}

	// Message operations

	async listMessages(
		threadId: string,
		options?: ListMessagesOptions,
	): Promise<MessagePage> {
		try {
			const params = new URLSearchParams();
			if (options?.cursor) params.set("cursor", options.cursor);
			if (options?.limit) params.set("limit", options.limit.toString());
			if (options?.direction) params.set("direction", options.direction);

			const url = `${this.config.baseUrl}/threads/${threadId}/messages?${params}`;
			const response = await fetch(url, {
				method: "GET",
				headers: this.getHeaders(),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Failed to load messages from remote API:", error);
			return {
				messages: [],
				nextCursor: undefined,
				hasMore: false,
			};
		}
	}

	async appendMessage(threadId: string, message: Message): Promise<void> {
		try {
			const response = await fetch(
				`${this.config.baseUrl}/threads/${threadId}/messages`,
				{
					method: "POST",
					headers: this.getHeaders(),
					body: JSON.stringify(message),
				},
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (error) {
			console.error("Failed to append message to remote API:", error);
			throw error;
		}
	}

	async deleteThreadMessages(threadId: string): Promise<void> {
		try {
			const response = await fetch(
				`${this.config.baseUrl}/threads/${threadId}/messages`,
				{
					method: "DELETE",
					headers: this.getHeaders(),
				},
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (error) {
			console.error("Failed to delete thread messages from remote API:", error);
			throw error;
		}
	}

	// Helper methods

	private getHeaders(): HeadersInit {
		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		if (this.config.apiKey) {
			headers["Authorization"] = `Bearer ${this.config.apiKey}`;
		}

		return headers;
	}
}
