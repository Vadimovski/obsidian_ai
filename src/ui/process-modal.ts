import { App, Modal, Setting, TFile, Notice } from "obsidian";
import TextProcessingPlugin from "#/main";
import { t } from "#/ui/i18n";
import { divide_by_topics, summarize, punctuate, cosmetic_cleanup } from "#/helpers/markdownHandlers";
import { FeatureManageModal } from "#/ui/feature-manage-modal";
import { BatchProcessModal } from "#/ui/batch-process-modal";

// Modal for text comparison
class TextComparisonModal extends Modal {
	private readonly plugin: TextProcessingPlugin;
	private originalFile: TFile | null = null;
	private processedFile: TFile | null = null;
	private originalFileEl: HTMLElement;
	private processedFileEl: HTMLElement;
	private originalTextEl: HTMLElement;
	private processedTextEl: HTMLElement;

	constructor(app: App, plugin: TextProcessingPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		const lang = this.plugin.settings.language;

		contentEl.createEl('h2', { text: t(lang, 'text_comparison_title') });

		// Add styles
		this.addStyles();
		
		// Apply modal width directly to the modal element
		this.modalEl.style.maxWidth = '60vw';
		this.modalEl.style.width = '60vw';

		// Main container with two columns
		const mainContainer = contentEl.createDiv('comparison-main-container');

		// Left column - Original file
		const leftColumn = mainContainer.createDiv('comparison-column');
		leftColumn.createEl('h3', { text: t(lang, 'original_text') });
		
		const originalFileControl = new Setting(leftColumn)
			.setName(t(lang, 'select_original_file'))
			.addButton(btn => {
				btn.setButtonText(t(lang, 'select_file'))
					.setCta()
					.setClass('select-original-btn')
					.onClick(() => this.selectFile('original'));
			});
		
		this.originalFileEl = leftColumn.createDiv('selected-file-display');
		this.updateFileDisplay('original');

		// Right column - Processed file
		const rightColumn = mainContainer.createDiv('comparison-column');
		rightColumn.createEl('h3', { text: t(lang, 'processed_text') });
		
		const processedFileControl = new Setting(rightColumn)
			.setName(t(lang, 'select_processed_file'))
			.addButton(btn => {
				btn.setButtonText(t(lang, 'select_file'))
					.setCta()
					.setClass('select-processed-btn')
					.onClick(() => this.selectFile('processed'));
			});
		
		this.processedFileEl = rightColumn.createDiv('selected-file-display');
		this.updateFileDisplay('processed');

		// Compare button spanning both columns - positioned after file selection
		const compareButtonRow = mainContainer.createDiv('compare-button-row');
		compareButtonRow.style.gridColumn = '1 / -1';
		
		const compareButton = compareButtonRow.createEl('button', {
			text: t(lang, 'compare'),
			cls: 'mod-cta compare-btn'
		});
		compareButton.disabled = !this.originalFile || !this.processedFile;
		compareButton.onclick = () => this.compareTexts();

		// Text display areas - directly in the modal content
		const textContainer = contentEl.createDiv('text-container');
		this.originalTextEl = textContainer.createDiv('text-display-area left-text');
		this.updateTextDisplay('original');

		this.processedTextEl = textContainer.createDiv('text-display-area right-text');
		this.updateTextDisplay('processed');

		// Setup synchronized scrolling
		this.setupSynchronizedScrolling();
	}

	private async selectFile(type: 'original' | 'processed') {
		const allFiles = this.app.vault.getMarkdownFiles();
		const selected = await this.showFilePicker(allFiles);
		
		if (selected) {
			if (type === 'original') {
				this.originalFile = selected;
				this.updateFileDisplay('original');
			} else {
				this.processedFile = selected;
				this.updateFileDisplay('processed');
			}
			
		}
	}

