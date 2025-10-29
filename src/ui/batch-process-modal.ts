import { App, Modal, Setting, TFile, TFolder, Notice } from "obsidian";
import TextProcessingPlugin from "#/main";
import { t } from "#/ui/i18n";
import { divide_by_topics, summarize, punctuate, cosmetic_cleanup } from "#/helpers/markdownHandlers";

export class BatchProcessModal extends Modal {
	private readonly plugin: TextProcessingPlugin;
	private readonly feature: 'punctuate' | 'cosmetic' | 'split' | 'summarize';
	private selectedFiles: TFile[] = [];
	private fileListEl: HTMLElement;
	private processingModal: Modal | null = null;
	private processButton: HTMLButtonElement | null = null;
	private includeSubfolders: boolean = true;
	private isProcessing: boolean = false;
	private shouldStop: boolean = false;
	private currentFileEl: HTMLElement | null = null;
	private remainingFilesEl: HTMLElement | null = null;

	constructor(app: App, plugin: TextProcessingPlugin, feature: 'punctuate' | 'cosmetic' | 'split' | 'summarize') {
		super(app);
		this.plugin = plugin;
		this.feature = feature;
	}

	onOpen() {
		const { contentEl } = this;
		const lang = this.plugin.settings.language;

		// Add CSS styles
		this.addStyles();

		// Create header
		contentEl.createEl('h2', { 
			text: `${t(lang, 'batch_process_title')} - ${t(lang, this.feature === 'punctuate' ? 'punctuate_name' : this.feature === 'cosmetic' ? 'cosmetic_name' : this.feature === 'split' ? 'split_name' : 'summarize_name')}`
		});

		// Add description
		contentEl.createEl('p', { 
			text: t(lang, 'batch_process_desc'),
			cls: 'batch-process-desc'
		});

		// File selection buttons
		new Setting(contentEl)
			.setName(t(lang, 'select_files'))
			.setDesc(t(lang, 'select_files_desc'))
			.addButton(btn => {
				btn.setButtonText(t(lang, 'select_files_btn'))
					.setCta()
					.onClick(() => this.showFilePicker());
			})
			.addButton(btn => {
				btn.setButtonText(t(lang, 'select_folder'))
					.setCta()
					.onClick(() => this.showFolderStructurePicker());
			});

		// Selected files list
		const filesContainer = contentEl.createDiv('batch-files-container');
		filesContainer.createEl('h3', { text: t(lang, 'selected_files') });
		this.fileListEl = filesContainer.createDiv('batch-files-list');

		// Process button
		new Setting(contentEl)
			.setName(t(lang, 'process_files'))
			.setDesc(t(lang, 'process_files_desc'))
			.addButton(btn => {
				this.processButton = btn.buttonEl;
				btn.setButtonText(t(lang, 'process'))
					.setCta()
					.setDisabled(this.selectedFiles.length === 0)
					.onClick(async () => {
						if (this.selectedFiles.length > 0) {
							await this.processFiles();
						}
					});
				
				// Alternative event listener
				this.processButton.addEventListener('click', async (e) => {
					e.preventDefault();
					e.stopPropagation();
					if (this.selectedFiles.length > 0) {
						await this.processFiles();
					}
				});
			});

		// Clear selection button
		if (this.selectedFiles.length > 0) {
			new Setting(contentEl)
				.addButton(btn => {
					btn.setButtonText(t(lang, 'clear_selection'))
						.onClick(() => {
							this.selectedFiles = [];
							this.updateFileList();
							this.updateProcessButton();
						});
				});
		}

		// Update process button state
		this.updateProcessButton();
	}

	private showFilePicker() {
		// Create a simple file picker using Obsidian's file explorer
		const files = this.app.vault.getMarkdownFiles();
		this.showFileSelectionModal(files, false);
	}

	private showFolderPicker() {
		// Get all markdown files from all folders
		const files = this.app.vault.getMarkdownFiles();
		this.showFileSelectionModal(files, true);
	}

