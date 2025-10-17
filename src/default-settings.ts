export interface pluginSettings {
	api_key: string;
	summarize: boolean;
	split: boolean;
    punctuate: boolean;
	debug: boolean;
	model: string;
	provider: 'openai' | 'ollama';
	ollama_base_url: string;
	log_directory: string;
	[key: string]: any;
}

export const DEFAULT_SETTINGS: pluginSettings = {
	api_key: '',
	summarize: false,
	split: false,
    punctuate: true,
	debug: false,
	model: 'gpt-4o-mini',
	provider: 'openai',
	ollama_base_url: 'http://localhost:11434',
	log_directory: 'file-handler_logs',
}
