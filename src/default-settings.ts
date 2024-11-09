export interface pluginSettings {
	api_key: string;
	summarize: boolean;
	split: boolean;
	debug: boolean;
	model: string;
	[key: string]: any;
}

export const DEFAULT_SETTINGS: pluginSettings = {
	api_key: '',
	summarize: false,
	split: false,
	debug: false,
	model: 'gpt-4o-mini',
}
