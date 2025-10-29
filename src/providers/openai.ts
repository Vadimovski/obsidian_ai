import { requestUrl } from 'obsidian';
import TextProcessingPlugin from "#/main";

// Function to send a prompt and get the response from the OpenAI API
export async function getChatGPTResponse(system_prompt: string, user_prompt: string, plugin: TextProcessingPlugin, opts?: { temperature?: number; top_p?: number; }): Promise<string> {
	// Retrieve the API key from the plugin settings
	const api_key = plugin.settings.api_key;

	// Raise an error if the API key is not found
	if (!api_key) {
		throw new Error('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
	}

	try {
		// Prepare the request body
		const requestBody = {
			model: plugin.settings.model,
			messages: [
				{ role: 'system', content: system_prompt },
				{ role: 'user', content: user_prompt },
			],
			temperature: opts?.temperature ?? 0.1,
			top_p: opts?.top_p ?? 0.7,
		};

		console.log('[openai] Sending request to OpenAI API, model:', plugin.settings.model);

		// Use Obsidian's requestUrl to bypass CORS
		const response = await requestUrl({
			url: 'https://api.openai.com/v1/chat/completions',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${api_key}`,
			},
			body: JSON.stringify(requestBody),
		});

		console.log('[openai] Response status:', response.status);

		// Parse the response
		if (response.status !== 200) {
			console.error('[openai] Error response:', response.text);
			throw new Error(`OpenAI API error: ${response.status} ${response.text}`);
		}

		const data = response.json;
		const content = data.choices?.[0]?.message?.content ?? '';
		
		console.log('[openai] Response received, length:', content.length);
		return content;
	} catch (error) {
		console.error('[openai] Error with OpenAI API request:', error);
		throw new Error('Failed to get response from OpenAI API');
	}
}
