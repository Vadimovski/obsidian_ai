import TextProcessingPlugin from "#/main";
import { getChatGPTResponse } from "#/providers/openai";
import { Notice } from "obsidian";

// Prompt for dividing text into general topics
const topics_prompt =
`I have a text, and I would like you to divide this text into high-level, abstract topics that summarize multiple sections or paragraphs. Focus on the key ideas and general themes rather than specific details or individual points made in each paragraph. The topics should provide a bird's-eye view of the text's content.
For each section of the text, identify the main topic and present the text under corresponding headings. 
Use the following format: 
## Topic 
 
Part of the original text 
## Topic 
 
Part of the original text 
 
And so on. 
Each topic should be on its own line. You should put ## before each topic. Each topic should describe the meaning of the text below. Each topic should be written on the language of the original text.
If there are topics already, do not duplicate them.
Do not change the original text. Do not add any additional text. Do not change the sequence of the original text. The text is as follows:`;

// Prompt for creating a summary of the text
const summarize_prompt =
	`I have the text, and I would like you to create a short summary of the text. 
The summary should include only a plain text. Remove all headings. The text is as follows:\n`;

// Function to request topic extraction from OpenAI
export async function topicsRequest(text: string, plugin: TextProcessingPlugin): Promise<string | null> {
	try {
		// Send the combined prompt and text to get a response from OpenAI
		const response = await getChatGPTResponse(topics_prompt + text, plugin);

		return response.choices[0].message.content;
	} catch (error) {
		console.error("Error in topicsRequest:", error);
		new Notice('Error generating topics');
		return null;
	}
}

// Function to request a summary from OpenAI
export async function summarizeRequest(text: string, plugin: TextProcessingPlugin): Promise<string | null> {
	try {
		// Get response from OpenAI by sending the prompt and the text
		const response = await getChatGPTResponse(summarize_prompt + text, plugin);

		// Check if the response and choices are valid
		if (response && response.choices && response.choices.length > 0) {
			// Return the summarized text from the response
			return response.choices[0].message.content;
		} else {
			console.error("Invalid response structure:", response);
			new Notice('Invalid response structure from OpenAI API');
			return null;
		}
	} catch (error) {
		console.error("Error in summarizeRequest:", error);
		new Notice('Error generating summary');
		return null;
	}
}
