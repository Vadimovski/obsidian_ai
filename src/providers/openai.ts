import OpenAI from 'openai';
import TextProcessingPlugin from "#/main";

// Function to send a prompt and get the response from the OpenAI API
export async function getChatGPTResponse(system_prompt: string, user_prompt: string, plugin: TextProcessingPlugin, opts?: { temperature?: number; top_p?: number; }): Promise<string> {
	// Retrieve the API key from the plugin settings
	const api_key = plugin.settings.api_key;

	// Raise an error if the API key is not found
	if (!api_key) {
		throw new Error('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
	}

	// Create an OpenAI client instance
	const openai_client = new OpenAI({ apiKey: api_key, dangerouslyAllowBrowser: true });

    try {
		// Send the prompt to OpenAI and await the response
		const completion = await openai_client.chat.completions.create({
			messages: [
				{role: 'system', content: system_prompt},
				{role: 'user', content: user_prompt},
			],
			model: plugin.settings.model, // Specify the model to use
            temperature: opts?.temperature ?? 0.1,
            top_p: opts?.top_p ?? 0.7,
		});
		return completion.choices?.[0]?.message?.content ?? '';
	} catch (error) {
		console.error("Error with OpenAI API request:", error);
		throw new Error('Failed to get response from OpenAI API');
	}
}
