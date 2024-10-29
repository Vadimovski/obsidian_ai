import { MarkdownView, Notice } from "obsidian";
import TextProcessingPlugin from "#/main";
import { topicsRequest, summarizeRequest } from "#/helpers/requestHandlers";
import { get_block, last_topic_division, divideTextByHeadings, getFirstNWords, countWords } from "#/helpers/textProcessing";
import { topicProcessingLog, summarizationLog } from "#/helpers/logger";


// Function to divide text by topics
export async function divide_by_topics(plugin: TextProcessingPlugin) {
	const chunk_limit = 1000;

	// Check if api key is set
	if (!plugin.settings.api_key) {
		new Notice('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
		return;
	}

	// Get the active markdown view
	const view = this.app.workspace.getActiveViewOfType(MarkdownView);

	// Check if there is an active markdown view
	if (view) {
		let text_to_process = view.editor.getRange({ line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
		let processed_topics_text = '';
		let iteration = 1;

		// Loop through text chunks until all topics are processed
		while (true) {
			let [firstBlock, remainingText] = get_block(text_to_process, chunk_limit);

			// Fetch topics for the current block of text
			const current_processed_topics = await topicsRequest(firstBlock, plugin);
			if (!current_processed_topics) {
				new Notice('Failed to process topics');
				return;
			}

			// Divide the text into sections before and after the last identified topic
			let [before_last_topic, after_last_topic] = last_topic_division(current_processed_topics);
			processed_topics_text += before_last_topic;

			// Log the topic processing if debug mode is enabled
			if (plugin.settings.debug) {
				await topicProcessingLog(firstBlock, current_processed_topics, iteration);
			}

			// If there is no remaining text, exit the loop
			if (!remainingText) {
				break;
			}

			// Update text to process for the next iteration
			text_to_process = after_last_topic + remainingText;
			iteration++;
		}

		// Replace the original text in the editor with the processed topics text
		view.editor.replaceRange(processed_topics_text, { line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
	} else {
		new Notice('No active markdown view');
	}
}


// Function to summarize text
export async function summarize(plugin: TextProcessingPlugin) {
	const chunk_limit = 2000;

	// Check if api key is set
	if (!plugin.settings.api_key) {
		new Notice('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
		return;
	}

	// Get the active markdown view
	const view = this.app.workspace.getActiveViewOfType(MarkdownView);

	// Check if there is an active markdown view
	if (view) {
		let text = view.editor.getRange({ line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
		let [contents, contents_len] = divideTextByHeadings(text);
		let iteration = 0;
		let summary = '';

		// Continue summarizing until a summary is generated
		while (!summary) {
			let texts_to_summarize = [''];
			let texts_len = [0];
			let id_texts_to_push = 0;

			// Chunk the text content based on the chunk limit
			for (let i = 0; i < contents.length; i++) {
				// Trim contents if it exceeds the chunk limit
				if (contents_len[i] > chunk_limit) {
					contents[i] = getFirstNWords(contents[i], chunk_limit);
					contents_len[i] = chunk_limit;
				}

				// Start a new chunk if adding more content exceeds the chunk limit
				if (texts_len[id_texts_to_push] + contents_len[i] > chunk_limit) {
					id_texts_to_push++;
					texts_to_summarize[id_texts_to_push] = '';
					texts_len[id_texts_to_push] = 0;
				}

				// Add content to the current chunk
				texts_to_summarize[id_texts_to_push] += contents[i] + '\n';
				texts_len[id_texts_to_push] += contents_len[i];
			}

			// Reset content arrays for the next iteration
			[contents, contents_len] = [[], []];

			// Summarize each chunk
			for (let i = 0; i < texts_to_summarize.length; i++) {
				const summarized_text = await summarizeRequest(texts_to_summarize[i], plugin);

				// Handle summarization failure
				if (!summarized_text) {
					new Notice('Failed to process topics');
					return;
				}

				// Add summarized text to contents and update the word count
				contents.push(summarized_text);
				contents_len.push(countWords(summarized_text));

				// If there's only one chunk, finalize the summary
				if (texts_to_summarize.length === 1) {
					summary = summarized_text;
				}
			}
			iteration++;

			// Log the summarization process if debug mode is enabled
			if (plugin.settings.debug) {
				await summarizationLog(texts_to_summarize, contents, iteration);
			}
		}

		// Insert the summary at the beginning of the document
		const first_line = view.editor.getLine(0);
		view.editor.replaceRange("~~~ Summary\n" + summary + "\n~~~\n" + first_line, { line: 0, ch: 0 }, { line: 0, ch: first_line.length });
	} else {
		new Notice('No active markdown view');
	}
}
