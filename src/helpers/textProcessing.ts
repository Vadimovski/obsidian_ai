// Splits the input text into blocks based on a maximum word count.
export function get_block(text: string, n: number): [string, string, string] {
	let currentBlock = '';
	let currentEnumeratedBlock = '';
	let currentWordCount = 0;
	let lastPeriodIndex = -1;
	let lastEnumeratedPeriodIndex = -1;
	let nPeriods = 1;

	// Split the text into words while preserving spaces for reconstruction
	const words = text.split(' ');

	if (!words.length) return ['', '', '']; // Return empty strings for empty input

	// Put the number of a first sentence in the block
	currentEnumeratedBlock += "\"" + nPeriods + "\" ";

	for (let i = 0; i < words.length; i++) {
		// Get the current word
		const word = words[i];

		let isEnumerated = false;

		// Update the index of the last period found in the current block
		if (word.includes('.') || word.includes('?') || word.includes('!')) {
			lastPeriodIndex = currentBlock.length + word.length;
			lastEnumeratedPeriodIndex = currentEnumeratedBlock.length + word.length;
			nPeriods++;
			isEnumerated = true;
			if (word.includes('\n')){
				currentEnumeratedBlock += word.replace('\n', '\n' + "\"" + nPeriods + "\" ");
			} else {
				currentEnumeratedBlock += word.replace('.', '.' + "\"" + nPeriods + "\" ");
			}
		}

		// Increment word count
		currentWordCount++;

		// Add the word to the current block
		currentBlock += word + ' ';
		if (!isEnumerated) currentEnumeratedBlock += word + ' ';

		// If the word limit is reached, attempt to split at a suitable point
		if (currentWordCount >= n) {
			let splitPoint = currentBlock.length; // Default split point is the end
			let splitEnumeratedPoint = currentEnumeratedBlock.length; // Default split point is the end

			// Adjust split point to the last period if available
			if (lastPeriodIndex !== -1) {
				splitPoint = lastPeriodIndex;
				splitEnumeratedPoint = lastEnumeratedPeriodIndex;
				// Reset after using
				lastPeriodIndex = -1;
				lastEnumeratedPeriodIndex = -1;
			}

			// Return the trimmed block and the remaining text
			return [
				currentBlock.slice(0, splitPoint),
				currentEnumeratedBlock.slice(0, splitEnumeratedPoint) + ' ',
				currentBlock.slice(splitPoint) + text.slice(currentBlock.length),
			];
		}
	}
	return [currentBlock.trim(), currentEnumeratedBlock.trim(), '']; // Return remaining block if limit was not reached
}

// Identifies if a properties structure exists at the beginning of a document and returns the line number where it ends
export function findPropertiesEnd(text: string): number {
	// Split the input text into lines for easier processing
	const lines = text.split('\n');

	// Initialize a flag to track if we've found the start of the structure
	let structureStarted = false;

	// Iterate over each line with its index (line number, starting from 0)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim(); // Remove leading/trailing whitespace for comparison

		// Check if this is the start of the structure
		if (!structureStarted && line === '---' || line === '...' || line.startsWith('aliases:')) {
			structureStarted = true;
		}
		// If we've found the start and now encounter the end
		else if (structureStarted && (line === '---' || line === '...')) {
			// Return the current line number (add 1 to make it 1-indexed if desired)
			return i + 1; // +1 to make it 1-indexed, remove if 0-indexed is preferred
		}
		// If we've started but haven't ended and we reach a line that clearly isn't part of the metadata (e.g., an empty line or a line without a key-value pair syntax)
		else if (structureStarted &&!line.includes(':') && line!== '') {
			// This could imply the end of the metadata block in some contexts, but since the spec isn't clear, we'll stick to looking for --- or...
			// If you want to include this condition for ending, replace the below line with "return i;" and adjust the logic as per your requirements
			// For now, this line does nothing but could be a placeholder for custom handling
		}
	}

	// If we've iterated through all lines and haven't found the end, or if the structure was never started
	return 0;
}

