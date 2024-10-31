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
		let word = words[i];

		let isEnumerated = false;

		// Update the index of the last period found in the current block
		if (word.includes('.')) {
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
	return lines.slice(2).join('\n');
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
