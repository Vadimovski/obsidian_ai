import { MarkdownView, Notice } from "obsidian";
import TextProcessingPlugin from "#/main";
import { topicsRequest, summarizeRequest } from "#/helpers/requestHandlers";
import {
	get_block,
	last_topic_division,
	divideTextByHeadings,
	getFirstNWords,
	countWords,
	insertTopic, removeTopic, findPropertiesEnd
} from "#/helpers/textProcessing";
import { topicProcessingLog, summarizationLog } from "#/helpers/logger";
import {resolve} from "path";


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
		// Find the end of the properties block
		const start_line = findPropertiesEnd(text_to_process);
		// Remove the properties block
		text_to_process = text_to_process.split('\n').slice(start_line).join('\n');

		let processed_topics_text = '';
		let iteration = 1;
		let previous_iteration_overlap = '';

		// Loop through text chunks until all topics are processed
		// eslint-disable-next-line no-constant-condition
		while (true) {
			text_to_process = previous_iteration_overlap + ' ' +text_to_process;
			const [block, enumeratedBlock, remainingText] = get_block(text_to_process, chunk_limit);

			if (!block) {
				console.error('Error generating topics. No text to process.');
			}

			if (block.trim() == previous_iteration_overlap.trim()) {
				new Notice('Failed to create topics. Please divide the text into sentences and try again.');
				console.error('Loop found. The chunk to process is the same as the previous iteration overlap.');
				console.error('Chunk:', block);
				console.error('Previous iteration overlap:', previous_iteration_overlap);
				return;
			}

			// Find topics. Retry up to 3 times
			let retries = 0;
			let current_processed_topic = '';
			while (current_processed_topic.length === 0) {
				// Fetch topics for the current block of text
				const current_topics = await topicsRequest(enumeratedBlock, plugin);

				// If topics are not found, break the loop
				if (!current_topics) {
					new Notice('Failed to process topics');
					return;
				}

				// Add the topics to the block of text
				current_processed_topic = insertTopic(enumeratedBlock, current_topics);

				// If topics are not found, probably due to wrong gpt response, retry
				if (current_processed_topic.length === 0) {
					retries++;
				}

				// If retries are exceeded, break the loop
				if (retries > 3) {
					new Notice('Failed to process topics');
					return;
				}
			}

			// Divide the text into sections before and after the last identified topic
			const [before_last_topic, after_last_topic] = last_topic_division(current_processed_topic);
			processed_topics_text += before_last_topic;

			// Log the topic processing if debug mode is enabled
			if (plugin.settings.debug) {
				// @ts-ignore
				const log_directory = resolve(plugin.app.vault.getRoot().vault.adapter.basePath, plugin.app.vault.configDir, 'logs')
				await topicProcessingLog(log_directory, block, current_processed_topic, iteration);
			}

			// If there is no remaining text, exit the loop
			if (!remainingText) {
				processed_topics_text += '\n' +after_last_topic.slice(0,-3);
				break;
			}

			// Update text to process for the next iteration
			previous_iteration_overlap = removeTopic(after_last_topic)
			text_to_process = remainingText;
			iteration++;
		}

		// Replace the original text in the editor with the processed topics text
		view.editor.replaceRange(processed_topics_text, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
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
		let text_to_process = view.editor.getRange({ line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
		// Find the end of the properties block
		const start_line = findPropertiesEnd(text_to_process);
		// Remove the properties block
		text_to_process = text_to_process.split('\n').slice(start_line).join('\n');

		let [contents, contents_len] = divideTextByHeadings(text_to_process);
		let iteration = 0;
		let summary = '';

		// Continue summarizing until a summary is generated
		while (!summary) {
			const texts_to_summarize = [''];
			const texts_len = [0];
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
					new Notice('Failed to summarize');
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
				// @ts-ignore
				const log_directory = resolve(plugin.app.vault.getRoot().vault.adapter.basePath, plugin.app.vault.configDir, 'logs')
				await summarizationLog(log_directory, texts_to_summarize, contents, iteration);
			}
		}

		// Insert the summary at the beginning of the document
		const first_line = view.editor.getLine(start_line);

		view.editor.replaceRange("~~~ Summary\n" + summary + "\n~~~\n" + first_line, { line: start_line, ch: 0 }, { line: start_line, ch: first_line.length });
	} else {
		new Notice('No active markdown view');
	}
}
