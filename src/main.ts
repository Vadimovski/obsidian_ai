import {addIcon, Plugin, TFile} from 'obsidian';
import TextProcessingSettingTab from "./ui/settings-page";
import { DEFAULT_SETTINGS, pluginSettings } from "./default-settings";
import { ProcessModal } from "./ui/process-modal";
import {PLUGIN_ICON} from "#/ui/styles/constatnts";

export default class TextProcessingPlugin extends Plugin {
	settings: pluginSettings;

	async onload() {
		await this.loadSettings();

		// Add the plugin icon
		addIcon('ai', PLUGIN_ICON);

		// Register a file menu item to trigger GPT processing
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile)) return;

				menu.addItem((item) => {
					item
						.setTitle("File Handler AI")
						.setIcon('ai')
						.onClick(async () => {
							// If the selected item is a file, open it in the editor
							await this.app.workspace.getLeaf().openFile(file);
							// Open a modal to start processing
							new ProcessModal(this.app, this).open();
						});
				});
			})
		);

		// Register an editor menu item to trigger GPT processing
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu) => {
				menu.addItem((item) => {
					item
						.setTitle("File Handler AI")
						.setIcon("ai")
						.onClick(async () => {
							// Open a modal to start processing
							new ProcessModal(this.app, this).open();
						});
				});
			})
		);

		// Add a settings tab to allow user configuration of the plugin
		this.addSettingTab(new TextProcessingSettingTab(this.app, this));
	}

	// Load plugin settings from storage
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// Save plugin settings to storage
	async saveSettings() {
		await this.saveData(this.settings);
	}
}