	private async updateFileDisplay(type: 'original' | 'processed') {
		const el = type === 'original' ? this.originalFileEl : this.processedFileEl;
		const file = type === 'original' ? this.originalFile : this.processedFile;
		
		el.empty();
		
		if (file) {
			el.createEl('span', { 
				text: `✓ ${file.path}`,
				cls: 'file-path-display'
			});
			const removeBtn = el.createEl('button', { 
				text: '×',
				cls: 'remove-file-btn'
			});
			removeBtn.onclick = () => {
				if (type === 'original') {
					this.originalFile = null;
				} else {
					this.processedFile = null;
				}
				this.updateFileDisplay(type);
				this.updateTextDisplay(type);
				this.updateCompareButtonState();
			};
			
			// Load file content and display it
			await this.loadFileContent(type);
		} else {
			el.createEl('span', { 
				text: t(this.plugin.settings.language, 'no_files_selected'),
				cls: 'no-file-selected'
			});
		}
		
		this.updateCompareButtonState();
	}
	
	private async loadFileContent(type: 'original' | 'processed') {
		const file = type === 'original' ? this.originalFile : this.processedFile;
		const textEl = type === 'original' ? this.originalTextEl : this.processedTextEl;
		
		if (!file) return;
		
		try {
			const text = await this.app.vault.read(file);
			this.updateTextDisplay(type, text);
		} catch (error) {
			console.error('Error loading file:', error);
			textEl.setText('Error loading file content');
		}
	}
	
	private updateTextDisplay(type: 'original' | 'processed', text?: string) {
		const textEl = type === 'original' ? this.originalTextEl : this.processedTextEl;
		
		if (text !== undefined) {
			textEl.setText(text);
		} else {
			textEl.setText('');
		}
	}
	
	private updateCompareButtonState() {
		// Find the compare button by its class
		const compareBtn = this.contentEl.querySelector('.compare-btn') as HTMLButtonElement;
		if (compareBtn) {
			compareBtn.disabled = !this.originalFile || !this.processedFile;
		}
	}

	private setupSynchronizedScrolling() {
		let isScrolling = false;

		this.originalTextEl.addEventListener('scroll', () => {
			if (!isScrolling) {
				isScrolling = true;
				this.processedTextEl.scrollTop = this.originalTextEl.scrollTop;
				// Allow scrolling to complete
				setTimeout(() => { isScrolling = false; }, 50);
			}
		});

		this.processedTextEl.addEventListener('scroll', () => {
			if (!isScrolling) {
				isScrolling = true;
				this.originalTextEl.scrollTop = this.processedTextEl.scrollTop;
				// Allow scrolling to complete
				setTimeout(() => { isScrolling = false; }, 50);
			}
		});
	}

	private async showFilePicker(allFiles: TFile[]): Promise<TFile | null> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			const lang = this.plugin.settings.language;
			
			modal.titleEl.setText(t(lang, 'select_file'));
			const content = modal.contentEl;

			// Create search input
			const searchContainer = content.createDiv('file-search-container');
			const searchInput = searchContainer.createEl('input', {
				type: 'text',
				placeholder: t(lang, 'search_files_placeholder'),
				cls: 'file-search-input'
			}) as HTMLInputElement;

			// Create file list
			const fileList = content.createDiv('file-selection-list');
			const fileItems: { file: TFile; element: HTMLElement }[] = [];

			allFiles.forEach(file => {
				const fileItem = fileList.createDiv('file-selection-item');
				fileItem.createEl('span', { text: file.path });
				
				fileItems.push({ file, element: fileItem });
				
				fileItem.addEventListener('click', () => {
					modal.close();
					resolve(file);
				});
			});

			// Add search functionality
			searchInput.addEventListener('input', (e) => {
				const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
				
				fileItems.forEach(({ file, element }) => {
					const fileName = file.path.toLowerCase();
					const shouldShow = fileName.includes(searchTerm);
					element.style.display = shouldShow ? 'flex' : 'none';
				});
			});

