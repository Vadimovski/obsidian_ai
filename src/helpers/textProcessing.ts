// Splits the input text into blocks based on a maximum word count.
export function get_block(text: string, n: number): [string, string] {
	let currentBlock = '';
	let currentWordCount = 0;
	let lastPeriodIndex = -1;

	// Split the text into words while preserving spaces for reconstruction
	const words = text.split(' ');

	if (!words.length) return ['', '']; // Return empty strings for empty input

	for (let i = 0; i < words.length; i++) {
		const word = words[i];

		// Update the index of the last period found in the current block
		if (word.includes('.')) {
			lastPeriodIndex = currentBlock.length + word.length;
		}

		// Increment word count
		currentWordCount++;

		// Add the word to the current block
		currentBlock += word + ' ';

		// If the word limit is reached, attempt to split at a suitable point
		if (currentWordCount >= n) {
			let splitPoint = currentBlock.length; // Default split point is the end

			// Adjust split point to the last period if available
			if (lastPeriodIndex !== -1) {
				splitPoint = lastPeriodIndex;
				lastPeriodIndex = -1; // Reset after using
			}

			// Return the trimmed block and the remaining text
			return [
				currentBlock.slice(0, splitPoint).trim(),
				currentBlock.slice(splitPoint).trim() + text.slice(currentBlock.length).trim(),
			];
		}
	}
	return [currentBlock.trim(), '']; // Return remaining block if limit was not reached
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
