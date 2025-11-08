import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

// Initialize mermaid with configuration
mermaid.initialize({
	startOnLoad: false,
	theme: "default",
	securityLevel: "loose",
	fontFamily: "inherit",
});

export interface MermaidDiagramProps {
	code: string;
	className?: string;
}

export function MermaidDiagram({ code, className }: MermaidDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [svg, setSvg] = useState<string>("");
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const renderDiagram = async () => {
			if (!code || !containerRef.current) return;

			try {
				// Generate unique ID for the diagram
				const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

				// Render the diagram
				const { svg: renderedSvg } = await mermaid.render(id, code);
				setSvg(renderedSvg);
				setError("");
			} catch (err) {
				console.error("Mermaid rendering error:", err);
				setError(err instanceof Error ? err.message : "Failed to render diagram");
			}
		};

		renderDiagram();
	}, [code]);

	if (error) {
		return (
			<div className={`${className || ""} p-4 rounded bg-red-50 text-red-700 border border-red-200`}>
				<p className="font-semibold">Mermaid Diagram Error:</p>
				<pre className="mt-2 text-sm whitespace-pre-wrap">{error}</pre>
			</div>
		);
	}

	if (!svg) {
		return (
			<div className={`${className || ""} p-4 rounded bg-muted animate-pulse`}>
				<div className="h-32 bg-muted-foreground/10 rounded" />
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={`${className || ""} mermaid-diagram flex items-center justify-center p-4 rounded bg-muted overflow-auto`}
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	);
}