			modal.open();
		});
	}

	private async compareTexts() {
		if (!this.originalFile || !this.processedFile) {
			new Notice(t(this.plugin.settings.language, 'please_select_both_files'));
			return;
		}

		// Disable compare button
		const compareBtn = this.contentEl.querySelector('.compare-btn') as HTMLButtonElement;
		if (compareBtn) {
			compareBtn.disabled = true;
			compareBtn.textContent = t(this.plugin.settings.language, 'processing') + '...';
		}

		try {
			const originalText = await this.app.vault.read(this.originalFile);
			const processedText = await this.app.vault.read(this.processedFile);

			// Show processing indicator in processed text area
			this.processedTextEl.innerHTML = '<div class="processing-indicator">Processing comparison...</div>';

			// Perform comparison with progress
			await this.performComparison(originalText, processedText);
		} catch (error) {
			console.error('Error comparing files:', error);
			new Notice('Error comparing files');
			this.processedTextEl.setText('Error during comparison');
		} finally {
			// Re-enable compare button
			if (compareBtn) {
				compareBtn.disabled = false;
				compareBtn.textContent = t(this.plugin.settings.language, 'compare');
			}
		}
	}

	private async performComparison(originalText: string, processedText: string) {
		// Use setTimeout to allow UI to update
		await new Promise(resolve => setTimeout(resolve, 100));

		const CHUNK_SIZE = 2000; // Process 2000 characters at a time
		const totalLength = processedText.length;
		
		// Show initial progress
		this.processedTextEl.innerHTML = '<div class="processing-indicator">Processing... 0%</div>';
		
		let html = '';
		let processedChars = 0;
		
		// Process text in chunks
		for (let start = 0; start < processedText.length; start += CHUNK_SIZE) {
			const end = Math.min(start + CHUNK_SIZE, processedText.length);
			
			// Calculate what portion of original text to compare with
			const origStart = Math.min(start, originalText.length);
			const origEnd = Math.min(end, originalText.length);
			
			// Get chunks to compare
			const origChunk = originalText.substring(origStart, origEnd);
			const procChunk = processedText.substring(start, end);
			
			// Compare chunks
			const diff = this.computeDiff(origChunk, procChunk);
			
			// Build HTML for this chunk
			for (const segment of diff) {
				if (segment.type === 'equal') {
					html += this.escapeHtml(segment.text);
				} else if (segment.type === 'insert') {
					html += `<mark class="ins">${this.escapeHtml(segment.text)}</mark>`;
				}
			}
			
			processedChars = end;
			const progress = Math.round((processedChars / totalLength) * 100);
			
			// Update progress indicator every chunk
			this.processedTextEl.innerHTML = `<div class="processing-indicator">Processing... ${progress}%</div>`;
			
			// Allow UI to update
			await new Promise(resolve => setTimeout(resolve, 0));
		}
		
		// Update the processed text area with highlighted differences
		this.processedTextEl.innerHTML = html;
	}

	private escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	// Character-based comparison algorithm
	private findLCSIndices(a: string[], b: string[]): Set<number> {
		const n = a.length;
		const m = b.length;
		
		// DP table
		const dp: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));
		
		// Fill DP table
		for (let i = n - 1; i >= 0; i--) {
			for (let j = m - 1; j >= 0; j--) {
				if (a[i] === b[j]) {
					dp[i][j] = 1 + dp[i + 1][j + 1];
				} else {
					dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
				}
			}
		}
		
		// Reconstruct indices
		const indices = new Set<number>();
		let i = 0, j = 0;
		
		while (i < n && j < m) {
			if (a[i] === b[j]) {
				indices.add(j);
				i++;
				j++;
			} else if (dp[i + 1][j] >= dp[i][j + 1]) {
				i++;
			} else {
				j++;
			}
		}
		
		return indices;
	}
	
	private computeDiff(oldText: string, newText: string): Array<{type: 'equal' | 'insert', text: string}> {
		// Character-based comparison
		const oldChars = Array.from(oldText);
		const newChars = Array.from(newText);
		
		// Find LCS indices for characters
		const lcsIndices = this.findLCSIndices(oldChars, newChars);
		
		// Build result pieces
		const result: Array<{type: 'equal' | 'insert', text: string}> = [];
		
		for (let i = 0; i < newChars.length; i++) {
			const char = newChars[i];
			const inLCS = lcsIndices.has(i);
			
			if (inLCS) {
				// Character is in LCS - show as equal
				if (result.length > 0 && result[result.length - 1].type === 'equal') {
					result[result.length - 1].text += char;
				} else {
					result.push({ type: 'equal', text: char });
				}
			} else {
				// Character is new - show as insert
				if (result.length > 0 && result[result.length - 1].type === 'insert') {
					result[result.length - 1].text += char;
				} else {
					result.push({ type: 'insert', text: char });
				}
			}
		}
		
		return result;
	}

	private addStyles() {
		// Check if styles are already added
		if (document.getElementById('text-comparison-file-styles')) return;
		
		const style = document.createElement('style');
		style.id = 'text-comparison-file-styles';
		style.textContent = `
			/* Ensure backdrop is visible */
			.modal-backdrop {
				display: block !important;
				opacity: 1 !important;
			}
			
			.comparison-main-container {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 16px;
				margin: 16px 0;
			}
			
			.comparison-column {
				display: flex;
				flex-direction: column;
			}
			
			.comparison-column h3 {
				margin: 0 0 12px 0;
				padding-bottom: 8px;
				border-bottom: 2px solid var(--interactive-accent);
			}
			
			.text-container {
				display: flex;
				gap: 16px;
				margin-top: 20px;
			}
			
			.text-display-area {
				flex: 1;
				min-height: 400px;
				padding: 0;
				background-color: transparent;
				border: none;
				border-radius: 0;
				overflow: visible;
				font-family: var(--font-monospace);
				font-size: 14px;
				line-height: 1.7;
				white-space: pre-wrap;
				word-wrap: break-word;
			}
			
			.text-display-area mark.ins {
				background-color: #38a169;
				color: #fff;
				border-radius: 4px;
				padding: 0 .2em;
			}
			
			.processing-indicator {
				text-align: center;
				padding: 20px;
				color: var(--text-muted);
				font-style: italic;
			}
			
			.compare-button-row {
				width: 100%;
				margin: 20px 0;
				grid-column: 1 / -1;
			}
			
			.compare-button-row .compare-btn {
				width: 100% !important;
				padding: 12px 24px !important;
				font-size: 16px !important;
			}
			
			.selected-file-display {
				margin: 8px 0;
				padding: 8px;
				background-color: var(--background-secondary);
				border-radius: 4px;
				border: 1px solid var(--background-modifier-border);
				display: flex;
				align-items: center;
				justify-content: space-between;
			}
			
			.file-path-display {
				font-family: var(--font-monospace);
				font-size: 13px;
				color: var(--text-normal);
				flex: 1;
			}
			
			.no-file-selected {
				color: var(--text-muted);
				font-style: italic;
				font-size: 13px;
			}
			
			.remove-file-btn {
				background: none;
				border: none;
				color: var(--text-error);
				cursor: pointer;
				font-size: 20px;
				font-weight: bold;
				padding: 2px 8px;
				border-radius: 3px;
				transition: background-color 0.2s ease;
			}
			
			.remove-file-btn:hover {
				background-color: var(--background-modifier-error);
			}
			
			.file-search-container {
				margin: 12px 0;
			}
			
			.file-search-input {
				width: 100%;
				padding: 8px 12px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background-color: var(--background-primary);
				color: var(--text-normal);
				font-size: 14px;
				transition: border-color 0.2s ease;
			}
			
			.file-search-input:focus {
				outline: none;
				border-color: var(--interactive-accent);
				box-shadow: 0 0 0 2px var(--interactive-accent-alpha);
			}
			
			.file-search-input::placeholder {
				color: var(--text-muted);
			}
			
			.file-selection-list {
				max-height: 400px;
				overflow-y: auto;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				padding: 8px;
				background-color: var(--background-primary);
			}
			
			.file-selection-item {
				display: flex;
				align-items: center;
				padding: 8px 12px;
				margin: 2px 0;
				border-radius: 4px;
				cursor: pointer;
				transition: background-color 0.2s ease;
			}
			
			.file-selection-item:hover {
				background-color: var(--background-modifier-hover);
			}
			
			.file-selection-item span {
				font-family: var(--font-monospace);
				font-size: 13px;
			}
		`;
		document.head.appendChild(style);
	}

	onClose() {
		this.contentEl.empty();
	}
}