// Inserts the topics into the text
export function insertTopic(text: string, topics: string): string {
	// Create a map of topic numbers and their corresponding topics
	const numberTopicMap = new Map<string, string>();

	// Fill the map with topic numbers and topics
	for (const line of topics.split('\n')) {
		// Check if the line matches the pattern number: topic
		const match = line.match(/(\d+): (.+)/);
		if (match) {
			numberTopicMap.set(`"${match[1]}" `, `\n## ${match[2]}\n\n`);
		} else {
			return '';
		}
	}

	let id = 1;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		// Find the id in the text. The format should be "\"id\" "
		const idStr = id.toString();
		const regex = new RegExp(`"${idStr}" `);
		const match = text.match(regex);

		if (match) {
			// Replace the topic with the corresponding topic
			text = text.replace(match[0], numberTopicMap.get(match[0]) || ' ');
			id++;
		} else {
			break;
		}
	}
	return text;
}

// Removes the first topic from the text
export function removeTopic(text: string): string {
	const lines = text.split('\n');
	try {
		return lines.slice(2).join('\n');
	} catch (error) {
		return '';
	}
}

// Divides the input text into parts based on the last topic heading.
export function last_topic_division(text: string): [string, string] {
	const lines = text.split('\n');
	let lastTopicIndex = -1;

	// Loop through lines to find the last topic heading
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.startsWith('## ')) {
			lastTopicIndex = i; // Update last topic index
		}
	}

	// If no topics found, return original text and empty string
	if (lastTopicIndex === -1) {
		return [text, ''];
	}

	// Split the text into parts based on the last topic
	const textBeforeLastTopic = lines.slice(0, lastTopicIndex).join('\n');
	const lastTopicWithText = lines.slice(lastTopicIndex).join('\n');

	return [textBeforeLastTopic, lastTopicWithText];
}

// Counts the number of words in a given text.
export function countWords(text: string): number {
	return text.trim().split(' ').length; // Count words by splitting on spaces
}

