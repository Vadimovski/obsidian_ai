declare module 'openai' {
	// Minimal type to satisfy import during type-check; runtime uses bundled code
	export default class OpenAI {
		constructor(config: { apiKey?: string; dangerouslyAllowBrowser?: boolean });
		chat: {
			completions: {
				create(input: {
					messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
					model: string;
					temperature?: number;
					top_p?: number;
					[key: string]: any;
				}): Promise<{ choices: Array<{ message: { content: string } }> }>;
			};
		};
	}
}