// Class representing a modal for processing text with GPT
export class ProcessModal extends Modal {
	private readonly plugin: TextProcessingPlugin;
	private processButton: Setting;
	private processingButtonEl: HTMLElement;
	// boolean flag for waiting for GPT response
	private static waiting_for_response = false;
	private processingModal: Modal | null = null;

	constructor(app: App, plugin: TextProcessingPlugin) {
		super(app);
		this.plugin = plugin;
	}

	// Method called when the modal is opened
	onOpen() {
		const { contentEl } = this;

		// Create header for the modal
		contentEl.createEl('h2', { text: t(this.plugin.settings.language, 'modal_title') });

		// Create tabs
		const tabs = contentEl.createDiv('modal-tabs');
		
		const mainTab = tabs.createEl('button', { 
			text: t(this.plugin.settings.language, 'main_features'),
			cls: 'modal-tab active'
		});
		
		const additionalTab = tabs.createEl('button', { 
			text: t(this.plugin.settings.language, 'additional_features'),
			cls: 'modal-tab'
		});

		// Create content areas
		const mainContent = contentEl.createDiv('tab-content active');
		const additionalContent = contentEl.createDiv('tab-content');

		// Main features content
		this.renderMainFeatures(mainContent);

		// Additional features content
		this.renderAdditionalFeatures(additionalContent);

		// Tab switching logic
		mainTab.onclick = () => {
			mainTab.classList.add('active');
			additionalTab.classList.remove('active');
			mainContent.classList.add('active');
			additionalContent.classList.remove('active');
		};

		additionalTab.onclick = () => {
			additionalTab.classList.add('active');
			mainTab.classList.remove('active');
			additionalContent.classList.add('active');
			mainContent.classList.remove('active');
		};

		// Add CSS
		this.addStyles();
	}

