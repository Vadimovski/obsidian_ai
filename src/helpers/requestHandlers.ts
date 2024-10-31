import TextProcessingPlugin from "#/main";
import { getChatGPTResponse } from "#/providers/openai";
import { Notice } from "obsidian";

// Prompt for dividing text into general topics
const topics_prompt =
`Divide the text into topics.

Topic Naming:
- Use broad, descriptive titles that capture the essence of each thematic cluster.
- Avoid specificity; instead, opt for names that could encompass several of the original topics listed in your current output.

Note:
- The topic name will be put before the sentence number. Do not create a topic for each sentence. The topic should summarize the paragraph.
- You should generate at least one topic and no more than five.

Keep in Mind:
- What are the primary subject matter domains covered by the text?
- How do the various detailed topics cluster together thematically?
- What high-level narrative or conceptual threads weave through the text?
- Topic name should be written on the language of the text.

Output format:
In each row, put the sentence number where the topic starts, colon and the topic name.
Sentence number where the topic starts: Topic name

Output example:
1: Cars
15: Planes
23: Ships
etc.
`;

// Prompt for creating a summary of the text
const summarize_prompt =
	`I have the text, and I would like you to create a short summary of the text. 
The summary should include only a plain text. Remove all the headings\n`;

// Function to request topic extraction from OpenAI
export async function topicsRequest(text: string, plugin: TextProcessingPlugin): Promise<string | null> {
	try {
		// Send the combined prompt and text to get a response from OpenAI
		const response = await getChatGPTResponse(topics_prompt, text, plugin);

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
		// FIXME
		const response = await getChatGPTResponse(summarize_prompt,  text, plugin);

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
