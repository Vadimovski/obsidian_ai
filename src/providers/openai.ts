import OpenAI from 'openai';
import TextProcessingPlugin from "#/main";

// Function to send a prompt and get the response from the OpenAI API
export async function getChatGPTResponse(prompt: string, plugin: TextProcessingPlugin) {
	// Retrieve the API key from the plugin settings
	const api_key = plugin.settings.api_key;

	// Raise an error if the API key is not found
	if (!api_key) {
		throw new Error('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
	}

	// Create an OpenAI client instance
	const openai_client = new OpenAI({ apiKey: api_key, dangerouslyAllowBrowser: true });

	// Raise an error if the prompt is empty
	if (!prompt) {
		throw new Error('Prompt is empty');
	}

	try {
		// Send the prompt to OpenAI and await the response
		return await openai_client.chat.completions.create({
			messages: [
				{role: 'system', content: 'You are a helpful assistant.'},
				{role: 'user', content: prompt},
			],
			model: 'gpt-4o-mini', // Specify the model to use
		}); // Return the OpenAI response
	} catch (error) {
		console.error("Error with OpenAI API request:", error);
		throw new Error('Failed to get response from OpenAI API');
	}
}