	private renderMainFeatures(container: HTMLElement) {
		// Always show all four features
		this.createManageRow(container, 'punctuate');
		this.createManageRow(container, 'cosmetic');
		this.createManageRow(container, 'split');
		this.createManageRow(container, 'summarize');
		
		// Add backup toggle at the bottom
		this.createBackupToggle(container);
	}

	private renderAdditionalFeatures(container: HTMLElement) {
		// Add text comparison feature
		const textComparisonSetting = new Setting(container)
			.setName(t(this.plugin.settings.language, 'text_comparison_name'))
			.setDesc(t(this.plugin.settings.language, 'text_comparison_desc'));
		
		textComparisonSetting.addButton(btn => {
			btn.setButtonText(t(this.plugin.settings.language, 'open'))
				.setCta()
				.onClick(() => new TextComparisonModal(this.app, this.plugin).open());
		});
	}

	private addStyles() {
		// Check if styles are already added
		if (document.getElementById('text-comparison-styles')) return;
		
		const style = document.createElement('style');
		style.id = 'text-comparison-styles';
		style.textContent = `
			.modal-tabs {
				display: flex;
				border-bottom: 1px solid var(--background-modifier-border);
				margin-bottom: 1rem;
			}
			.modal-tab {
				flex: 1;
				padding: 0.5rem 1rem;
				background: transparent;
				border: none;
				border-bottom: 2px solid transparent;
				cursor: pointer;
				transition: all 0.2s;
			}
			.modal-tab:hover {
				background: var(--background-modifier-hover);
			}
			.modal-tab.active {
				border-bottom-color: var(--interactive-accent);
			}
			.tab-content {
				display: none;
			}
			.tab-content.active {
				display: block;
			}
			.text-comparison-buttons {
				display: flex;
				gap: 0.5rem;
				margin-bottom: 1rem;
				flex-wrap: wrap;
			}
			.text-comparison-split {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 1rem;
				max-height: 60vh;
				overflow: auto;
			}
			.comparison-panel h3 {
				margin-top: 0;
			}
			.comparison-text {
				padding: 0.5rem;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				white-space: pre-wrap;
				font-family: var(--font-monospace);
			}
			.comparison-text del {
				background-color: rgba(255, 0, 0, 0.2);
				text-decoration: line-through;
			}
			.comparison-text ins {
				background-color: rgba(0, 255, 0, 0.2);
				text-decoration: none;
			}
		`;
		document.head.appendChild(style);
	}

