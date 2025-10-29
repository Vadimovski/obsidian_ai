import { MarkdownView, Notice, TFile } from "obsidian";
import TextProcessingPlugin from "#/main";
import { topicsRequest, summarizeRequest, cosmeticRequest } from "#/helpers/requestHandlers";
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
	sliceByCharactersAlignToParagraph,
	findPositionInOriginalText,
    findOriginalChunkLength,
    sliceByCharactersAlignToParagraphOrSentence,
    sliceByWordsAndAlignToSentence,
    sliceByWordsAlignToParagraphOrSentence,
    enumerateChunkAndGetIndices,
    stripEnumeration,
    parseTopics,
    insertHeadingsExceptLast
} from "#/helpers/textProcessing";
import { DEFAULT_PUNCTUATE_PROMPT, DEFAULT_SPLIT_PROMPT, DEFAULT_COSMETIC_PROMPT, DEFAULT_SUMMARIZE_PROMPT } from "#/helpers/prompts";

// Function to create backup of the current file
async function createBackup(plugin: TextProcessingPlugin, view: MarkdownView): Promise<void> {
	if (!plugin.settings.backup) return;
	
	try {
		const file = view.file;
		if (!file) {
			new Notice('No active file to backup');
			return;
		}

		// Get the file's directory
		const filePath = file.path;
		const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
		const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
		const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
		const fileExt = fileName.substring(fileName.lastIndexOf('.'));

		// Create backup directory path
		const backupDir = fileDir + '/File Handler Backups';
		
		// Create backup directory if it doesn't exist
		const backupDirExists = await plugin.app.vault.adapter.exists(backupDir);
		if (!backupDirExists) {
			await plugin.app.vault.createFolder(backupDir);
		}

		// Create backup file name with timestamp
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupFileName = `${fileNameWithoutExt}_backup_${timestamp}${fileExt}`;
		const backupFilePath = `${backupDir}/${backupFileName}`;

		// Read the current file content
		const fileContent = await plugin.app.vault.read(file);
		
		// Create the backup file
		await plugin.app.vault.create(backupFilePath, fileContent);
		
		new Notice(`Backup created: ${backupFileName}`);
		console.log(`[backup] Created backup: ${backupFilePath}`);
	} catch (error) {
		console.error('[backup] Error creating backup:', error);
		new Notice('Error creating backup');
	}
}

