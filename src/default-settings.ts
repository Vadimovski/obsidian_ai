export interface pluginSettings {
	api_key: string;
	summarize: boolean;
	split: boolean;
	    punctuate: boolean;
	    cosmetic: boolean;
	backup: boolean;
	model: string;
	provider: 'openai' | 'ollama';
	ollama_base_url: string;
	language?: 'en' | 'zh-CN' | 'es' | 'pt' | 'fr' | 'de' | 'ru' | 'ja';
	// Punctuation options
	punctuatePreserveHeadings?: boolean; // Preserve Markdown headings (#) during punctuation stripping
	punctuateChunkSize?: number; // Chunk size for punctuate feature
	splitChunkSize?: number; // Chunk size for split feature (in characters)
	cosmeticChunkSize?: number; // Chunk size for cosmetic feature (in characters)
	summarizeChunkSize?: number; // Chunk size for summarize feature (in characters)
	customPrompts?: {
		punctuate?: string;
		split?: string;
		summarize?: string;
		cosmetic?: string;
	};
	cosmeticDictionary?: Array<{ key: string; value: string }>;
	[key: string]: any;
}

export const DEFAULT_SETTINGS: pluginSettings = {
	api_key: '',
	summarize: false,
	split: false,
	    punctuate: true,
	    cosmetic: false,
	backup: true,
	model: 'gpt-4o-mini',
	provider: 'openai',
	ollama_base_url: 'http://localhost:11434',
	language: 'en',
	punctuatePreserveHeadings: true,
	punctuateChunkSize: 1000,
	splitChunkSize: 1000,
	cosmeticChunkSize: 1000,
	summarizeChunkSize: 5000,
	customPrompts: {},
	cosmeticDictionary: [],
}
