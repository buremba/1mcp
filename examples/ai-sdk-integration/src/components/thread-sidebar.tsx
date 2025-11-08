import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import type { Thread } from "../hooks/use-thread-storage";
import { cn } from "../lib/utils";

interface ThreadSidebarProps {
	threads: Thread[];
	currentThreadId: string | null;
	onSelectThread: (id: string) => void;
	onCreateThread: () => void;
	onDeleteThread: (id: string) => void;
}

export function ThreadSidebar({
	threads,
	currentThreadId,
	onSelectThread,
	onCreateThread,
	onDeleteThread,
}: ThreadSidebarProps) {
	return (
		<div className="w-64 border-r bg-background flex flex-col h-full">
			{/* Logo/Branding */}
			<div className="px-4 py-3 border-b flex items-center">
				<div className="flex items-center gap-2 text-base font-semibold h-10">
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
					>
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
					<span>relay-mcp</span>
				</div>
			</div>

			{/* New Thread Button */}
			<div className="p-3">
				<button
					onClick={onCreateThread}
					className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent rounded-lg transition-colors cursor-pointer"
				>
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
					>
						<path d="M12 5v14M5 12h14" />
					</svg>
					New Thread
				</button>
			</div>

			{/* Thread List */}
			<ScrollArea className="flex-1">
				<div className="px-2 space-y-1">
					{threads.length === 0 ? (
						<div className="text-center text-sm text-muted-foreground p-4">
						</div>
					) : (
						threads.map((thread) => (
							<div
								key={thread.id}
								className={cn(
									"flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent rounded-lg transition-colors group",
									currentThreadId === thread.id && "bg-accent"
								)}
								onClick={() => onSelectThread(thread.id)}
							>
								<div className="flex-1 min-w-0">
									<div className="text-sm truncate">
										{thread.title}
									</div>
								</div>
								<button
									className="p-1 opacity-0 group-hover:opacity-100 hover:bg-background rounded transition-opacity cursor-pointer"
									onClick={(e) => {
										e.stopPropagation();
										onDeleteThread(thread.id);
									}}
									aria-label="Delete thread"
								>
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
									>
										<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
									</svg>
								</button>
							</div>
						))
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
