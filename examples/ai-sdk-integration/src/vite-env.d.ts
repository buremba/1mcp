/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_AI_PROVIDER?: string;
	readonly VITE_OPENAI_API_KEY?: string;
	readonly VITE_OPENAI_MODEL?: string;
	readonly VITE_ANTHROPIC_API_KEY?: string;
	readonly VITE_ANTHROPIC_MODEL?: string;
	readonly VITE_RELAY_SERVER_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