// Function to divide text by topics
export async function divide_by_topics(plugin: TextProcessingPlugin) {
	console.log('[topics] START divide_by_topics (N/K algorithm)');

	if (plugin.settings.provider === 'openai' && !plugin.settings.api_key) {
		new Notice('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
		return;
	}

	const view = this.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) {
		console.error('[topics] No active markdown view');
		new Notice('No active markdown view');
		return;
	}

	await createBackup(plugin, view);

	const full_text = view.editor.getRange({ line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
	const start_line = findPropertiesEnd(full_text);
	const prefix = full_text.split('\n').slice(0, start_line).join('\n');
	const body = full_text.split('\n').slice(start_line).join('\n');

    const effectivePrompt = plugin.settings.customPrompts?.split ?? DEFAULT_SPLIT_PROMPT;
    const CHUNK_SIZE = plugin.settings.splitChunkSize ?? 1000;
    console.log('[topics] PROMPT:\n', effectivePrompt);
    console.log('[topics] CHUNK_SIZE:', CHUNK_SIZE);

	// Optimization: Check if entire text fits in one chunk
	const entireTextChunk = getFirstNCharacters(body, CHUNK_SIZE);
	
	if (entireTextChunk.length === body.length) {
		console.log('[topics] Optimization: entire text fits in one chunk, processing without sentence splitting');
		
		// Process the entire text at once
		try {
			const { enumerated, positions } = enumerateChunkAndGetIndices(entireTextChunk);
			console.log('[topics] Single chunk: sentences enumerated, count=', positions.size);
			
			const { llmResponse } = await import("#/helpers/requestHandlers");
			const topicsResponse = await llmResponse(effectivePrompt, enumerated, plugin);
			
			if (topicsResponse) {
				const parsed = parseTopics(topicsResponse);
				console.log('[topics] Single chunk: parsed topics:', parsed.map(t => `${t.n}:${t.title}`).join(', '));
				
				if (parsed.length > 0) {
					const { beforeLastProcessed } = insertHeadingsExceptLast(enumerated, parsed);
					const processed = stripEnumeration(beforeLastProcessed);
					view.editor.replaceRange(processed, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
					console.log('[topics] Single chunk processing completed successfully');
				} else {
					console.log('[topics] Single chunk: no topics found, keeping original text');
				}
			}
		} catch (e) {
			console.error('[topics] Error in single chunk processing:', e);
			new Notice('Error processing text');
		}
		
		return; // Exit early for single chunk case
	}

	let N = 0; // start index in body
	let iteration = 0;
	let result = '';

	while (N < body.length) {
		iteration++;
		console.log(`\n[topics] ===== Iteration ${iteration} START ===== N=${N}`);

		// 1) Slice ~CHUNK_SIZE characters and align to paragraph or sentence boundary
		const { chunk, remaining } = sliceByCharactersAlignToParagraphOrSentence(body.slice(N), CHUNK_SIZE);
		if (!chunk) {
			console.log(`[topics] Iteration ${iteration}: empty chunk, stopping`);
			break;
		}
		const K = N + chunk.length;
		console.log(`[topics] Iteration ${iteration}: chunk length=${chunk.length}, N=${N}, K=${K}`);
		const chunkStartPreview = getFirstNCharacters(chunk, 30);
		console.log(`[topics] Iteration ${iteration}: chunk start(30): "${chunkStartPreview}"`);

		// 2) Enumerate sentences
		const { enumerated, positions } = enumerateChunkAndGetIndices(chunk);
		console.log(`[topics] Iteration ${iteration}: sentences enumerated, count=${positions.size}`);

		// 3) Request topics
		let topicsResponse: string | null = null;
		try {
			const { llmResponse } = await import("#/helpers/requestHandlers");
			topicsResponse = await llmResponse(effectivePrompt, enumerated, plugin);
		} catch (e) {
			console.error('[topics] llm error:', e);
		}
		if (!topicsResponse) {
			console.warn(`[topics] Iteration ${iteration}: empty topics, appending chunk as-is`);
			result += chunk;
			N = K;
			view.editor.replaceRange(result, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
			continue;
		}

		const parsed = parseTopics(topicsResponse);
		console.log(`[topics] Iteration ${iteration}: parsed topics:`, parsed.map(t => `${t.n}:${t.title}`).join(', '));

		if (parsed.length === 0) {
			console.warn(`[topics] Iteration ${iteration}: no valid topics parsed, appending chunk as-is`);
			result += chunk;
			N = K;
			view.editor.replaceRange(result, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
			continue;
		}

		if (parsed.length === 1) {
			// Single topic: insert heading once, then advance beyond K, including heading already placed in result
			const only = parsed[0];
			const token = `"${only.n}"`;
			let withHeading = enumerated;
			if (withHeading.includes(token)) {
				withHeading = withHeading.replace(token, `\n## ${only.title}\n`);
			}
			const processed = stripEnumeration(withHeading);
			result += processed;
			N = K;
			console.log(`[topics] Iteration ${iteration}: single topic inserted, next N=${N}`);
			view.editor.replaceRange(result + (remaining ? `\n\n[...обработка продолжается...]` : ''), { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
			if (!remaining) break;
			continue;
		}

		// 4) Multiple topics: insert all except last, carry over from last topic sentence
		const { beforeLastProcessed, fromLastEnumerated } = insertHeadingsExceptLast(enumerated, parsed);
		result += beforeLastProcessed;

		// Determine next N: map last token position in enumerated to plain offset
		const last = parsed[parsed.length - 1];
		const lastToken = `"${last.n}"`;
		const idx = enumerated.indexOf(lastToken);
		if (idx === -1) {
			N = K; // fallback, avoid loop
			console.warn(`[topics] Iteration ${iteration}: last token not found, fallback next N=${N}`);
		} else {
			const plainPrefixLen = stripEnumeration(enumerated.slice(0, idx)).length;
			N = N + plainPrefixLen;
			console.log(`[topics] Iteration ${iteration}: next N computed via last token → ${N}`);
		}

		// Live preview update
		view.editor.replaceRange(result + (N < body.length ? `\n\n[...обработка продолжается...]` : ''), { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
		console.log(`[topics] Iteration ${iteration}: editor updated, result.length=${result.length}`);

		// Safety: stop if no progress
		if (N >= body.length || N >= K) {
			console.log(`[topics] Iteration ${iteration}: stopping (N>=body.length or no progress)`);
			break;
		}
	}

	// Final write
	view.editor.replaceRange(result, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
	console.log(`[topics] DONE - iterations=${iteration}, final length=${result.length}`);
}


// Function to summarize text
export async function summarize(plugin: TextProcessingPlugin) {
	// For OpenAI provider, ensure API key set
	if (plugin.settings.provider === 'openai' && !plugin.settings.api_key) {
		new Notice('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
		return;
	}

	// Get the active markdown view
	const view = this.app.workspace.getActiveViewOfType(MarkdownView);

	// Check if there is an active markdown view
	if (view) {
		// Create backup before processing
		await createBackup(plugin, view);
		// Get the full text from the editor
		const full_text = view.editor.getRange({ line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
		const start_line = findPropertiesEnd(full_text);
		const prefix = full_text.split('\n').slice(0, start_line).join('\n');
		let text_to_process = full_text.split('\n').slice(start_line).join('\n');
		const original_text = text_to_process; // Сохраняем оригинальный текст

        // Resolve effective prompt once and log it
        const effectivePrompt = plugin.settings.customPrompts?.summarize ?? DEFAULT_SUMMARIZE_PROMPT;
        console.log('[summary] PROMPT:\n', effectivePrompt);

        // Get chunk size from settings (default 5000 characters)
        const chunkSize = plugin.settings.summarizeChunkSize || 5000;
        console.log(`[summary] Chunk size: ${chunkSize} characters`);

        // Initialize summary block
        let summaryBlock = '```\n';
        let iteration = 0;

        console.log('[summary] ===== ЭТАП 1 - ОБРАБОТКА ЧАНКОВ =====');

		// eslint-disable-next-line no-constant-condition
		while (true) {
			console.log(`[summary] Итерация ${iteration + 1}: Берем текст до ${chunkSize} символов`);
			const { chunk, remaining } = sliceByCharactersAlignToParagraph(text_to_process, chunkSize);

			// If no more text to process, break
			if (!chunk) {
				console.log('[summary] Нет больше текста для обработки');
				break;
			}

			console.log(`[summary] Начало чанка (30 символов): "${chunk.substring(0, 30)}"`);
			console.log(`[summary] Длина чанка: ${chunk.length} символов`);
			console.log(`[summary] Откатываемся до начала абзаца (##)`);

			// Log the chunk boundaries for debugging - show 30 chars to the left from chunk end
			const chunkEnd = chunk.length;
			const contextStart = Math.max(0, chunkEnd - 30);
			const context = chunk.substring(contextStart, chunkEnd);
			console.log(`[summary] Контекст чанка (30 символов влево от конца): "${context}"`);

			console.log(`[summary] Отправляем чанк на обработку...`);

			let retries = 0;
			let current_processed_summary = '';
			while (current_processed_summary.length === 0) {
                // Fetch summary for the current chunk of text
                const current_summary = await summarizeRequest(chunk, plugin, effectivePrompt);

				// If summary is not found, break the loop
				if (!current_summary) {
					console.log('[summary] ОШИБКА: Не удалось получить ответ от AI');
					new Notice('Failed to process summary');
					return;
				}

				// Add the summary to the block of text
				current_processed_summary = current_summary;

				// If summary is not found, probably due to wrong gpt response, retry
				if (current_processed_summary.length === 0) {
					retries++;
					console.log(`[summary] Пустой ответ, попытка ${retries}/3`);
				}

				// If retries are exceeded, break the loop
				if (retries > 3) {
					console.log('[summary] ОШИБКА: Превышено количество попыток');
					new Notice('Failed to process summary');
					return;
				}
			}

            console.log(`[summary] Получен ответ: "${current_processed_summary}"`);

            // Add the summary to the summary block with wrapper
            summaryBlock += '<<' + current_processed_summary + '>>\n';

            // Live update in editor - show current summary block + remaining text
            const remainingIndicator = remaining ? `\n\n[...обработка продолжается...]` : '';
            const currentContent = prefix + '\n\n' + summaryBlock + '```\n\n' + text_to_process + remainingIndicator;
            view.editor.replaceRange(currentContent, { line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });

			// If there is no remaining text, exit the loop
			if (!remaining) {
				console.log('[summary] Нет оставшегося текста, завершаем этап 1');
				break;
			}

			console.log(`[summary] ===== ЭТАП 2 - ПОИСК СЛЕДУЮЩЕГО ЧАНКА =====`);
			
			// Update text to process for the next iteration - start from the next heading
			// Find the next heading (##) in the remaining text
			const nextHeadingMatch = remaining.match(/^##\s+/m);
			if (nextHeadingMatch) {
				const nextHeadingIndex = remaining.indexOf(nextHeadingMatch[0]);
				text_to_process = remaining.slice(nextHeadingIndex);
			} else {
				text_to_process = remaining;
			}
			
			iteration++;
		}

        console.log(`[summary] ===== ЭТАП 3 - ФИНАЛЬНАЯ ОБРАБОТКА =====`);
        
        // Final step: process all accumulated summaries into one final summary
        if (summaryBlock.length > 4) { // More than just "```\n"
            console.log('[summary] Берем все накопленные ответы из блока кода');
            
            // Extract accumulated summaries (remove the ``` wrapper)
            let accumulatedSummaries = summaryBlock.slice(4); // Remove "```\n"
            console.log('[summary] Все ответы перед финальной отправкой:');
            console.log('--- НАЧАЛО НАКОПЛЕННЫХ ОТВЕТОВ ---');
            console.log(accumulatedSummaries);
            console.log('--- КОНЕЦ НАКОПЛЕННЫХ ОТВЕТОВ ---');
            
            // Check if accumulated summaries exceed chunk size limit
            const finalChunkSize = chunkSize; // Use same chunk size for final processing
            console.log(`[summary] Размер накопленных ответов: ${accumulatedSummaries.length} символов`);
            console.log(`[summary] Лимит для финальной обработки: ${finalChunkSize} символов`);
            
            if (accumulatedSummaries.length > finalChunkSize) {
                console.log('[summary] Размер превышает лимит, обрабатываем по частям');
                
                // Process accumulated summaries in chunks
                while (accumulatedSummaries.length > finalChunkSize) {
                    console.log(`[summary] Обрабатываем чанк размером ${finalChunkSize} символов`);
                    
                    // Take chunk up to limit
                    const candidate = accumulatedSummaries.slice(0, finalChunkSize);
                    
                    // Find last >> to align to response boundary
                    const lastResponseEnd = candidate.lastIndexOf('>>');
                    let chunkToProcess;
                    let remainingSummaries;
                    
                    if (lastResponseEnd !== -1) {
                        chunkToProcess = accumulatedSummaries.slice(0, lastResponseEnd + 2);
                        remainingSummaries = accumulatedSummaries.slice(lastResponseEnd + 2);
                        console.log(`[summary] Откатываемся до >> влево, размер чанка: ${chunkToProcess.length} символов`);
                    } else {
                        chunkToProcess = candidate;
                        remainingSummaries = accumulatedSummaries.slice(finalChunkSize);
                        console.log(`[summary] >> не найден, используем весь чанк размером: ${chunkToProcess.length} символов`);
                    }
                    
                    // Process this chunk
                    let retries = 0;
                    let chunk_summary = '';
                    while (chunk_summary.length === 0) {
                        const chunk_response = await summarizeRequest(chunkToProcess, plugin, effectivePrompt);
                        
                        if (!chunk_response) {
                            console.log('[summary] ОШИБКА: Не удалось получить ответ для чанка');
                            new Notice('Failed to process chunk summary');
                            return;
                        }
                        
                        chunk_summary = chunk_response;
                        
                        if (chunk_summary.length === 0) {
                            retries++;
                            console.log(`[summary] Пустой ответ для чанка, попытка ${retries}/3`);
                        }
                        
                        if (retries > 3) {
                            console.log('[summary] ОШИБКА: Превышено количество попыток для чанка');
                            new Notice('Failed to process chunk summary');
                            return;
                        }
                    }
                    
                    console.log(`[summary] Получен ответ для чанка: "${chunk_summary.substring(0, 100)}..."`);
                    
                    // Replace processed chunk with summary
                    accumulatedSummaries = chunk_summary + '\n' + remainingSummaries;
                    console.log(`[summary] Размер после обработки чанка: ${accumulatedSummaries.length} символов`);
                }
            }
            
            console.log('[summary] Отправляем финальные накопленные ответы на обработку...');
            console.log('[summary] Финальные ответы перед отправкой:');
            console.log('--- НАЧАЛО ФИНАЛЬНЫХ ОТВЕТОВ ---');
            console.log(accumulatedSummaries);
            console.log('--- КОНЕЦ ФИНАЛЬНЫХ ОТВЕТОВ ---');
            
            let retries = 0;
            let final_summary = '';
            while (final_summary.length === 0) {
                // Fetch final summary for all accumulated summaries
                const final_summary_response = await summarizeRequest(accumulatedSummaries, plugin, effectivePrompt);

                // If summary is not found, break the loop
                if (!final_summary_response) {
                    console.log('[summary] ОШИБКА: Не удалось получить финальный ответ от AI');
                    new Notice('Failed to process final summary');
                    return;
                }

                // Add the summary to the final result
                final_summary = final_summary_response;

                // If summary is not found, probably due to wrong gpt response, retry
                if (final_summary.length === 0) {
                    retries++;
                    console.log(`[summary] Пустой финальный ответ, попытка ${retries}/3`);
                }

                // If retries are exceeded, break the loop
                if (retries > 3) {
                    console.log('[summary] ОШИБКА: Превышено количество попыток для финального ответа');
                    new Notice('Failed to process final summary');
                    return;
                }
            }

            // Remove << >> wrappers from final summary
            const cleaned_final_summary = final_summary.replace(/<<|>>/g, '');
            console.log(`[summary] Получен финальный ответ: "${cleaned_final_summary.substring(0, 100)}..."`);
            console.log('[summary] Итоговый ответ заменяет все промежуточные ответы');

            // Replace accumulated summaries with final summary
            const finalSummaryBlock = '```\n' + cleaned_final_summary + '\n```';
            const finalContent = prefix + '\n\n' + finalSummaryBlock + '\n\n' + original_text;
            view.editor.replaceRange(finalContent, { line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
            
            console.log('[summary] ===== ОБРАБОТКА ЗАВЕРШЕНА =====');
        } else {
            console.log('[summary] Нет накопленных ответов для финальной обработки');
            // No summaries accumulated, just close the block
            const finalContent = prefix + '\n\n' + summaryBlock + '```\n\n' + original_text;
            view.editor.replaceRange(finalContent, { line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
        }
	} else {
		new Notice('No active markdown view');
	}
}

// Function to perform Cosmetic Cleanup using ~1000-word chunks aligned to sentence boundaries
export async function cosmetic_cleanup(plugin: TextProcessingPlugin) {
    const CHUNK_SIZE = plugin.settings.cosmeticChunkSize ?? 1000;
    console.log('[cosmetic] START cosmetic_cleanup');
    console.log('[cosmetic] CHUNK_SIZE:', CHUNK_SIZE);

    if (plugin.settings.provider === 'openai' && !plugin.settings.api_key) {
        new Notice('OpenAI API key not found. Please enter your OpenAI API key in the settings page.');
        return;
    }

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
        console.error('[cosmetic] No active markdown view');
        new Notice('No active markdown view');
        return;
    }

    await createBackup(plugin, view);

    const full_text = view.editor.getRange({ line: 0, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
    const start_line = findPropertiesEnd(full_text);
    const prefix = full_text.split('\n').slice(0, start_line).join('\n');
    const body = full_text.split('\n').slice(start_line).join('\n');

    // Build full prompt including dictionary pairs
    const basePrompt = plugin.settings.customPrompts?.cosmetic ?? DEFAULT_COSMETIC_PROMPT;
    const dict = Array.isArray(plugin.settings.cosmeticDictionary) ? plugin.settings.cosmeticDictionary : [];
    const dictSection = dict.length > 0 ? '\n' + dict.map(p => `${p.key} -> ${p.value}`).join('\n') : '';
    const effectivePrompt = basePrompt + dictSection;
    console.log('[cosmetic] PROMPT:\n', effectivePrompt);

    // Optimization: Check if entire text fits in one chunk
    const entireTextChunk = getFirstNCharacters(body, CHUNK_SIZE);
    
    if (entireTextChunk.length === body.length) {
        console.log('[cosmetic] Optimization: entire text fits in one chunk, processing without sentence splitting');
        
        // Process the entire text at once
        try {
            const response = await cosmeticRequest(entireTextChunk, plugin, effectivePrompt);
            const cleaned = response ?? entireTextChunk;
            
            if (cleaned) {
                view.editor.replaceRange(cleaned, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
                console.log('[cosmetic] Single chunk processing completed successfully');
            }
        } catch (e) {
            console.error('[cosmetic] Error in single chunk processing:', e);
            new Notice('Error processing text');
        }
        
        return; // Exit early for single chunk case
    }

    let original = body; // Working copy of the text
    let pos = 0; // Current position in original text
    let iteration = 0;

    while (pos < original.length) {
        iteration++;
        console.log(`\n[cosmetic] ===== Iteration ${iteration} START ===== pos=${pos}`);

        // 1) Take CHUNK_SIZE characters from current position
        const textFromPos = original.slice(pos);
        const chunk = getFirstNCharacters(textFromPos, CHUNK_SIZE);
        if (!chunk) {
            console.log(`[cosmetic] Iteration ${iteration}: empty chunk, stopping`);
            break;
        }

        // Log first 30 chars of chunk start
        const start30 = getFirstNCharacters(chunk, 30);
        console.log(`[cosmetic] chunk start(30): "${start30}"`);

        // Raw boundary (before adjustment)
        const rawLocalEnd = chunk.length;
        const rawGlobalEnd = pos + rawLocalEnd;
        const rawLeftCtx = original.slice(Math.max(0, rawGlobalEnd - 15), rawGlobalEnd);
        console.log(`[cosmetic] raw end=${rawGlobalEnd}, left(15)="${rawLeftCtx}"`);

        // 2) Move left to last sentence-ending punctuation inside the chunk
        let adjustedLocalEnd = rawLocalEnd;
        const lastEnd = findLastSentenceEndWithEllipsis(chunk);
        if (lastEnd) {
            adjustedLocalEnd = lastEnd.position + 1;
        } else if (chunk.length === CHUNK_SIZE) {
            // Fallback: avoid cutting mid-word by last space
            const lastSpaceIndex = chunk.lastIndexOf(' ');
            if (lastSpaceIndex > 0) adjustedLocalEnd = lastSpaceIndex;
        }

        const adjustedGlobalEnd = pos + adjustedLocalEnd;
        const adjustedLeftCtx = original.slice(Math.max(0, adjustedGlobalEnd - 15), adjustedGlobalEnd);
        console.log(`[cosmetic] adjusted end=${adjustedGlobalEnd}, left(15)="${adjustedLeftCtx}"`);

        const finalChunk = textFromPos.slice(0, adjustedLocalEnd);
        console.log(`[cosmetic] Iteration ${iteration}: chunk length=${finalChunk.length}, pos=${pos}`);

        // 3) Request cosmetic cleanup
        let cleaned: string;
        try {
            const response = await cosmeticRequest(finalChunk, plugin, effectivePrompt);
            cleaned = response ?? finalChunk;
        } catch (e) {
            console.error('[cosmetic] llm error:', e);
            cleaned = finalChunk;
        }
        
        if (!cleaned) {
            console.warn(`[cosmetic] Iteration ${iteration}: empty response, using chunk as-is`);
            cleaned = finalChunk; // Fallback to original chunk
        }

        // 4) Insert processed text at position [pos, pos + finalChunk.length] in the updated text
        const insertStartPos = pos;
        const insertEndPos = pos + finalChunk.length;
        
        const textBeforeInsert = original.slice(0, insertStartPos);
        const textAfterInsert = original.slice(insertEndPos);
        
        original = textBeforeInsert + cleaned + textAfterInsert;
        
        console.log(`[cosmetic] Iteration ${iteration}: inserted processed text at [${insertStartPos}, ${insertEndPos}], new original.length=${original.length}`);

        // Update the editor with the processed text
        view.editor.replaceRange(original, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
        console.log(`[cosmetic] Iteration ${iteration}: editor updated`);

        // Move to next position (after the processed chunk in the updated text)
        pos = insertStartPos + cleaned.length + 1;
        console.log(`[cosmetic] Iteration ${iteration}: next pos = ${pos}`);

        // Safety
        if (pos >= original.length) break;
    }

    // Final write
    view.editor.replaceRange(original, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
    console.log(`[cosmetic] DONE - iterations=${iteration}, final length=${original.length}`);
}

// Function to punctuate text using the new algorithm with 1000-char chunks and sentence overlap
export async function punctuate(plugin: TextProcessingPlugin) {
    const userChunk = plugin.settings.punctuateChunkSize ?? 1000;
    const CHUNK_SIZE = Math.max(100, Math.min(10000, userChunk));
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

    // Create backup before processing
    await createBackup(plugin, view);

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

    // Resolve effective prompt once and log it
    const effectivePrompt = plugin.settings.customPrompts?.punctuate ?? DEFAULT_PUNCTUATE_PROMPT;
    console.log('[punctuate] PROMPT:\n', effectivePrompt);

    // Optimization: Check if entire text fits in one chunk
    const textNoPunct = removePunctuationPreservingWords(original, plugin.settings.punctuatePreserveHeadings ?? true);
    const entireTextChunk = getFirstNCharacters(textNoPunct, CHUNK_SIZE);
    
    if (entireTextChunk.length === textNoPunct.length) {
        console.log('[punctuate] Optimization: entire text fits in one chunk, processing without sentence splitting');
        
        // Update the editor with the text without punctuation
        view.editor.replaceRange(original, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
        
        // Process the entire text at once
        try {
            // Create a local function to handle punctuation using the English prompt
            const localPunctuationRequest = async (text: string): Promise<string | null> => {
                try {
                    const system_prompt = effectivePrompt;
                    
                    // Import the llmResponse function locally
                    const { llmResponse } = await import("#/helpers/requestHandlers");
                    const response = await llmResponse(system_prompt, text, plugin, { temperature: 0.1, top_p: 0.7 });
                    return typeof response === 'string' ? response : null;
                } catch (error) {
                    console.error("Error in local punctuation request:", error);
                    return null;
                }
            };
            
            const response = await localPunctuationRequest(entireTextChunk);
            const processed = response ?? entireTextChunk;
            
            if (processed) {
                view.editor.replaceRange(processed, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
                console.log('[punctuate] Single chunk processing completed successfully');
            }
        } catch (e) {
            console.error('[punctuate] Error in single chunk processing:', e);
            new Notice('Error processing text');
        }
        
        return; // Exit early for single chunk case
    }

    while (pos < original.length) {
        iteration++;
        const currentN = N; // Save current N value at the start of iteration
        console.log(`[punctuate] Итерация ${iteration} START: pos=${pos}, N=${N}, currentN=${currentN}, remaining=${original.length - pos}`);

        // Step 1: Remove punctuation from the text starting from position pos (code-based)
        const textFromPos = original.slice(pos);
        const textNoPunct = removePunctuationPreservingWords(textFromPos, plugin.settings.punctuatePreserveHeadings ?? true);
        const textBeforePos = original.slice(0, pos);
        original = textBeforePos + textNoPunct;
        console.log(`[punctuate] Итерация ${iteration}: removed punctuation from pos ${pos}, length: ${original.length}`);
        
        // Update the editor with the text without punctuation
        view.editor.replaceRange(original, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });

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
        const systemPrompt = `Add punctuation marks to the text.

Guidelines:
- Insert proper punctuation marks (commas, periods, question marks, exclamation points, colons, semicolons, quotation marks, dashes, etc.) according to the grammar rules of the text's language.
- Do NOT change or correct wording, spelling, capitalization, or sentence structure — only add or adjust punctuation and spacing.
- Preserve all line breaks and spacing exactly as in the original text (except for mandatory spaces after punctuation).

Output:
- Provide ONLY the punctuated text. Do not include explanations or comments.`;

        // Create a local function to handle punctuation using the English prompt
        const localPunctuationRequest = async (text: string): Promise<string | null> => {
            try {
                const system_prompt = effectivePrompt;
                
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

		// Step 5: Find the last sentence-ending punctuation mark (basic) and adjust for "..." if needed
		let lastSentenceEnd = findLastSentenceEnd(chunkWithPunctuation);
		if (lastSentenceEnd && lastSentenceEnd.character === '.' && lastSentenceEnd.position >= 2) {
			const last = lastSentenceEnd.position;
			const t = chunkWithPunctuation;
			if (t[last - 1] === '.' && t[last - 2] === '.') {
				lastSentenceEnd = { position: last - 2, character: '.' };
			}
		}
		if (lastSentenceEnd) {
			const context = getContextAround(chunkWithPunctuation, lastSentenceEnd.position, 15);
			console.log(`[punctuate] Итерация ${iteration} Шаг 5: "${context}"`);
		} else {
			console.log(`[punctuate] Итерация ${iteration} Шаг 5: no sentence ending found`);
		}

        // Step 6: Find the previous sentence-ending punctuation mark
        let previousSentenceEnd: { position: number; character: string } | null = null;
        console.log(`[punctuate] Итерация ${iteration} Шаг 6: lastSentenceEnd = ${lastSentenceEnd ? 'found' : 'not found'}`);
        if (lastSentenceEnd) {
            console.log(`[punctuate] Итерация ${iteration} Шаг 6: lastSentenceEnd position = ${lastSentenceEnd.position}`);
            previousSentenceEnd = findPreviousSentenceEnd(chunkWithPunctuation, lastSentenceEnd.position);
            console.log(`[punctuate] Итерация ${iteration} Шаг 6: previousSentenceEnd = ${previousSentenceEnd ? 'found' : 'not found'}`);
            if (previousSentenceEnd) {
                console.log(`[punctuate] Итерация ${iteration} Шаг 6: previousSentenceEnd position = ${previousSentenceEnd.position}`);
                const context = getContextAround(chunkWithPunctuation, previousSentenceEnd.position, 15);
                const nPrev = previousSentenceEnd.position + 1; // Add 1 to the found position
                console.log(`[punctuate] Итерация ${iteration} Шаг 6: "${context}" n=${nPrev}`);
                
                // Step 7: Add to N counter (N = N + n)
                const oldN = currentN;
                N = currentN + nPrev;
                console.log(`[punctuate] Итерация ${iteration} Шаг 7: N = ${oldN} + ${nPrev} = ${N}`);
                console.log(`[punctuate] Итерация ${iteration} Шаг 7: N updated from ${oldN} to ${N}`);
            } else {
                console.log(`[punctuate] Итерация ${iteration} Шаг 6: no previous sentence end found, N remains ${N}`);
            }
        } else {
            console.log(`[punctuate] Итерация ${iteration} Шаг 6: no last sentence end found, N remains ${N}`);
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
        view.editor.replaceRange(original, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });

        // Find the next starting position based on N position in the updated text
        if (previousSentenceEnd && previousSentenceEnd.position > 0) {
            // N represents the position in the updated text where we should start next
            pos = N + 1;
            console.log(`[punctuate] Итерация ${iteration}: next pos = N + 1 = ${N + 1}, final N = ${N}`);
        } else {
            // Fallback: move by chunk size
            pos += CHUNK_SIZE;
            console.log(`[punctuate] Итерация ${iteration}: fallback next pos = ${pos}, final N = ${N}`);
        }
        
        // Update N to match pos for the next iteration
        N = pos;
        console.log(`[punctuate] Итерация ${iteration} END: N = ${N}, pos = ${pos}`);

        // Safety check to prevent infinite loops
        if (pos >= original.length || iteration > 100) {
            console.log(`[punctuate] Итерация ${iteration}: stopping, pos=${pos}, iteration=${iteration}`);
            break;
        }
    }

    console.log('[punctuate] final text length:', original.length);

    // Write the final result back to the editor
    view.editor.replaceRange(original, { line: start_line, ch: 0 }, { line: view.editor.lastLine() + 1, ch: 0 });
    console.log('[punctuate] done');
}
