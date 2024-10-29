import { promises as fs } from 'fs';
import { resolve } from 'path';


// Fallback to an empty string if undefined
const homeDir = process.env.HOME || process.env.USERPROFILE || '';
// Get the path to the log directory
const folderPath = resolve(homeDir, '.obsidian/logs/');
// Set limit for log file size
const MAX_LOG_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Create the directory if it does not exist
async function ensureFolderExists(folderPath: string): Promise<void> {
	try {
		const fullPath = resolve(folderPath);
		const stats = await fs.stat(fullPath);

		// Check if it's a directory
		if (!stats.isDirectory()) {
			new Error(`${fullPath} exists but is not a folder`);
		}
		// console.log('Folder already exists');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			// Folder does not exist, so create it
			await fs.mkdir(folderPath, { recursive: true });
			console.log('Log directory created');
		} else {
			throw error;
		}
	}
}


// Function to check and truncate the log file if it exceeds a size limit
async function checkAndTruncateLogFile(logFilePath: string): Promise<void> {
	try {
		const stats = await fs.stat(logFilePath);

		// Check if the file size exceeds the limit
		if (stats.size > MAX_LOG_FILE_SIZE) {
			await fs.truncate(logFilePath, 0); // Truncate the file
			console.log(`Log file truncated: ${logFilePath}`);
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.error('Error checking log file size:', error);
		}
	}
}


// Function to log topic processing
export async function topicProcessingLog(block: string, processedBlock: string, id: number): Promise<void> {
	const logFilePath = resolve(folderPath, `topic_processing_log.md`);

	// Ensure the log directory exists
	await ensureFolderExists(folderPath);

	// Check and truncate the log file if it exceeds the size limit
	await checkAndTruncateLogFile(logFilePath);

	// Create the log message
	const timestamp = new Date().toISOString();
	const logMessage = `
<p>${timestamp}</p>
<h2 style="color: red;">Block ${id}</h2>

${block}

<p>${timestamp}</p>
<h2 style="color: red;">Processed Block ${id}</h2>

${processedBlock}

`;

	// Write the log message to the log file
	try {
		await fs.appendFile(logFilePath, logMessage, 'utf8');
		console.log('Log entry written to:', logFilePath);
	} catch (error) {
		console.error('Error writing log entry:', error);
	}
}


// Function to log summarization data
export async function summarizationLog(blocks: string[], processedBlocks: string[], iteration: number): Promise<void> {
	const logFilePath = resolve(folderPath, `summarization_log.md`);

	// Ensure the log directory exists
	await ensureFolderExists(folderPath);

	// Check and truncate the log file if it exceeds the size limit
	await checkAndTruncateLogFile(logFilePath);

	// Get the current timestamp
	const timestamp = new Date().toISOString();

	// Create the log message for this iteration
	let logMessage = `
<p>${timestamp}</p>
<h2 style="color: red;">Iteration ${iteration} Before</h2>
<hr>
`;

	// Append all blocks
	blocks.forEach((block, index) => {
		logMessage += `<p>Block ${index + 1}:</p>\n${block}\n<hr>\n`;
	});

	// Add the processed blocks
	logMessage += `
<h2 style="color: red;">Iteration ${iteration} After</h2>
<hr>
`;

	processedBlocks.forEach((processedBlock, index) => {
		logMessage += `<p>Processed Block ${index + 1}:</p>\n${processedBlock}\n<hr>\n`;
	});

	// Write the log message to the log file
	try {
		await fs.appendFile(logFilePath, logMessage, 'utf8');
		console.log('Log entry written to:', logFilePath);
	} catch (error) {
		console.error('Error writing log entry:', error);
	}
}
