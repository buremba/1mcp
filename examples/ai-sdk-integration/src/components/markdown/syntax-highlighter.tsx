import { useEffect, useState } from "react";
import { useShikiHighlighter } from "react-shiki";

export interface SyntaxHighlighterProps {
	language?: string;
	code: string;
	className?: string;
}

export function SyntaxHighlighter({
	language,
	code,
	className,
}: SyntaxHighlighterProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const highlighted = useShikiHighlighter(
		code,
		language || "text",
		{
			light: "github-light",
			dark: "github-dark",
		}
	);

	if (!mounted || !highlighted) {
		// Fallback to plain code block during SSR or initial render
		return (
			<pre className={`${className || ""} block p-4 rounded bg-muted overflow-x-auto`}>
				<code>{code}</code>
			</pre>
		);
	}

	return (
		<div
			className={`${className || ""} text-sm rounded p-4 overflow-x-auto`}
			dangerouslySetInnerHTML={{ __html: highlighted }}
		/>
	);
}
