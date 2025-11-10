import { useEffect, useState } from "react";
import type {
	Thread,
	IThreadStorage,
	MessagePage,
} from "../storage/thread-storage.interface";
import type { Message } from "./use-assistant";

export function useThreadStorage(storage: IThreadStorage) {
	const [threads, setThreads] = useState<Thread[]>([]);
	const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
	const [isInitialized, setIsInitialized] = useState(false);

	// Load initial data from storage
	useEffect(() => {
		const loadInitialData = async () => {
			const [loadedThreads, loadedThreadId] = await Promise.all([
				storage.listThreads(),
				storage.getCurrentThreadId(),
			]);

			setThreads(loadedThreads);
			setCurrentThreadId(loadedThreadId);
			setIsInitialized(true);
		};

		loadInitialData();
	}, [storage]);

	// Create a new thread
	const createThread = async (
		title: string,
		modelId: string,
	): Promise<Thread> => {
		const newThread = await storage.createThread({
			title,
			modelId,
		});

		// Update local state
		setThreads((prev) => [newThread, ...prev]);
		setCurrentThreadId(newThread.id);

		return newThread;
	};

	// Update thread metadata
	const updateThread = async (
		id: string,
		updates: Partial<Pick<Thread, "title" | "modelId">>,
	): Promise<void> => {
		await storage.updateThread(id, updates);

		// Update local state
		setThreads((prev) =>
			prev.map((thread) =>
				thread.id === id
					? { ...thread, ...updates, updatedAt: Date.now() }
					: thread,
			),
		);
	};

	// Delete a thread
	const deleteThread = async (id: string): Promise<void> => {
		await storage.deleteThread(id);

		// Update local state
		setThreads((prev) => prev.filter((thread) => thread.id !== id));

		// Clear current thread if deleted
		if (currentThreadId === id) {
			setCurrentThreadId(null);
		}
	};

	// Select a thread
	const selectThread = async (id: string): Promise<void> => {
		await storage.setCurrentThreadId(id);
		setCurrentThreadId(id);
	};

	// Load messages for a thread (with pagination)
	const loadMessages = async (
		threadId: string,
		options?: {
			cursor?: string;
			limit?: number;
			direction?: "before" | "after";
		},
	): Promise<MessagePage> => {
		return await storage.listMessages(threadId, options);
	};

	// Save a message to a thread
	const saveMessage = async (
		threadId: string,
		message: Message,
	): Promise<void> => {
		await storage.appendMessage(threadId, message);
	};

	// Save multiple messages (batch)
	const saveMessages = async (
		threadId: string,
		messages: Message[],
	): Promise<void> => {
		// Append messages one by one (some storage backends may support batch)
		for (const message of messages) {
			await storage.appendMessage(threadId, message);
		}
	};

	const currentThread = threads.find((t) => t.id === currentThreadId) || null;

	return {
		// State
		threads,
		currentThread,
		currentThreadId,
		isInitialized,

		// Thread operations
		createThread,
		updateThread,
		deleteThread,
		selectThread,

		// Message operations
		loadMessages,
		saveMessage,
		saveMessages,
	};
}
