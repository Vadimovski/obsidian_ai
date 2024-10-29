import { App, Modal, Setting } from "obsidian";
import TextProcessingPlugin from "#/main";
import { divide_by_topics, summarize } from "#/helpers/markdownHandlers";

// Class representing a modal for processing text with GPT
export class ProcessModal extends Modal {
	private readonly plugin: TextProcessingPlugin;
	private processButton: Setting;
	private processingButtonEl: HTMLElement;
	// boolean flag for waiting for GPT response
	private static waiting_for_response = false;

	constructor(app: App, plugin: TextProcessingPlugin) {
		super(app);
		this.plugin = plugin;
	}

	// Method called when the modal is opened
	onOpen() {
		const { contentEl } = this;

		// Create header for the modal
		contentEl.createEl('h2', { text: 'File Handler AI' });

		// Create checkbox for splitting text into topics
		new Setting(contentEl)
			.setName('Split into topics')
			.setDesc('Split the text into general topics')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.split ?? false) // Set initial value from settings
				.onChange(async (value) => {
					this.plugin.settings.split = value; // Update setting value
					await this.plugin.saveSettings(); // Save updated settings
					this.updateButtonState(); // Update button state based on settings
				}));

		// Create checkbox for summarizing text
		new Setting(contentEl)
			.setName("Summarize")
			.setDesc("Create a summary of the text. Note that the text should be divided into topics first")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.summarize ?? false) // Set initial value from settings
				.onChange(async (value) => {
					this.plugin.settings.summarize = value; // Update setting value
					await this.plugin.saveSettings(); // Save updated settings
					this.updateButtonState(); // Update button state based on settings
				}));

		// Create the process button
		this.processButton = new Setting(contentEl)
			.addButton(button => {
				this.processingButtonEl = button.buttonEl; // Save reference to button element
				button.setButtonText('Process')
					.onClick(() => this.handleProcessing());
			});

		// Update the initial state of the process button
		this.updateButtonState();
	}

	// Handle the processing and UI blocking
	private async handleProcessing() {
		// If already waiting for response, do nothing
		if (ProcessModal.waiting_for_response) return;

		// Set waiting flag and update UI
		ProcessModal.waiting_for_response = true;
		this.processingButtonEl.setText("Processing... It may take some time");
		this.processButton.setDisabled(true); // Disable the button

		try {
			// Call helper functions based on user selections
			if (this.plugin.settings.split) {
				await divide_by_topics(this.plugin);
			}
			if (this.plugin.settings.summarize) {
				await summarize(this.plugin);
			}
		} finally {
			// Reset UI after processing is done
			this.processingButtonEl.setText("Process");
			this.processButton.setDisabled(false);
			ProcessModal.waiting_for_response = false;
		}
	}

	// Method to update the state of the process button based on settings
	private updateButtonState() {
		if (ProcessModal.waiting_for_response) {
			this.processButton.setDisabled(true);
			this.processingButtonEl.setText('Processing... It may take some time');
		} else {
			// Enable button if any processing option is selected
			this.processButton.setDisabled(!(this.plugin.settings.split || this.plugin.settings.summarize));
		}
	}

	// Method called when the modal is closed
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