	private showFolderStructurePicker() {
		const modal = new Modal(this.app);
		modal.titleEl.setText(t(this.plugin.settings.language, 'select_folder_structure'));
		
		const content = modal.contentEl;
		content.createEl('p', { text: t(this.plugin.settings.language, 'select_folder_structure_desc') });

		// Include subfolders toggle
		const toggleSetting = new Setting(content)
			.setName(t(this.plugin.settings.language, 'include_subfolders'))
			.setDesc(t(this.plugin.settings.language, 'include_subfolders_desc'))
			.addToggle(toggle => {
				toggle
					.setValue(this.includeSubfolders)
					.onChange((value) => {
						this.includeSubfolders = value;
					});
			});

		// Create search input
		const searchContainer = content.createDiv('file-search-container');
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: t(this.plugin.settings.language, 'search_files_placeholder'),
			cls: 'file-search-input'
		}) as HTMLInputElement;

		// Create folder tree
		const folderList = content.createDiv('folder-selection-list');
		
		// Get all folders and files
		const folders = this.app.vault.getAllFolders();
		const allFiles = this.app.vault.getMarkdownFiles();
		const folderItems: { folder: TFolder; element: HTMLElement; checkbox: HTMLInputElement }[] = [];
		
		// Sort folders by path
		folders.sort((a, b) => a.path.localeCompare(b.path));
		
		// Update toggle handler to refresh folder list
		const toggleElement = toggleSetting.controlEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
		if (toggleElement) {
			toggleElement.addEventListener('change', () => {
				this.refreshFolderList(folderItems, allFiles);
			});
		}
		
		folders.forEach(folder => {
			const folderItem = folderList.createDiv('folder-selection-item');
			const checkbox = folderItem.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
			checkbox.id = `folder-${folder.path}`;
			
			// Create folder icon and path
			const folderContent = folderItem.createDiv('folder-content');
			folderContent.createEl('span', { text: '📁', cls: 'folder-icon' });
			
			const folderInfo = folderContent.createDiv('folder-info');
			folderInfo.createEl('span', { text: folder.path || '/', cls: 'folder-path' });
			
			// Count files in this folder
			const filesInFolder = allFiles.filter(file => {
				if (this.includeSubfolders) {
					return file.path.startsWith(folder.path + '/');
				} else {
					const fileDir = file.path.substring(0, file.path.lastIndexOf('/'));
					return fileDir === folder.path;
				}
			});
			
			const fileCount = folderInfo.createEl('span', { 
				text: ` (${filesInFolder.length} ${t(this.plugin.settings.language, 'files_count')})`,
				cls: 'folder-file-count'
			});
			
			// Store reference for filtering
			folderItems.push({ folder, element: folderItem, checkbox });
			
			// Add click handler to toggle selection
			folderItem.addEventListener('click', (e) => {
				if (e.target !== checkbox) {
					checkbox.checked = !checkbox.checked;
				}
			});
		});

		// Add search functionality
		searchInput.addEventListener('input', (e) => {
			const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
			
			folderItems.forEach(({ folder, element }) => {
				const folderPath = folder.path.toLowerCase();
				const shouldShow = folderPath.includes(searchTerm);
				element.style.display = shouldShow ? 'flex' : 'none';
			});
		});

		// Add select all/none buttons
		const buttonContainer = content.createDiv('file-selection-buttons');
		buttonContainer.createEl('button', { text: t(this.plugin.settings.language, 'select_all') })
			.addEventListener('click', () => {
				folderItems.forEach(({ element, checkbox }) => {
					if (element.style.display !== 'none') {
						checkbox.checked = true;
					}
				});
			});
		
		buttonContainer.createEl('button', { text: t(this.plugin.settings.language, 'select_none') })
			.addEventListener('click', () => {
				folderItems.forEach(({ element, checkbox }) => {
					if (element.style.display !== 'none') {
						checkbox.checked = false;
					}
				});
			});

		// Add confirm button
		content.createEl('button', { 
			text: t(this.plugin.settings.language, 'confirm_selection'),
			cls: 'mod-cta'
		}).addEventListener('click', () => {
			const selectedFolders: TFolder[] = [];
			folderItems.forEach(({ folder, checkbox }) => {
				if (checkbox.checked) {
					selectedFolders.push(folder);
				}
			});
			
			// Get all files from selected folders
			const filesFromFolders: TFile[] = [];
			
			selectedFolders.forEach(folder => {
				allFiles.forEach(file => {
					if (this.includeSubfolders) {
						// Include files from subfolders
						if (file.path.startsWith(folder.path + '/')) {
							filesFromFolders.push(file);
						}
					} else {
						// Only include files directly in the folder
						const fileDir = file.path.substring(0, file.path.lastIndexOf('/'));
						if (fileDir === folder.path) {
							filesFromFolders.push(file);
						}
					}
				});
			});
			
			this.selectedFiles = filesFromFolders;
			this.updateFileList();
			this.updateProcessButton();
			modal.close();
		});

		modal.open();
	}

	private refreshFolderList(folderItems: { folder: TFolder; element: HTMLElement; checkbox: HTMLInputElement }[], allFiles: TFile[]) {
		folderItems.forEach(({ folder, element }) => {
			const fileCountEl = element.querySelector('.folder-file-count');
			if (fileCountEl) {
				const filesInFolder = allFiles.filter(file => {
					if (this.includeSubfolders) {
						return file.path.startsWith(folder.path + '/');
					} else {
						const fileDir = file.path.substring(0, file.path.lastIndexOf('/'));
						return fileDir === folder.path;
					}
				});
				fileCountEl.textContent = ` (${filesInFolder.length} ${t(this.plugin.settings.language, 'files_count')})`;
			}
		});
	}

	private showFileSelectionModal(allFiles: TFile[], isFolderMode: boolean) {
		const modal = new Modal(this.app);
		modal.titleEl.setText(isFolderMode ? t(this.plugin.settings.language, 'select_folder') : t(this.plugin.settings.language, 'select_files'));
		
		const content = modal.contentEl;
		content.createEl('p', { text: t(this.plugin.settings.language, 'select_files_instruction') });

		// Create search input
		const searchContainer = content.createDiv('file-search-container');
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: t(this.plugin.settings.language, 'search_files_placeholder'),
			cls: 'file-search-input'
		}) as HTMLInputElement;

		// Create file list with checkboxes
		const fileList = content.createDiv('file-selection-list');
		
		// Store all file items for filtering
		const fileItems: { file: TFile; element: HTMLElement; checkbox: HTMLInputElement }[] = [];
		
		allFiles.forEach(file => {
			const fileItem = fileList.createDiv('file-selection-item');
			const checkbox = fileItem.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
			checkbox.id = `file-${file.path}`;
			
			const label = fileItem.createEl('label', { 
				text: file.path,
				attr: { for: `file-${file.path}` }
			});
			
			// Store reference for filtering
			fileItems.push({ file, element: fileItem, checkbox });
			
			// Add click handler to toggle selection
			fileItem.addEventListener('click', (e) => {
				if (e.target !== checkbox) {
					checkbox.checked = !checkbox.checked;
				}
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

		// Add select all/none buttons
		const buttonContainer = content.createDiv('file-selection-buttons');
		buttonContainer.createEl('button', { text: t(this.plugin.settings.language, 'select_all') })
			.addEventListener('click', () => {
				fileItems.forEach(({ element, checkbox }) => {
					if (element.style.display !== 'none') {
						checkbox.checked = true;
					}
				});
			});
		
		buttonContainer.createEl('button', { text: t(this.plugin.settings.language, 'select_none') })
			.addEventListener('click', () => {
				fileItems.forEach(({ element, checkbox }) => {
					if (element.style.display !== 'none') {
						checkbox.checked = false;
					}
				});
			});

		// Add confirm button
		content.createEl('button', { 
			text: t(this.plugin.settings.language, 'confirm_selection'),
			cls: 'mod-cta'
		}).addEventListener('click', () => {
			const selectedFiles: TFile[] = [];
			fileList.querySelectorAll('input[type="checkbox"]:checked').forEach((cb: HTMLInputElement) => {
				const filePath = cb.id.replace('file-', '');
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
					selectedFiles.push(file);
				}
			});
			
			this.selectedFiles = selectedFiles;
			this.updateFileList();
			this.updateProcessButton();
			modal.close();
		});

		modal.open();
	}

	private updateFileList() {
		this.fileListEl.empty();
		
		if (this.selectedFiles.length === 0) {
			this.fileListEl.createEl('p', { 
				text: t(this.plugin.settings.language, 'no_files_selected'),
				cls: 'no-files-message'
			});
			return;
		}

		this.selectedFiles.forEach((file, index) => {
			const fileItem = this.fileListEl.createDiv('selected-file-item');
			fileItem.createEl('span', { text: `${index + 1}. ${file.path}` });
			
			const removeBtn = fileItem.createEl('button', { 
				text: '×',
				cls: 'remove-file-btn'
			});
			removeBtn.addEventListener('click', () => {
				this.selectedFiles = this.selectedFiles.filter(f => f !== file);
				this.updateFileList();
				this.updateProcessButton();
			});
		});
	}

	private updateProcessButton() {
		if (this.processButton) {
			this.processButton.disabled = this.selectedFiles.length === 0;
		}
	}

	private async processFiles() {
		if (this.selectedFiles.length === 0) return;

		this.isProcessing = true;
		this.shouldStop = false;
		this.showProcessingModal();
		
		try {
			let successCount = 0;
			let errorCount = 0;

			for (let i = 0; i < this.selectedFiles.length; i++) {
				// Check if user wants to stop
				if (this.shouldStop) {
					break;
				}

				const file = this.selectedFiles[i];
				const remainingFiles = this.selectedFiles.length - i - 1;
				
				// Update progress modal
				this.updateProgressModal(file.path, remainingFiles);

				try {
					// Open the file in editor
					await this.app.workspace.getLeaf().openFile(file);
					
					// Process the file based on the selected feature
					if (this.feature === 'punctuate') {
						await punctuate(this.plugin);
					} else if (this.feature === 'cosmetic') {
						await cosmetic_cleanup(this.plugin);
					} else if (this.feature === 'split') {
						await divide_by_topics(this.plugin);
					} else if (this.feature === 'summarize') {
						await summarize(this.plugin);
					}
					
					successCount++;
				} catch (error) {
					console.error(`Error processing file ${file.path}:`, error);
					errorCount++;
				}
			}

			// Show results
			this.hideProcessingModal();
			const message = t(this.plugin.settings.language, 'batch_process_complete')
				.replace('{success}', successCount.toString())
				.replace('{errors}', errorCount.toString());
			
			new Notice(message);
			
			// Close the modal after successful processing
			if (errorCount === 0 && !this.shouldStop) {
				this.close();
			}
		} catch (error) {
			this.hideProcessingModal();
			console.error('Batch processing error:', error);
			new Notice(t(this.plugin.settings.language, 'batch_process_error'));
		} finally {
			this.isProcessing = false;
		}
	}

	private showProcessingModal(): void {
		this.processingModal = new Modal(this.app);
		this.processingModal.titleEl.setText(t(this.plugin.settings.language, 'batch_processing_title'));
		
		const content = this.processingModal.contentEl;
		
		// Create progress info container
		const progressContainer = content.createDiv('batch-progress-container');
		
		// Current file info
		this.currentFileEl = progressContainer.createEl('p', { 
			text: '',
			cls: 'current-file-info'
		});
		
		// Remaining files info
		this.remainingFilesEl = progressContainer.createEl('p', { 
			text: '',
			cls: 'remaining-files-info'
		});
		
		// Stop button
		const stopButton = content.createEl('button', {
			text: t(this.plugin.settings.language, 'stop_processing'),
			cls: 'mod-warning stop-button'
		});
		
		stopButton.addEventListener('click', () => {
			this.shouldStop = true;
			stopButton.disabled = true;
			stopButton.textContent = t(this.plugin.settings.language, 'stopping') || 'Stopping...';
		});
		
		this.processingModal.open();
	}

	private updateProgressModal(currentFilePath: string, remainingFiles: number): void {
		if (!this.processingModal) return;
		
		const lang = this.plugin.settings.language;
		
		// Update current file info
		if (this.currentFileEl) {
			this.currentFileEl.textContent = `${t(lang, 'processing_file')}: ${currentFilePath}`;
		}
		
		// Update remaining files info
		if (this.remainingFilesEl) {
			this.remainingFilesEl.textContent = `${remainingFiles} ${t(lang, 'files_remaining')}`;
		}
	}

	private hideProcessingModal(): void {
		if (this.processingModal) {
			this.processingModal.close();
			this.processingModal = null;
		}
	}

	private addStyles() {
		const style = document.createElement('style');
		style.textContent = `
			/* Batch process button styles */
			.batch-process-btn {
				width: 32px !important;
				height: 32px !important;
				min-width: 32px !important;
				min-height: 32px !important;
				padding: 0 !important;
				margin: 0 4px !important;
				border-radius: 4px !important;
				font-size: 16px !important;
				display: inline-flex !important;
				align-items: center !important;
				justify-content: center !important;
				background-color: var(--interactive-accent) !important;
				color: var(--text-on-accent) !important;
				border: 1px solid var(--interactive-accent) !important;
				transition: all 0.2s ease !important;
			}

			.batch-process-btn:hover {
				background-color: var(--interactive-accent-hover) !important;
				border-color: var(--interactive-accent-hover) !important;
				transform: translateY(-1px) !important;
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
			}

			.batch-process-btn:active {
				transform: translateY(0) !important;
				box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) !important;
			}

			/* Batch process modal styles */
			.batch-files-container {
				margin: 16px 0;
				padding: 12px;
				background-color: var(--background-secondary);
				border-radius: 6px;
				border: 1px solid var(--background-modifier-border);
			}

			.batch-files-list {
				max-height: 200px;
				overflow-y: auto;
				margin-top: 8px;
			}

			.selected-file-item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 6px 8px;
				margin: 4px 0;
				background-color: var(--background-primary);
				border-radius: 4px;
				border: 1px solid var(--background-modifier-border);
			}

			.remove-file-btn {
				background: none;
				border: none;
				color: var(--text-error);
				cursor: pointer;
				font-size: 18px;
				font-weight: bold;
				padding: 2px 6px;
				border-radius: 3px;
				transition: background-color 0.2s ease;
			}

			.remove-file-btn:hover {
				background-color: var(--background-modifier-error);
			}

			.no-files-message {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 16px;
			}

			/* File selection modal styles */
			.file-selection-list {
				max-height: 300px;
				overflow-y: auto;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				padding: 8px;
				background-color: var(--background-primary);
			}

			.file-selection-item {
				display: flex;
				align-items: center;
				padding: 6px 8px;
				margin: 2px 0;
				border-radius: 4px;
				cursor: pointer;
				transition: background-color 0.2s ease;
			}

			.file-selection-item:hover {
				background-color: var(--background-modifier-hover);
			}

			.file-selection-item input[type="checkbox"] {
				margin-right: 8px;
			}

			.file-selection-buttons {
				display: flex;
				gap: 8px;
				margin: 12px 0;
			}

			.file-selection-buttons button {
				padding: 6px 12px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background-color: var(--background-primary);
				color: var(--text-normal);
				cursor: pointer;
				transition: all 0.2s ease;
			}

			.file-selection-buttons button:hover {
				background-color: var(--background-modifier-hover);
				border-color: var(--interactive-accent);
			}

			/* Search input styles */
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

			/* Folder selection styles */
			.folder-selection-list {
				max-height: 300px;
				overflow-y: auto;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				padding: 8px;
				background-color: var(--background-primary);
			}

			.folder-selection-item {
				display: flex;
				align-items: center;
				padding: 8px 12px;
				margin: 2px 0;
				border-radius: 4px;
				cursor: pointer;
				transition: background-color 0.2s ease;
			}

			.folder-selection-item:hover {
				background-color: var(--background-modifier-hover);
			}

			.folder-selection-item input[type="checkbox"] {
				margin-right: 12px;
			}

			.folder-content {
				display: flex;
				align-items: center;
				flex: 1;
			}

			.folder-icon {
				margin-right: 8px;
				font-size: 16px;
			}

			.folder-path {
				font-family: var(--font-monospace);
				font-size: 13px;
				color: var(--text-normal);
			}

			.folder-info {
				display: flex;
				flex-direction: column;
			}

			.folder-file-count {
				font-size: 11px;
				color: var(--text-muted);
				margin-top: 2px;
			}

			/* Progress modal styles */
			.batch-progress-container {
				margin: 16px 0;
				padding: 16px;
				background-color: var(--background-secondary);
				border-radius: 6px;
				border: 1px solid var(--background-modifier-border);
			}

			.current-file-info {
				font-weight: 600;
				color: var(--text-normal);
				margin-bottom: 8px;
				word-break: break-all;
			}

			.remaining-files-info {
				color: var(--text-muted);
				font-size: 14px;
				margin-bottom: 16px;
			}

			.stop-button {
				width: 100%;
				padding: 8px 16px;
				font-size: 14px;
				font-weight: 600;
			}
		`;
		document.head.appendChild(style);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
