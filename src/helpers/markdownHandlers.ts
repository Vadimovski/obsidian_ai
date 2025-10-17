import { MarkdownView, Notice } from "obsidian";
import TextProcessingPlugin from "#/main";
import { topicsRequest, summarizeRequest } from "#/helpers/requestHandlers";
import {
	get_block,
	last_topic_division,
	divideTextByHeadings,
	getFirstNWords,
	countWords,
	insertTopic, removeTopic, findPropertiesEnd,
	removePunctuation,
	removePunctuationPreservingWords,
	getLastWord,
	findLastSentenceEnd,
	findLastSentenceEndWithEllipsis,
	findPreviousSentenceEnd,
	getContextAround,
	getFirstNCharacters,
	findNextWordBoundary,
	findPreviousWordBoundary,
	findPositionInOriginalText,
	findOriginalChunkLength
} from "#/helpers/textProcessing";
import { topicProcessingLog, summarizationLog } from "#/helpers/logger";
import {resolve} from "path";


// Function to divide text by topics
export async function divide_by_topics(plugin: TextProcessingPlugin) {
	

	// For OpenAI provider, ensure API key set
	if (plugin.settings.provider === 'openai' && !plugin.settings.api_key) {
		new Notice('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
		return;
	}

	// Get the active markdown view
	const view = this.app.workspace.getActiveViewOfType(MarkdownView);

	// Check if there is an active markdown view
	if (view) {
		// Get the full text from the editor
		const full_text = view.editor.getRange({ line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
		const start_line = findPropertiesEnd(full_text);
		const prefix = full_text.split('\n').slice(0, start_line).join('\n');
		let text_to_process = full_text.split('\n').slice(start_line).join('\n');

		// Process the text in blocks
		let processed_topics_text = '';
		let previous_iteration_overlap = '';
		let iteration = 0;

		// eslint-disable-next-line no-constant-condition
		while (true) {
			text_to_process = previous_iteration_overlap + ' ' +text_to_process;
			const [block, enumeratedBlock, remainingText] = get_block(text_to_process, 200);

			// If no more text to process, break
			if (!block) {
				break;
			}

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
				const vaultRoot = plugin.app.vault.getRoot().vault.adapter.basePath;
				const log_directory = resolve(vaultRoot, plugin.settings.log_directory);
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

	// For OpenAI provider, ensure API key set
	if (plugin.settings.provider === 'openai' && !plugin.settings.api_key) {
		new Notice('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
		return;
	}

	// Get the active markdown view
	const view = this.app.workspace.getActiveViewOfType(MarkdownView);

	// Check if there is an active markdown view
	if (view) {
		// Get the full text from the editor
		const full_text = view.editor.getRange({ line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
		const start_line = findPropertiesEnd(full_text);
		const prefix = full_text.split('\n').slice(0, start_line).join('\n');
		let text_to_process = full_text.split('\n').slice(start_line).join('\n');

		// Process the text in blocks
		let processed_summary_text = '';
		let previous_iteration_overlap = '';
		let iteration = 0;

		// eslint-disable-next-line no-constant-condition
		while (true) {
			text_to_process = previous_iteration_overlap + ' ' +text_to_process;
			const [block, enumeratedBlock, remainingText] = get_block(text_to_process, 200);

			// If no more text to process, break
			if (!block) {
				break;
			}

			let retries = 0;
			let current_processed_summary = '';
			while (current_processed_summary.length === 0) {
				// Fetch summary for the current block of text
				const current_summary = await summarizeRequest(enumeratedBlock, plugin);

				// If summary is not found, break the loop
				if (!current_summary) {
					new Notice('Failed to process summary');
					return;
				}

				// Add the summary to the block of text
				current_processed_summary = current_summary;

				// If summary is not found, probably due to wrong gpt response, retry
				if (current_processed_summary.length === 0) {
					retries++;
				}

				// If retries are exceeded, break the loop
				if (retries > 3) {
					new Notice('Failed to process summary');
					return;
				}
			}

			// Add the summary to the processed text
			processed_summary_text += current_processed_summary;

			// Log the summarization if debug mode is enabled
			if (plugin.settings.debug) {
				// @ts-ignore
				const vaultRoot = plugin.app.vault.getRoot().vault.adapter.basePath;
				const log_directory = resolve(vaultRoot, plugin.settings.log_directory);
				await summarizationLog(log_directory, [block], [current_processed_summary], iteration);
			}

			// If there is no remaining text, exit the loop
			if (!remainingText) {
				break;
			}

			// Update text to process for the next iteration
			previous_iteration_overlap = '';
			text_to_process = remainingText;
			iteration++;
		}

		// Replace the original text in the editor with the processed summary text
		view.editor.replaceRange(processed_summary_text, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
	} else {
		new Notice('No active markdown view');
	}
}

// Function to punctuate text using the new algorithm with 1000-char chunks and sentence overlap
export async function punctuate(plugin: TextProcessingPlugin) {
    const CHUNK_SIZE = 1000;
    console.log('[punctuate] start with new algorithm');
    console.log('[punctuate] provider:', plugin.settings.provider);
    console.log('[punctuate] CHUNK_SIZE:', CHUNK_SIZE);

    if (plugin.settings.provider === 'openai' && !plugin.settings.api_key) {
        new Notice('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
        return;
    }

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    console.log('[punctuate] hasActiveView:', !!view);
    if (!view) {
        new Notice('No active markdown view');
        return;
    }

    const full_text = view.editor.getRange({ line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
    console.log('[punctuate] fullText.length:', full_text.length);
    const start_line = findPropertiesEnd(full_text);
    console.log('[punctuate] propertiesEndLine:', start_line);
    const prefix = full_text.split('\n').slice(0, start_line).join('\n');
    let original = full_text.split('\n').slice(start_line).join('\n');
    console.log('[punctuate] body.length:', original.length);

    // Helper function to find the equivalent position in original text
    function findOriginalPosition(originalText: string, startPos: number, processedText: string): number {
        // Simple approach: find the processed text in the original text starting from startPos
        const originalFromStart = originalText.slice(startPos);
        const originalNoPunct = removePunctuation(originalFromStart);
        
        // Find where the processed text matches in the original text without punctuation
        const matchIndex = originalNoPunct.indexOf(processedText);
        if (matchIndex !== -1) {
            return startPos + matchIndex;
        }
        
        // Fallback: return startPos + length of processed text
        return startPos + processedText.length;
    }

    // Process text in chunks according to the algorithm
    let pos = 0;
    let iteration = 0;
    let N = 0; // Total processed characters counter in result text

    while (pos < original.length) {
        iteration++;
        console.log(`[punctuate] Итерация ${iteration}: pos=${pos}, remaining=${original.length - pos}`);

        // Step 1: Remove punctuation from the text starting from position N (code-based)
        const textFromPos = original.slice(pos);
        const textNoPunct = removePunctuationPreservingWords(textFromPos);
        const textBeforePos = original.slice(0, pos);
        original = textBeforePos + textNoPunct;
        console.log(`[punctuate] Итерация ${iteration}: removed punctuation from pos ${pos}, length: ${original.length}`);
        
        // Update the editor with the text without punctuation
        view.editor.replaceRange(prefix + original, { line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });

        // Step 2: Take 1000 characters from the cleaned text
        const chunk = getFirstNCharacters(textNoPunct, CHUNK_SIZE);
        console.log(`[punctuate] Итерация ${iteration}: chunk length: ${chunk.length}`);

        if (chunk.length === 0) {
            break; // No more text to process
        }

        // Step 3: Find last space to avoid cutting words in half
        let finalChunk = chunk;
        let chunkLengthInOriginal = chunk.length;

        if (chunk.length === CHUNK_SIZE) {
            const lastSpaceIndex = chunk.lastIndexOf(' ');
            if (lastSpaceIndex > 0) {
                finalChunk = chunk.slice(0, lastSpaceIndex);
                // Calculate the actual length in original text (with punctuation)
                chunkLengthInOriginal = findOriginalChunkLength(textFromPos, finalChunk);
            }
        }

        // Log first 50 characters of the segment
        const segmentStart = getFirstNCharacters(chunk, 50);
        console.log(`[punctuate] Итерация ${iteration}: "${segmentStart}"`);

        // Step 3: Get the last word from the chunk
        const lastWord = getLastWord(finalChunk);
        console.log(`[punctuate] Итерация ${iteration}: last word: "${lastWord}"`);

        // Step 4: Send request to LLM for punctuation
        const systemPrompt = `Add punctuation marks to it
Guidelines:
Insert proper punctuation marks (commas, periods, question marks, exclamation points, colons, semicolons, quotation marks, etc.) according to the grammar rules of the language of the text.
Do not change or correct the wording, spelling, or structure of the sentences — only add punctuation.
Preserve line breaks and spacing as in the original text.
Do not provide any explanations or comments in the output.`;

        // Create a local function to handle punctuation using the English prompt
        const localPunctuationRequest = async (text: string): Promise<string | null> => {
            try {
                const system_prompt = `Add punctuation marks to it
Guidelines:
Insert proper punctuation marks (commas, periods, question marks, exclamation points, colons, semicolons, quotation marks, etc.) according to the grammar rules of the language of the text.
Do not change or correct the wording, spelling, or structure of the sentences — only add punctuation.
Preserve line breaks and spacing as in the original text.
Do not provide any explanations or comments in the output.`;
                
                // Import the llmResponse function locally
                const { llmResponse } = await import("#/helpers/requestHandlers");
                const response = await llmResponse(system_prompt, text, plugin, { temperature: 0.1, top_p: 0.7 });
                return typeof response === 'string' ? response : null;
            } catch (error) {
                console.error("Error in local punctuation request:", error);
                return null;
            }
        };

        let chunkWithPunctuation: string | null = await localPunctuationRequest(finalChunk);
        if (!chunkWithPunctuation || typeof chunkWithPunctuation !== 'string') {
            chunkWithPunctuation = finalChunk; // Fallback to original
        }

        console.log(`[punctuate] Итерация ${iteration}: got punctuation, length: ${chunkWithPunctuation.length}`);

        // Step 5: Count characters in the result
        const n = chunkWithPunctuation.length;
        console.log(`[punctuate] Итерация ${iteration} Шаг 5: k = ${n}`);

        // Step 5: Find the last sentence-ending punctuation mark (with ellipsis support)
        const lastSentenceEnd = findLastSentenceEndWithEllipsis(chunkWithPunctuation);
        if (lastSentenceEnd) {
            const context = getContextAround(chunkWithPunctuation, lastSentenceEnd.position, 15);
            console.log(`[punctuate] Итерация ${iteration} Шаг 5: "${context}"`);
        } else {
            console.log(`[punctuate] Итерация ${iteration} Шаг 5: no sentence ending found`);
        }

        // Step 6: Find the previous sentence-ending punctuation mark
        let previousSentenceEnd: { position: number; character: string } | null = null;
        if (lastSentenceEnd) {
            previousSentenceEnd = findPreviousSentenceEnd(chunkWithPunctuation, lastSentenceEnd.position);
            if (previousSentenceEnd) {
                const context = getContextAround(chunkWithPunctuation, previousSentenceEnd.position, 15);
                const nPrev = previousSentenceEnd.position + 1; // Add 1 to the found position
                console.log(`[punctuate] Итерация ${iteration} Шаг 6: "${context}" n=${nPrev}`);
                
                // Step 7: Add to N counter (N = N + n)
                const oldN = N;
                N = N + nPrev;
                console.log(`[punctuate] Итерация ${iteration} Шаг 7: N = ${oldN} + ${nPrev} = ${N}`);
            }
        }

        // Step 9: Insert processed text at position [pos, pos + send length] in the updated text
        const insertStartPos = pos;
        const insertEndPos = pos + finalChunk.length; // Length of text sent to LLM
        
        const textBeforeInsert = original.slice(0, insertStartPos);
        const textAfterInsert = original.slice(insertEndPos);
        
        // Ensure proper spacing: add space after processed text if next character is not a space or punctuation
        let processedTextWithSpace = chunkWithPunctuation;
        if (textAfterInsert.length > 0) {
            const nextChar = textAfterInsert[0];
            // If next character is a letter or digit, add space
            if (/[a-zA-Zа-яА-Я0-9]/.test(nextChar)) {
                processedTextWithSpace += ' ';
            }
        }
        
        original = textBeforeInsert + processedTextWithSpace + textAfterInsert;
        
        console.log(`[punctuate] Итерация ${iteration} Шаг 9: inserted processed text at [${insertStartPos}, ${insertEndPos}], new length: ${original.length}`);

        // Update the editor with the processed text
        view.editor.replaceRange(prefix + original, { line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });

        // Find the next starting position based on N position in the updated text
        if (previousSentenceEnd && previousSentenceEnd.position > 0) {
            // N represents the position in the updated text where we should start next
            pos = N;
            console.log(`[punctuate] Итерация ${iteration}: next pos = N = ${N}`);
        } else {
            // Fallback: move by chunk size
            pos += CHUNK_SIZE;
            console.log(`[punctuate] Итерация ${iteration}: fallback next pos = ${pos}`);
        }

        // Safety check to prevent infinite loops
        if (pos >= original.length || iteration > 100) {
            console.log(`[punctuate] Итерация ${iteration}: stopping, pos=${pos}, iteration=${iteration}`);
            break;
        }
    }

    console.log('[punctuate] final text length:', original.length);

    // Write the final result back to the editor
    view.editor.replaceRange(prefix + original, { line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
    console.log('[punctuate] done');
}