	private createManageRow(container: HTMLElement, feature: 'punctuate' | 'cosmetic' | 'split' | 'summarize') {
		const lang = this.plugin.settings.language;
		const setting = new Setting(container)
			.setName(t(lang, feature === 'punctuate' ? 'punctuate_name' : feature === 'cosmetic' ? 'cosmetic_name' : feature === 'split' ? 'split_name' : 'summarize_name'))
			.setDesc(t(lang, feature === 'punctuate' ? 'punctuate_desc' : feature === 'cosmetic' ? 'cosmetic_desc' : feature === 'split' ? 'split_desc' : 'summarize_desc'));
		
		// Add manage button
		setting.addButton(btn => {
			btn.setButtonText(t(lang, 'manage'))
				.onClick(() => new FeatureManageModal(this.app, this.plugin, feature as any).open());
		});
		
		// Add batch process button (square button)
		setting.addButton(btn => {
			btn.setButtonText('📁')
				.setTooltip(t(lang, 'batch_process_title'))
				.setClass('batch-process-btn')
				.onClick(() => new BatchProcessModal(this.app, this.plugin, feature).open());
		});
		
		// Add process button
		setting.addButton(btn => {
			btn.setCta();
			btn.setButtonText(t(lang, 'process'))
				.onClick(async () => {
					this.showProcessingModal();
					
					try {
						if (feature === 'punctuate') {
							await punctuate(this.plugin);
						} else if (feature === 'cosmetic') {
							await cosmetic_cleanup(this.plugin);
						} else if (feature === 'split') {
							await divide_by_topics(this.plugin);
						} else {
							await summarize(this.plugin);
						}
					} finally {
						this.hideProcessingModal();
					}
				});
		});
	}

	// Method to show processing modal
	private showProcessingModal(): void {
		this.processingModal = new Modal(this.app);
		this.processingModal.titleEl.setText(t(this.plugin.settings.language, 'processing'));
		this.processingModal.contentEl.createEl('p', { 
			text: t(this.plugin.settings.language, 'processing_message')
		});
		this.processingModal.open();
	}

	// Method to hide processing modal
	private hideProcessingModal(): void {
		if (this.processingModal) {
			this.processingModal.close();
			this.processingModal = null;
		}
	}

	// Method to create backup toggle
	private createBackupToggle(container: HTMLElement) {
		new Setting(container)
			.setName(t(this.plugin.settings.language, "backup"))
			.setDesc(t(this.plugin.settings.language, "backup_desc"))
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.backup)
					.onChange(async (value) => this.updateSettings("backup", value))
			);
	}

	// Method to update the plugin settings
	private async updateSettings(name: string, value: any): Promise<void> {
		(this.plugin.settings as any)[name] = value;
		await this.plugin.saveSettings();
	}

	// Method called when the modal is closed
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