// Divides the text into sections based on headings.
export function divideTextByHeadings(text: string): [string[], number[]] {
	// Split the text by headings (lines starting with #)
	const headings = text.split(/^(#+.*)$/gm);
	const contents: string[] = [];
	const contents_len: number[] = [];

	// Handle text before the first heading, if any
	if (headings[0].trim()) {
		const content = headings[0].trim();
		const content_len = countWords(content);
		contents.push(content);
		contents_len.push(content_len);
	}

	// Loop through headings and their contents
	for (let i = 1; i < headings.length; i += 2) {
		// Trim the content following the heading
		const content = headings[i + 1] ? headings[i + 1].trim() : '';
		const content_len = countWords(content);

		contents.push(content);
		contents_len.push(content_len);
	}

	return [contents, contents_len];
}

// Retrieves the first N words from the given text.
export function getFirstNWords(text: string, n: number): string {
	// Split the text into words based on spaces
	const words = text.trim().split(/\s+/);

	// Slice the array of words to get the first N words and join them back into a string
	return words.slice(0, n).join(' ');
}

// Removes all punctuation marks from text while preserving spaces and newlines
export function removePunctuation(text: string): string {
	// Protect wikilinks and embeds by temporarily replacing them
	const wikilinks: string[] = [];
	let result = text.replace(/(!?\[\[[^\]]+\]\])/g, (match) => {
		wikilinks.push(match);
		return `⚡⚡WIKILINK${wikilinks.length - 1}⚡⚡`;
	});
	
	// Remove punctuation
	result = result
		.replace(/[.!?…,;—«»"'']+/g, ' ')
		.replace(/[ \t]+/g, ' ') // Normalize spaces and tabs, but preserve newlines
		.replace(/ *\n */g, '\n'); // Remove spaces around newlines
	
	// Restore wikilinks
	result = result.replace(/⚡⚡WIKILINK(\d+)⚡⚡/g, (match, index) => {
		return wikilinks[parseInt(index)];
	});
	
	return result.trim();
}

// Removes punctuation while preserving word boundaries
export function removePunctuationPreservingWords(text: string, preserveHeadings: boolean = true): string {
	// Protect wikilinks and embeds by temporarily replacing them
	const wikilinks: string[] = [];
	let result = text.replace(/(!?\[\[[^\]]+\]\])/g, (match) => {
		wikilinks.push(match);
		return `⚡⚡WIKILINK${wikilinks.length - 1}⚡⚡`;
	});
	
	// Remove punctuation but keep spaces
	result = result.replace(/[.!?…,;—«»"'']+/g, ' ');

	// Optionally remove Markdown heading markers (#) at line starts
	if (!preserveHeadings) {
		// Remove leading heading markers and surrounding spaces at the start of lines
		result = result.replace(/^[ \t]*#{1,6}[ \t]*/gm, '');
	}
	
	// Then normalize multiple spaces to single spaces, but preserve newlines
	result = result.replace(/[ \t]+/g, ' '); // Normalize spaces and tabs only
	result = result.replace(/ *\n */g, '\n'); // Remove spaces around newlines
	
	// Restore wikilinks
	result = result.replace(/⚡⚡WIKILINK(\d+)⚡⚡/g, (match, index) => {
		return wikilinks[parseInt(index)];
	});
	
	// Trim leading and trailing spaces
	return result.trim();
}

// Gets the last word from a text
export function getLastWord(text: string): string {
	const words = text.trim().split(/\s+/);
	return words.length > 0 ? words[words.length - 1] : '';
}

// Finds the last sentence-ending punctuation mark in text
export function findLastSentenceEnd(text: string): { position: number; character: string } | null {
	const sentenceEndPattern = /[.!?…]/g;
	let lastMatch: { position: number; character: string } | null = null;
	let match;
	
	while ((match = sentenceEndPattern.exec(text)) !== null) {
		lastMatch = {
			position: match.index,
			character: match[0]
		};
	}
	
	return lastMatch;
}

// Finds the last sentence-ending punctuation mark in text with special handling for ellipsis
export function findLastSentenceEndWithEllipsis(text: string): { position: number; character: string } | null {
	// Check for ellipsis (...) or ellipsis character (…) first, then other sentence endings
	const ellipsisMatch = text.match(/\.{3}|…/g);
	if (ellipsisMatch) {
		// Find the last occurrence
		let lastIndex = -1;
		let lastCharacter = '';
		let match;
		
		// Search for all ellipsis patterns
		const ellipsisPattern = /\.{3}|…/g;
		while ((match = ellipsisPattern.exec(text)) !== null) {
			lastIndex = match.index + (match[0] === '...' ? 2 : 0); // Position of the last dot or ellipsis character
			lastCharacter = match[0];
		}
		
		if (lastIndex !== -1) {
			return {
				position: lastIndex,
				character: lastCharacter
			};
		}
	}
	
	// Then check for other sentence endings
	const sentenceEndPattern = /[.!?]/g;
	let lastMatch: { position: number; character: string } | null = null;
	let match;
	
	while ((match = sentenceEndPattern.exec(text)) !== null) {
		lastMatch = {
			position: match.index,
			character: match[0]
		};
	}
	
	return lastMatch;
}

// Finds the previous sentence-ending punctuation mark before a given position
export function findPreviousSentenceEnd(text: string, beforePosition: number): { position: number; character: string } | null {
	// Use a pattern that matches both ellipsis types and regular sentence endings
	const sentenceEndPattern = /\.{3}|…|[.!?]/g;
	let lastMatch: { position: number; character: string } | null = null;
	let match;
	
	while ((match = sentenceEndPattern.exec(text)) !== null) {
		if (match.index >= beforePosition) break;
		
		lastMatch = {
			position: match.index,
			character: match[0]
		};
	}
	
	return lastMatch;
}

// Gets context around a position in text (characters before and after)
export function getContextAround(text: string, position: number, contextLength: number = 15): string {
	const start = Math.max(0, position - contextLength);
	const end = Math.min(text.length, position + contextLength);
	return text.slice(start, end);
}

// Gets first N characters from text
export function getFirstNCharacters(text: string, n: number): string {
	return text.slice(0, n);
}

// Finds the nearest word boundary (start of a word) after a given position
export function findNextWordBoundary(text: string, position: number): number {
	// If position is already at the beginning of the text or at a space, return it
	if (position <= 0 || /\s/.test(text[position - 1])) {
		return position;
	}
	
	// Look for the next space or word boundary
	for (let i = position; i < text.length; i++) {
		if (/\s/.test(text[i])) {
			// Found a space, return the position after it
			return i + 1;
		}
	}
	
	// If no space found, return the end of text
	return text.length;
}

// Finds the nearest word boundary (start of a word) before a given position
export function findPreviousWordBoundary(text: string, position: number): number {
	// If position is at the beginning, return 0
	if (position <= 0) {
		return 0;
	}
	
	// Look backwards for a space or word boundary
	for (let i = position - 1; i >= 0; i--) {
		if (/\s/.test(text[i])) {
			// Found a space, return the position after it
			return i + 1;
		}
	}
	
	// If no space found, return the beginning of text
	return 0;
}

// Maps a position in processed text back to original text position
export function findPositionInOriginalText(originalText: string, processedPosition: number, processedText: string): number {
	// Simple approach: find the position where the processed text matches
	// This is a simplified mapping - in practice, you might need more sophisticated logic
	
	// If the processed position is beyond the processed text, return the end of original
	if (processedPosition >= processedText.length) {
		return originalText.length;
	}
	
	// Find the substring in processed text up to the position
	const processedSubstring = processedText.substring(0, processedPosition);
	
	// Try to find a corresponding position in original text
	// This is a heuristic approach - look for word boundaries
	let originalPos = 0;
	let processedPos = 0;
	
	while (originalPos < originalText.length && processedPos < processedPosition) {
		// Skip punctuation in original text
		if (/[.!?…,;—«»"''\s]/.test(originalText[originalPos])) {
			originalPos++;
			continue;
		}
		
		// Skip spaces in processed text
		if (/\s/.test(processedText[processedPos])) {
			processedPos++;
			continue;
		}
		
		// If characters match, advance both positions
		if (originalText[originalPos].toLowerCase() === processedText[processedPos].toLowerCase()) {
			originalPos++;
			processedPos++;
		} else {
			// Characters don't match, advance original position
			originalPos++;
		}
	}
	
	return Math.min(originalPos, originalText.length);
}

// Maps a position in result text back to original text position
export function findOriginalPositionFromResult(result: string, resultPosition: number, original: string): number {
	// This function maps a position in the accumulated result back to the original text
	// The result contains processed text with punctuation added
	
	// If result position is beyond result length, return end of original
	if (resultPosition >= result.length) {
		return original.length;
	}
	
	// For now, use a simplified approach
	// In a more sophisticated implementation, we would track the mapping between result and original
	
	// Since we're building the result incrementally, we can approximate the position
	// by finding where in the original text this position would correspond to
	
	let originalPos = 0;
	let resultPos = 0;
	
	while (originalPos < original.length && resultPos < resultPosition) {
		// Skip punctuation in original text that might not be in result yet
		if (/[.!?…,;—«»"''\s]/.test(original[originalPos])) {
			originalPos++;
			continue;
		}
		
		// If characters match (case insensitive), advance both positions
		if (original[originalPos].toLowerCase() === result[resultPos].toLowerCase()) {
			originalPos++;
			resultPos++;
		} else {
			// Characters don't match, advance original position
			originalPos++;
		}
	}
	
	return Math.min(originalPos, original.length);
}

// Finds the length of a cleaned chunk in the original text (with punctuation)
export function findOriginalChunkLength(originalText: string, cleanedChunk: string): number {
	let originalPos = 0;
	let cleanedPos = 0;
	
	while (cleanedPos < cleanedChunk.length && originalPos < originalText.length) {
		// Skip punctuation and extra spaces in original
		if (/[.!?…,;—«»"'']/.test(originalText[originalPos])) {
			originalPos++;
			continue;
		}
		
		if (/\s+/.test(originalText[originalPos]) && !/\s/.test(cleanedChunk[cleanedPos])) {
			originalPos++;
			continue;
		}
		
		// Match characters
		if (originalText[originalPos].toLowerCase() === cleanedChunk[cleanedPos].toLowerCase()) {
			originalPos++;
			cleanedPos++;
		} else {
			originalPos++;
		}
	}
	
	return originalPos;
}

// ===== New helpers for paragraph/topic splitting =====

// Takes approximately maxChars characters and prefers closing at a paragraph boundary (blank line).
// If no paragraph boundary is found in the candidate, falls back to sentence alignment (ellipsis-aware),
// and finally to the end of candidate.
export function sliceByCharactersAlignToParagraphOrSentence(text: string, maxChars: number = 1000): { chunk: string; remaining: string } {
    if (!text || maxChars <= 0) {
        return { chunk: '', remaining: text };
    }

    // Step 1: Take ~maxChars characters to define candidate window
    const candidate = text.slice(0, maxChars);
    if (!candidate) {
        return { chunk: '', remaining: text };
    }

    // Step 2: Prefer the last paragraph boundary (blank line) inside candidate
    // Match sequences like "\n\n" or "\r\n\r\n" with optional spaces in between
    const paragraphRe = /(?:\r?\n)[ \t]*(?:\r?\n)/g;
    let lastParaBoundary = -1;
    let m: RegExpExecArray | null;
    while ((m = paragraphRe.exec(candidate)) !== null) {
        lastParaBoundary = m.index + m[0].length; // position after the blank line
    }

    if (lastParaBoundary !== -1) {
        const chunk = candidate.slice(0, lastParaBoundary);
        const remaining = text.slice(lastParaBoundary);
        return { chunk, remaining };
    }

    // Step 3: Fall back to last sentence ending (ellipsis-aware)
    let splitAt = -1;
    for (let i = candidate.length - 1; i >= 2; i--) {
        if (candidate[i] === '.' && candidate[i - 1] === '.' && candidate[i - 2] === '.') {
            splitAt = i;
            break;
        }
    }
    if (splitAt === -1) {
        for (let i = candidate.length - 1; i >= 0; i--) {
            if (/[.!?…]/.test(candidate[i])) {
                splitAt = i;
                break;
            }
        }
    }

    const boundary = splitAt !== -1 ? splitAt + 1 : candidate.length;
    const chunk = candidate.slice(0, boundary);
    const remaining = text.slice(boundary);
    return { chunk, remaining };
}

// Takes approximately maxWords words from the start of text and then
// moves left to the last sentence-ending character so the chunk ends at a sentence boundary
export function sliceByWordsAndAlignToSentence(text: string, maxWords: number = 1000): { chunk: string; remaining: string } {
    if (!text || maxWords <= 0) {
        return { chunk: '', remaining: text };
    }

    // Take ~maxWords words without reconstructing text to preserve whitespace/newlines
    let wordCount = 0;
    let endExclusive = 0;
    let inWord = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const isWhitespace = /\s/.test(ch);
        if (!isWhitespace && !inWord) {
            wordCount++;
            inWord = true;
            if (wordCount > maxWords) {
                endExclusive = i; // stop before this word
                break;
            }
        } else if (isWhitespace) {
            inWord = false;
        }
        endExclusive = i + 1; // keep advancing
    }

    const candidate = text.slice(0, endExclusive);
    if (!candidate) {
        return { chunk: '', remaining: text };
    }

    // Find last sentence-ending punctuation within candidate (supports '...' and '…')
    // Prefer ellipsis first
    let splitAt = -1;
    // Search '...' occurrences
    for (let i = candidate.length - 1; i >= 2; i--) {
        if (candidate[i] === '.' && candidate[i - 1] === '.' && candidate[i - 2] === '.') {
            splitAt = i; // index of last dot in '...'
            break;
        }
    }
    // If not found, search for single sentence enders
    if (splitAt === -1) {
        for (let i = candidate.length - 1; i >= 0; i--) {
            if (/[.!?…]/.test(candidate[i])) {
                splitAt = i;
                break;
            }
        }
    }

    const boundary = splitAt !== -1 ? splitAt + 1 : candidate.length;
    const chunk = candidate.slice(0, boundary);
    const remaining = text.slice(boundary);
    return { chunk, remaining };
}

// Takes approximately maxWords words and prefers closing at a paragraph boundary (blank line).
// If no paragraph boundary is found in the candidate, falls back to sentence alignment (ellipsis-aware),
// and finally to the end of candidate.
export function sliceByWordsAlignToParagraphOrSentence(text: string, maxWords: number = 1000): { chunk: string; remaining: string } {
    if (!text || maxWords <= 0) {
        return { chunk: '', remaining: text };
    }

    // Step 1: Take ~maxWords words to define candidate window
    let wordCount = 0;
    let endExclusive = 0;
    let inWord = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const isWhitespace = /\s/.test(ch);
        if (!isWhitespace && !inWord) {
            wordCount++;
            inWord = true;
            if (wordCount > maxWords) {
                endExclusive = i; // stop before this word
                break;
            }
        } else if (isWhitespace) {
            inWord = false;
        }
        endExclusive = i + 1;
    }

    const candidate = text.slice(0, endExclusive);
    if (!candidate) {
        return { chunk: '', remaining: text };
    }

    // Step 2: Prefer the last paragraph boundary (blank line) inside candidate
    // Match sequences like "\n\n" or "\r\n\r\n" with optional spaces in between
    const paragraphRe = /(?:\r?\n)[ \t]*(?:\r?\n)/g;
    let lastParaBoundary = -1;
    let m: RegExpExecArray | null;
    while ((m = paragraphRe.exec(candidate)) !== null) {
        lastParaBoundary = m.index + m[0].length; // position after the blank line
    }

    if (lastParaBoundary !== -1) {
        const chunk = candidate.slice(0, lastParaBoundary);
        const remaining = text.slice(lastParaBoundary);
        return { chunk, remaining };
    }

    // Step 3: Fall back to last sentence ending (ellipsis-aware)
    let splitAt = -1;
    for (let i = candidate.length - 1; i >= 2; i--) {
        if (candidate[i] === '.' && candidate[i - 1] === '.' && candidate[i - 2] === '.') {
            splitAt = i;
            break;
        }
    }
    if (splitAt === -1) {
        for (let i = candidate.length - 1; i >= 0; i--) {
            if (/[.!?…]/.test(candidate[i])) {
                splitAt = i;
                break;
            }
        }
    }

    const boundary = splitAt !== -1 ? splitAt + 1 : candidate.length;
    const chunk = candidate.slice(0, boundary);
    const remaining = text.slice(boundary);
    return { chunk, remaining };
}

// Inserts enumeration tokens "1", "2", ... before each sentence start without adding extra spaces
// Returns the enumerated text and a map from sentence number to insertion index
export function enumerateChunkAndGetIndices(chunk: string): { enumerated: string; positions: Map<number, number> } {
    const positions = new Map<number, number>();
    if (!chunk) return { enumerated: '', positions };

    // Find sentence starts: first non-whitespace at start (index 0),
    // and first non-whitespace after each sentence-ending punctuation (… or ... or [.!?])
    const starts: number[] = [];

    // Helper to find first non-whitespace index >= i
    const firstNonWhitespace = (s: string, i: number) => {
        let j = i;
        while (j < s.length && /\s/.test(s[j])) j++;
        return j;
    };

    // Start of first sentence
    starts.push(firstNonWhitespace(chunk, 0));

    // Scan for sentence ends and compute next starts
    for (let i = 0; i < chunk.length; i++) {
        // Ellipsis '...'
        if (i + 2 < chunk.length && chunk[i] === '.' && chunk[i + 1] === '.' && chunk[i + 2] === '.') {
            const nextStart = firstNonWhitespace(chunk, i + 3);
            if (nextStart < chunk.length) starts.push(nextStart);
            i += 2; // advance past ellipsis
            continue;
        }
        if (/[.!?…]/.test(chunk[i])) {
            const nextStart = firstNonWhitespace(chunk, i + 1);
            if (nextStart < chunk.length) starts.push(nextStart);
        }
    }

    // Deduplicate and sort starts
    const uniqueStarts = Array.from(new Set(starts)).sort((a, b) => a - b);

    // Build enumerated string
    let result = '';
    let cursor = 0;
    let sentenceIndex = 1;
    for (const s of uniqueStarts) {
        if (s < cursor) continue;
        // Append text before the sentence start
        result += chunk.slice(cursor, s);
        // Insert token
        const token = `"${sentenceIndex}"`;
        positions.set(sentenceIndex, result.length); // index where token starts
        result += token;
        // Append from sentence start up to before the next token insertion
        cursor = s;
        sentenceIndex++;
    }
    // Append the rest
    result += chunk.slice(cursor);

    return { enumerated: result, positions };
}

// Removes all enumeration tokens like "1", "23" from text
export function stripEnumeration(text: string): string {
    if (!text) return text;
    return text.replace(/"\d+"/g, '');
}

export type ParsedTopic = { n: number; title: string };

// Parses LLM topics in format: "<number>: <Title>" per line
export function parseTopics(response: string): ParsedTopic[] {
    if (!response) return [];
    const topics: ParsedTopic[] = [];
    for (const rawLine of response.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;
        const m = line.match(/^(\d+)\s*:\s*(.+)$/);
        if (m) {
            const n = parseInt(m[1], 10);
            const title = m[2].trim();
            if (!isNaN(n) && title) topics.push({ n, title });
        }
    }
    topics.sort((a, b) => a.n - b.n);
    return topics;
}

// Inserts headings for all topics except the last one. Headings are in format: \n## {title}\n
// Returns two parts:
//  - beforeLastProcessed: text BEFORE the last topic with headings inserted (enumerations removed)
//  - fromLastEnumerated: text FROM the last topic marker (still enumerated) for next-iteration processing
export function insertHeadingsExceptLast(enumeratedChunk: string, topics: ParsedTopic[]): { beforeLastProcessed: string; fromLastEnumerated: string } {
    if (!enumeratedChunk || topics.length === 0) {
        return { beforeLastProcessed: stripEnumeration(enumeratedChunk), fromLastEnumerated: '' };
    }

    if (topics.length === 1) {
        // Single-topic case should be handled by caller separately
        return { beforeLastProcessed: stripEnumeration(enumeratedChunk), fromLastEnumerated: '' };
    }

    const last = topics[topics.length - 1];
    const lastToken = `"${last.n}"`;
    const lastIdx = enumeratedChunk.indexOf(lastToken);
    if (lastIdx === -1) {
        // Fallback: no marker found for last; process entire chunk
        let processed = enumeratedChunk;
        for (let i = 0; i < topics.length - 1; i++) {
            const t = topics[i];
            const token = `"${t.n}"`;
            processed = processed.replace(token, `\n## ${t.title}\n`);
        }
        return { beforeLastProcessed: stripEnumeration(processed), fromLastEnumerated: '' };
    }

    const beforeLast = enumeratedChunk.slice(0, lastIdx);
    const fromLast = enumeratedChunk.slice(lastIdx);

    // Replace tokens in beforeLast for all topics except the last
    let beforeProcessed = beforeLast;
    for (let i = 0; i < topics.length - 1; i++) {
        const t = topics[i];
        const token = `"${t.n}"`;
        beforeProcessed = beforeProcessed.replace(token, `\n## ${t.title}\n`);
    }

    return { beforeLastProcessed: stripEnumeration(beforeProcessed), fromLastEnumerated: fromLast };
}

// Splits text by characters and aligns to paragraph boundaries (## headings)
// Takes approximately maxChars characters and moves left to the last paragraph boundary
export function sliceByCharactersAlignToParagraph(text: string, maxChars: number = 5000): { chunk: string; remaining: string } {
    if (!text || maxChars <= 0) {
        return { chunk: '', remaining: text };
    }

    // Take approximately maxChars characters
    const candidate = text.slice(0, Math.min(maxChars, text.length));
    if (!candidate) {
        return { chunk: '', remaining: text };
    }

    // Find the last paragraph boundary (## heading) within the candidate
    // Look for patterns like "## " or "\n## " 
    const paragraphRe = /(?:^|\n)##\s+/g;
    let lastParaBoundary = -1;
    let m: RegExpExecArray | null;
    
    while ((m = paragraphRe.exec(candidate)) !== null) {
        lastParaBoundary = m.index; // position of the paragraph marker
    }

    // If we found a paragraph boundary, use it
    if (lastParaBoundary !== -1) {
        const chunk = candidate.slice(0, lastParaBoundary);
        const remaining = text.slice(lastParaBoundary);
        return { chunk, remaining };
    }

    // If no paragraph boundary found, fall back to sentence alignment
    let splitAt = -1;
    
    // Search for ellipsis first
    for (let i = candidate.length - 1; i >= 2; i--) {
        if (candidate[i] === '.' && candidate[i - 1] === '.' && candidate[i - 2] === '.') {
            splitAt = i; // index of last dot in '...'
            break;
        }
    }
    
    // If not found, search for single sentence enders
    if (splitAt === -1) {
        for (let i = candidate.length - 1; i >= 0; i--) {
            if (/[.!?…]/.test(candidate[i])) {
                splitAt = i;
                break;
            }
        }
    }

    const boundary = splitAt !== -1 ? splitAt + 1 : candidate.length;
    const chunk = candidate.slice(0, boundary);
    const remaining = text.slice(boundary);
    return { chunk, remaining };
}
