import { App, PluginSettingTab, Setting } from "obsidian";
import TextProcessingPlugin from "#/main";
import { t } from "#/ui/i18n";

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
		this.createLanguageDropdown();
		this.createProviderDropdown();
		this.createApiKeySetting(); // Create the API key setting
		this.createModelDropdown(); // Create the model dropdown
		this.createOllamaUrlSetting();
	}

	// Method to clear the container of previous settings
	private clearContainer(): void {
		this.containerEl.empty(); // Remove all child elements from the container
	}

	// Language select
	private createLanguageDropdown(): void {
		const row = new Setting(this.containerEl)
			.setName(t(this.plugin.settings.language, "language"))
			.setDesc(t(this.plugin.settings.language, "choose_language"));

		row.addDropdown(dropdown =>
			dropdown
				.addOptions({
					"en": "English",
					"zh-CN": "中文(简体)",
					"es": "Español",
					"pt": "Português",
					"fr": "Français",
					"de": "Deutsch",
					"ru": "Русский",
					"ja": "日本語",
				})
				.setValue(this.plugin.settings.language ?? 'en')
				.onChange(async (value) => this.updateSettings("language", value))
		);

		row.addExtraButton(btn => {
			btn.setTooltip(t(this.plugin.settings.language, "apply"))
				.setIcon('checkmark')
				.onClick(() => {
					this.display();
				});
		});
	}

	// Provider select
	private createProviderDropdown(): void {
		new Setting(this.containerEl)
			.setName(t(this.plugin.settings.language, "provider"))
			.setDesc(t(this.plugin.settings.language, "provider_desc"))
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
			.setName(t(this.plugin.settings.language, "api_key"))
			.setDesc(t(this.plugin.settings.language, "api_key_desc"))
			.addText(text =>
				text
					.setPlaceholder(t(this.plugin.settings.language, "api_key_placeholder"))
					.setValue(this.plugin.settings.api_key) // Set the initial value
					.onChange(async (value) => this.updateSettings("api_key", value)) // Update the API key on change
			);
	}
	

	// Method to create a dropdown menu for selecting the model
	private createModelDropdown(): void {
		new Setting(this.containerEl)
			.setName(t(this.plugin.settings.language, "model"))
			.setDesc(t(this.plugin.settings.language, "model_desc"))
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
			.setName(t(this.plugin.settings.language, "ollama_url"))
			.setDesc(t(this.plugin.settings.language, "ollama_url_desc"))
			.addText(text =>
				text
					.setPlaceholder("http://localhost:11434")
					.setValue(this.plugin.settings.ollama_base_url)
					.onChange(async (value) => this.updateSettings("ollama_base_url", value))
			);
	}





	// Method to update the plugin settings
	private async updateSettings(name: string, value: any): Promise<void> {
		(this.plugin.settings as any)[name] = value;
		await this.plugin.saveSettings();
	}
}
