export interface MyPluginSettings {
	api_key: string;
	summarize: boolean;
	split: boolean;
	debug: boolean;
	model: string;
	[key: string]: any;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	api_key: '',
	summarize: false,
	split: false,
	debug: false,
	model: 'gpt-4o-mini',
}
