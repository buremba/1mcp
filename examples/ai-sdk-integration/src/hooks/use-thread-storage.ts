import { useEffect, useState } from "react";

export interface Thread {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
}

const STORAGE_KEY = "chrome-assistant-threads";
const CURRENT_THREAD_KEY = "chrome-assistant-current-thread";

export function useThreadStorage() {
	const [threads, setThreads] = useState<Thread[]>(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	});

	const [currentThreadId, setCurrentThreadId] = useState<string | null>(() => {
		return localStorage.getItem(CURRENT_THREAD_KEY);
	});

	// Save threads to localStorage whenever they change
	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
		} catch (error) {
			console.error("Failed to save threads:", error);
		}
	}, [threads]);

	// Save current thread ID to localStorage whenever it changes
	useEffect(() => {
		try {
			if (currentThreadId) {
				localStorage.setItem(CURRENT_THREAD_KEY, currentThreadId);
			} else {
				localStorage.removeItem(CURRENT_THREAD_KEY);
			}
		} catch (error) {
			console.error("Failed to save current thread:", error);
		}
	}, [currentThreadId]);

	const createThread = (title: string) => {
		const now = Date.now();
		const newThread: Thread = {
			id: crypto.randomUUID(),
			title,
			createdAt: now,
			updatedAt: now,
		};

		setThreads((prev) => [newThread, ...prev]);
		setCurrentThreadId(newThread.id);

		return newThread;
	};

	const updateThread = (id: string, updates: Partial<Omit<Thread, "id" | "createdAt">>) => {
		setThreads((prev) =>
			prev.map((thread) =>
				thread.id === id
					? { ...thread, ...updates, updatedAt: Date.now() }
					: thread
			)
		);
	};

	const deleteThread = (id: string) => {
		setThreads((prev) => prev.filter((thread) => thread.id !== id));
		if (currentThreadId === id) {
			setCurrentThreadId(null);
		}
	};

	const selectThread = (id: string) => {
		setCurrentThreadId(id);
	};

	const currentThread = threads.find((t) => t.id === currentThreadId) || null;

	return {
		threads,
		currentThread,
		currentThreadId,
		createThread,
		updateThread,
		deleteThread,
		selectThread,
	};
}
