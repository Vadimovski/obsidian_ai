import { App, PluginSettingTab, Setting } from "obsidian";
import TextProcessingPlugin from "#/main";

// Class representing the settings tab for the plugin
export default class TextProcessingSettingTab extends PluginSettingTab {
	plugin: TextProcessingPlugin; // Instance of the plugin
	public app: App; // Instance of the application

	constructor(app: App, plugin: TextProcessingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.app = app;
	}

	// Method to display the settings in the tab
	display(): void {
		this.clearContainer(); // Clear the existing container elements
		this.createProviderDropdown();
		this.createApiKeySetting(); // Create the API key setting
		this.createDebugToggle(); // Create the debug toggle
		this.createModelDropdown(); // Create the model dropdown
		this.createOllamaUrlSetting();
		this.createLogDirectorySetting();
	}

	// Method to clear the container of previous settings
	private clearContainer(): void {
		this.containerEl.empty(); // Remove all child elements from the container
	}

	// Provider select
	private createProviderDropdown(): void {
		new Setting(this.containerEl)
			.setName("Provider")
			.setDesc("Choose AI provider")
			.addDropdown(dropdown =>
				dropdown
					.addOptions({
						"openai": "OpenAI",
						"ollama": "Ollama (local)",
					})
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						await this.updateSettings("provider", value);
						this.display();
					})
			);
	}

	// Method to create the OpenAI API key setting
	private createApiKeySetting(): void {
		if (this.plugin.settings.provider !== 'openai') return;
		new Setting(this.containerEl)
			.setName("OpenAI API Key")
			.setDesc("Generate at https://platform.openai.com")
			.addText(text =>
				text
					.setPlaceholder("Enter your OpenAI API key")
					.setValue(this.plugin.settings.api_key) // Set the initial value
					.onChange(async (value) => this.updateSettings("api_key", value)) // Update the API key on change
			);
	}
	
	// Method to create debug toggle
	private createDebugToggle(): void {
		new Setting(this.containerEl)
			.setName("Debug Mode")
			.setDesc("Creates log files for debugging")
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.debug) // Set the initial value
					.onChange(async (value) => this.updateSettings("debug", value)) // Update the debug mode on change
			);
	}

	// Method to create a dropdown menu for selecting the model
	private createModelDropdown(): void {
		new Setting(this.containerEl)
			.setName("Model")
			.setDesc("Select a model")
			.addDropdown(dropdown =>
				dropdown
					.addOptions(this.plugin.settings.provider === 'openai' ? {
						"gpt-3.5-turbo-1106": "GPT-3.5-turbo",
						"gpt-4": "GPT-4",
						"gpt-4o": "GPT-4o",
						"gpt-4o-mini": "GPT-4o-mini",
					} : {
						"llama3:latest": "llama3:latest",
						"qwq:latest": "qwq:latest",
						"bge-m3:latest": "bge-m3:latest",
					})
					.setValue(this.plugin.settings.model) // Set the initial value
					.onChange(async (value) => this.updateSettings("model", value)) // Update the model on change
			);

	}

	// Ollama URL setting
	private createOllamaUrlSetting(): void {
		if (this.plugin.settings.provider !== 'ollama') return;
		new Setting(this.containerEl)
			.setName("Ollama Base URL")
			.setDesc("Default http://localhost:11434")
			.addText(text =>
				text
					.setPlaceholder("http://localhost:11434")
					.setValue(this.plugin.settings.ollama_base_url)
					.onChange(async (value) => this.updateSettings("ollama_base_url", value))
			);
	}

	// Log directory setting
	private createLogDirectorySetting(): void {
		new Setting(this.containerEl)
			.setName("Log Directory")
			.setDesc("Directory for debug logs (relative to vault root)")
			.addText(text =>
				text
					.setPlaceholder("file-handler_logs")
					.setValue(this.plugin.settings.log_directory)
					.onChange(async (value) => this.updateSettings("log_directory", value))
			);
	}

	// Method to update the plugin settings
	private async updateSettings(name: string, value: any): Promise<void> {
		(this.plugin.settings as any)[name] = value;
		await this.plugin.saveSettings();
	}
}
