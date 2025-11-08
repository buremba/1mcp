import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { SyntaxHighlighter } from "./syntax-highlighter";
import { MermaidDiagram } from "./mermaid-diagram";

export interface MarkdownContentProps {
	content: string;
	className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
	const components: Components = {
		// Headings
		h1: ({ children, ...props }) => (
			<h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0" {...props}>
				{children}
			</h1>
		),
		h2: ({ children, ...props }) => (
			<h2 className="text-xl font-semibold mt-5 mb-3" {...props}>
				{children}
			</h2>
		),
		h3: ({ children, ...props }) => (
			<h3 className="text-lg font-semibold mt-4 mb-2" {...props}>
				{children}
			</h3>
		),

		// Paragraphs and text
		p: ({ children, ...props }) => (
			<p className="mb-3 leading-relaxed" {...props}>
				{children}
			</p>
		),

		// Lists
		ul: ({ children, ...props }) => (
			<ul className="list-disc list-outside ml-6 mb-3 space-y-1" {...props}>
				{children}
			</ul>
		),
		ol: ({ children, ...props }) => (
			<ol className="list-decimal list-outside ml-6 mb-3 space-y-1" {...props}>
				{children}
			</ol>
		),
		li: ({ children, ...props }) => (
			<li className="leading-relaxed" {...props}>
				{children}
			</li>
		),

		// Inline code
		code: ({ className, children, node, ...props }) => {
			const match = /language-(\w+)/.exec(className || "");
			const language = match ? match[1] : undefined;
			const code = String(children).replace(/\n$/, "");

			// Check if it's a code block (has a node parent)
			const isCodeBlock = node && node.position;

			// Handle mermaid diagrams
			if (isCodeBlock && language === "mermaid") {
				return <MermaidDiagram code={code} className="my-4" />;
			}

			// Handle code blocks with syntax highlighting
			if (isCodeBlock && language) {
				return (
					<div className="my-4">
						<SyntaxHighlighter language={language} code={code} />
					</div>
				);
			}

			// Inline code
			return (
				<code
					className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono"
					{...props}
				>
					{children}
				</code>
			);
		},

		// Blockquotes
		blockquote: ({ children, ...props }) => (
			<blockquote
				className="border-l-4 border-muted-foreground/30 pl-4 my-4 italic text-muted-foreground"
				{...props}
			>
				{children}
			</blockquote>
		),

		// Links
		a: ({ children, href, ...props }) => (
			<a
				href={href}
				className="text-primary hover:underline"
				target="_blank"
				rel="noopener noreferrer"
				{...props}
			>
				{children}
			</a>
		),

		// Tables
		table: ({ children, ...props }) => (
			<div className="my-4 overflow-x-auto">
				<table className="min-w-full divide-y divide-border" {...props}>
					{children}
				</table>
			</div>
		),
		thead: ({ children, ...props }) => (
			<thead className="bg-muted" {...props}>
				{children}
			</thead>
		),
		tbody: ({ children, ...props }) => (
			<tbody className="divide-y divide-border" {...props}>
				{children}
			</tbody>
		),
		tr: ({ children, ...props }) => (
			<tr {...props}>{children}</tr>
		),
		th: ({ children, ...props }) => (
			<th
				className="px-4 py-2 text-left text-sm font-semibold"
				{...props}
			>
				{children}
			</th>
		),
		td: ({ children, ...props }) => (
			<td className="px-4 py-2 text-sm" {...props}>
				{children}
			</td>
		),

		// Horizontal rule
		hr: (props) => <hr className="my-6 border-t border-border" {...props} />,

		// Images
		img: ({ alt, src, ...props }) => (
			<img
				src={src}
				alt={alt}
				className="max-w-full h-auto rounded my-4"
				{...props}
			/>
		),
	};

	return (
		<div className={`markdown-content ${className || ""}`}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={components}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
