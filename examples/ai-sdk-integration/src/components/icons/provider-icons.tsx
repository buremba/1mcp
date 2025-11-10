/**
 * Provider icon components
 */

interface IconProps {
	className?: string;
	size?: number;
}

export function ChromeAIIcon({ className = "", size = 16 }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			{/* Chrome logo inspired design */}
			<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
			<circle cx="12" cy="12" r="4" fill="currentColor" />
			<path
				d="M12 2 L12 8"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			<path
				d="M5 8 L9 13"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			<path
				d="M19 8 L15 13"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function OpenAIIcon({ className = "", size = 16 }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			{/* OpenAI-inspired geometric design */}
			<path
				d="M12 2L4 7v10l8 5 8-5V7l-8-5z"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			<path
				d="M12 7v10M7 9.5l10 5M7 14.5l10-5"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
		</svg>
	);
}

export function AnthropicIcon({ className = "", size = 16 }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			{/* Anthropic "A" inspired design */}
			<path
				d="M12 4L6 20M18 20L12 4M8 14h8"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function GenericModelIcon({ className = "", size = 16 }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			{/* Generic AI/brain icon */}
			<circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
			<path d="M12 1v6m0 6v6" stroke="currentColor" strokeWidth="2" />
			<path
				d="m4.93 4.93 4.24 4.24m5.66 5.66 4.24 4.24"
				stroke="currentColor"
				strokeWidth="2"
			/>
			<path
				d="m19.07 4.93-4.24 4.24m-5.66 5.66-4.24 4.24"
				stroke="currentColor"
				strokeWidth="2"
			/>
		</svg>
	);
}

/**
 * Get icon component for a provider
 */
export function getProviderIcon(provider: string) {
	switch (provider) {
		case "chrome":
			return ChromeAIIcon;
		case "openai":
			return OpenAIIcon;
		case "anthropic":
			return AnthropicIcon;
		default:
			return GenericModelIcon;
	}
}
