import { App, Modal, Setting } from "obsidian";
import TextProcessingPlugin from "#/main";
import { t } from "#/ui/i18n";
import { DEFAULT_PUNCTUATE_PROMPT, DEFAULT_SPLIT_PROMPT, DEFAULT_SUMMARIZE_PROMPT, DEFAULT_COSMETIC_PROMPT } from "#/helpers/prompts";

type FeatureKey = 'punctuate' | 'cosmetic' | 'split' | 'summarize';

export class FeatureManageModal extends Modal {
    private readonly plugin: TextProcessingPlugin;
    private readonly feature: FeatureKey;

    constructor(app: App, plugin: TextProcessingPlugin, feature: FeatureKey) {
        super(app);
        this.plugin = plugin;
        this.feature = feature;
    }

    onOpen(): void {
        const { contentEl } = this;
        const lang = this.plugin.settings.language;

        // Make modal wider overall
        (this.modalEl as HTMLElement).style.maxWidth = 'none';
        (this.modalEl as HTMLElement).style.width = '53.33vw';
        contentEl.style.width = '100%';

        const featureDescKey = this.getDescKey();
        const featureExampleKey = this.getExampleKey();

        // Header uses specific feature name
        contentEl.createEl('h2', { text: t(lang, this.getTitleKey()) });

        // Description row: style varies by feature
        if (this.feature === 'punctuate') {
            new Setting(contentEl)
                .setName(t(lang, featureDescKey));
        } else if (this.feature === 'cosmetic' || this.feature === 'split' || this.feature === 'summarize') {
            const descEl = document.createElement('div');
            descEl.textContent = t(lang, featureDescKey);
            descEl.style.fontWeight = '600';
            descEl.style.margin = '8px 0 6px 0';
            contentEl.appendChild(descEl);
        } else {
            new Setting(contentEl)
                .setName(t(lang, 'feature_description'))
                .setDesc(t(lang, featureDescKey));
        }

        // Punctuate feature-specific toggles
        if (this.feature === 'punctuate') {
            new Setting(contentEl)
                .setName(t(lang, 'punctuate_preserve_headings_name'))
                .setDesc(t(lang, 'punctuate_preserve_headings_desc'))
                .addToggle(toggle =>
                    toggle
                        .setValue(this.plugin.settings.punctuatePreserveHeadings ?? true)
                        .onChange(async (value) => {
                            this.plugin.settings.punctuatePreserveHeadings = value;
                            await this.plugin.saveSettings();
                        })
                );

            // Chunk size slider + Save/Reset
            const chunkSetting = new Setting(contentEl)
                .setName(t(lang, 'punctuate_chunk_name'))
                .setDesc(t(lang, 'punctuate_chunk_desc'));

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '100';
            slider.max = '10000';
            slider.step = '100';
            const current = (this.plugin.settings.punctuateChunkSize ?? 1000);
            slider.value = String(current);
            slider.style.width = '60%';

            const valueLabel = document.createElement('span');
            valueLabel.textContent = ` ${current}`;
            valueLabel.style.marginLeft = '8px';

            slider.addEventListener('input', () => {
                valueLabel.textContent = ` ${slider.value}`;
            });

            chunkSetting.controlEl.appendChild(slider);
            chunkSetting.controlEl.appendChild(valueLabel);

            // Save
            chunkSetting.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'apply'))
                    .setIcon('checkmark')
                    .onClick(async () => {
                        const v = Math.max(100, Math.min(10000, parseInt(slider.value, 10) || 1000));
                        this.plugin.settings.punctuateChunkSize = v;
                        await this.plugin.saveSettings();
                    });
            });
            // Reset to default
            chunkSetting.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'reset_to_default'))
                    .setIcon('reset')
                    .onClick(async () => {
                        this.plugin.settings.punctuateChunkSize = 1000;
                        await this.plugin.saveSettings();
                        slider.value = '1000';
                        valueLabel.textContent = ' 1000';
                    });
            });
        }

        // Split feature-specific chunk size slider
        if (this.feature === 'split') {
            const chunkSetting = new Setting(contentEl)
                .setName(t(lang, 'split_chunk_name'))
                .setDesc(t(lang, 'split_chunk_desc'));

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '100';
            slider.max = '10000';
            slider.step = '100';
            const current = (this.plugin.settings.splitChunkSize ?? 1000);
            slider.value = String(current);
            slider.style.width = '60%';

            const valueLabel = document.createElement('span');
            valueLabel.textContent = ` ${current}`;
            valueLabel.style.marginLeft = '8px';

            slider.addEventListener('input', () => {
                valueLabel.textContent = ` ${slider.value}`;
            });

            chunkSetting.controlEl.appendChild(slider);
            chunkSetting.controlEl.appendChild(valueLabel);

            // Save
            chunkSetting.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'apply'))
                    .setIcon('checkmark')
                    .onClick(async () => {
                        const v = Math.max(100, Math.min(10000, parseInt(slider.value, 10) || 1000));
                        this.plugin.settings.splitChunkSize = v;
                        await this.plugin.saveSettings();
                    });
            });
            // Reset to default
            chunkSetting.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'reset_to_default'))
                    .setIcon('reset')
                    .onClick(async () => {
                        this.plugin.settings.splitChunkSize = 1000;
                        await this.plugin.saveSettings();
                        slider.value = '1000';
                        valueLabel.textContent = ' 1000';
                    });
            });
        }

        // For cosmetic: Dictionary and chunk size before prompt
        let cosmeticKeyInput: HTMLInputElement | null = null;
        let cosmeticValueInput: HTMLInputElement | null = null;
        let cosmeticDictContainer: HTMLDivElement | null = null;

        if (this.feature === 'cosmetic') {
            const dictHeader = new Setting(contentEl)
                .setName(t(lang, 'dictionary'))
                .setDesc(t(lang, 'dictionary_desc'));

            const row = new Setting(contentEl);

            cosmeticKeyInput = document.createElement('input');
            cosmeticKeyInput.type = 'text';
            cosmeticKeyInput.placeholder = t(lang, 'dictionary_key_placeholder');
            cosmeticKeyInput.style.width = '40%';
            row.controlEl.appendChild(cosmeticKeyInput);

            const arrow = document.createElement('span');
            arrow.textContent = '  ->  ';
            arrow.style.margin = '0 8px';
            row.controlEl.appendChild(arrow);

            cosmeticValueInput = document.createElement('input');
            cosmeticValueInput.type = 'text';
            cosmeticValueInput.placeholder = t(lang, 'dictionary_value_placeholder');
            cosmeticValueInput.style.width = '40%';
            row.controlEl.appendChild(cosmeticValueInput);

            row.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'save_pair'))
                    .setIcon('checkmark')
                    .onClick(async () => {
                        const key = cosmeticKeyInput!.value.trim();
                        const value = cosmeticValueInput!.value.trim();
                        if (!key || !value) return;
                        const dict = Array.isArray(this.plugin.settings.cosmeticDictionary) ? this.plugin.settings.cosmeticDictionary : [];
                        const idx = dict.findIndex(p => p.key === key);
                        if (idx >= 0) dict[idx] = { key, value }; else dict.push({ key, value });
                        this.plugin.settings.cosmeticDictionary = dict;
                        await this.plugin.saveSettings();
                        cosmeticKeyInput!.value = '';
                        cosmeticValueInput!.value = '';
                        if (cosmeticDictContainer) this.renderDictionaryList(cosmeticDictContainer, cosmeticKeyInput!, cosmeticValueInput!);
                    });
            });

            cosmeticDictContainer = document.createElement('div');
            cosmeticDictContainer.style.marginTop = '8px';
            contentEl.appendChild(cosmeticDictContainer);
            this.renderDictionaryList(cosmeticDictContainer, cosmeticKeyInput, cosmeticValueInput);

            // Chunk size slider (characters)
            const chunkSetting = new Setting(contentEl)
                .setName(t(lang, 'cosmetic_chunk_size'));

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '100';
            slider.max = '10000';
            slider.step = '100';
            const current = (this.plugin.settings.cosmeticChunkSize ?? 1000);
            slider.value = String(current);
            slider.style.width = '60%';

            const valueLabel = document.createElement('span');
            valueLabel.textContent = ` ${current}`;
            valueLabel.style.marginLeft = '8px';

            slider.addEventListener('input', () => {
                valueLabel.textContent = ` ${slider.value}`;
            });

            chunkSetting.controlEl.appendChild(slider);
            chunkSetting.controlEl.appendChild(valueLabel);

            chunkSetting.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'apply'))
                    .setIcon('checkmark')
                    .onClick(async () => {
                        const v = Math.max(100, Math.min(10000, parseInt(slider.value, 10) || 1000));
                        this.plugin.settings.cosmeticChunkSize = v;
                        await this.plugin.saveSettings();
                    });
            });

            chunkSetting.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'reset_to_default'))
                    .setIcon('reset')
                    .onClick(async () => {
                        this.plugin.settings.cosmeticChunkSize = 1000;
                        await this.plugin.saveSettings();
                        slider.value = '1000';
                        valueLabel.textContent = ' 1000';
                    });
            });
        }

        // Summarize feature-specific chunk size slider
        if (this.feature === 'summarize') {
            const chunkSetting = new Setting(contentEl)
                .setName(t(lang, 'summarize_chunk_name'))
                .setDesc(t(lang, 'summarize_chunk_desc'));

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '100';
            slider.max = '10000';
            slider.step = '100';
            const current = (this.plugin.settings.summarizeChunkSize ?? 5000);
            slider.value = String(current);
            slider.style.width = '60%';

            const valueLabel = document.createElement('span');
            valueLabel.textContent = ` ${current}`;
            valueLabel.style.marginLeft = '8px';

            slider.addEventListener('input', () => {
                valueLabel.textContent = ` ${slider.value}`;
            });

            chunkSetting.controlEl.appendChild(slider);
            chunkSetting.controlEl.appendChild(valueLabel);

            // Save
            chunkSetting.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'apply'))
                    .setIcon('checkmark')
                    .onClick(async () => {
                        const v = Math.max(100, Math.min(10000, parseInt(slider.value, 10) || 5000));
                        this.plugin.settings.summarizeChunkSize = v;
                        await this.plugin.saveSettings();
                    });
            });
            // Reset to default
            chunkSetting.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'reset_to_default'))
                    .setIcon('reset')
                    .onClick(async () => {
                        this.plugin.settings.summarizeChunkSize = 5000;
                        await this.plugin.saveSettings();
                        slider.value = '5000';
                        valueLabel.textContent = ' 5000';
                    });
            });
        }

        // Prompt editor
        const promptContainer = new Setting(contentEl)
            .setName(t(lang, 'prompt'));

        const textarea = document.createElement('textarea');
        textarea.style.width = '133%';
        textarea.style.minHeight = '240px';
        textarea.style.boxSizing = 'border-box';
        promptContainer.controlEl.style.overflowX = 'auto';
        textarea.value = this.getEffectivePrompt();
        promptContainer.controlEl.appendChild(textarea);

        // Apply / Reset buttons
        promptContainer.addExtraButton(btn => {
            btn.setTooltip(t(lang, 'apply'))
                .setIcon('checkmark')
                .onClick(async () => {
                    this.setCustomPrompt(textarea.value);
                    await this.plugin.saveSettings();
                });
        });

        promptContainer.addExtraButton(btn => {
            btn.setTooltip(t(lang, 'reset_to_default'))
                .setIcon('reset')
                .onClick(async () => {
                    this.setCustomPrompt(undefined);
                    await this.plugin.saveSettings();
                    textarea.value = this.getEffectivePrompt();
                });
        });

        // Example row: hide for punctuate, cosmetic, split, and summarize features
        if (this.feature !== 'punctuate' && this.feature !== 'cosmetic' && this.feature !== 'split' && this.feature !== 'summarize') {
            new Setting(contentEl)
                .setName(t(lang, 'feature_example'))
                .setDesc(t(lang, featureExampleKey));
        }
    }

    private renderDictionaryList(listContainer: HTMLElement, keyInput: HTMLInputElement, valueInput: HTMLInputElement) {
        const lang = this.plugin.settings.language;
        // Clear previous contents
        while (listContainer.firstChild) listContainer.removeChild(listContainer.firstChild);

        const dict = Array.isArray(this.plugin.settings.cosmeticDictionary) ? this.plugin.settings.cosmeticDictionary : [];

        dict.forEach((pair, index) => {
            const item = new Setting(listContainer)
                .setName(`${pair.key} -> ${pair.value}`);

            // Revert (edit) button
            item.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'revert'))
                    .setIcon('reset')
                    .onClick(() => {
                        keyInput.value = pair.key;
                        valueInput.value = pair.value;
                    });
            });

            // Delete button
            item.addExtraButton(btn => {
                btn.setTooltip(t(lang, 'delete'))
                    .setIcon('cross')
                    .onClick(async () => {
                        const dictNow = Array.isArray(this.plugin.settings.cosmeticDictionary) ? this.plugin.settings.cosmeticDictionary : [];
                        dictNow.splice(index, 1);
                        this.plugin.settings.cosmeticDictionary = dictNow;
                        await this.plugin.saveSettings();
                        this.renderDictionaryList(listContainer, keyInput, valueInput);
                    });
            });
        });
    }

    private getTitleKey(): string {
        switch (this.feature) {
            case 'punctuate':
                return 'punctuate_name';
            case 'cosmetic':
                return 'cosmetic_name';
            case 'split':
                return 'split_name';
            case 'summarize':
                return 'summarize_name';
        }
    }

    private getDescKey(): string {
        switch (this.feature) {
            case 'punctuate':
                return 'punctuate_desc';
            case 'cosmetic':
                return 'cosmetic_desc';
            case 'split':
                return 'split_desc';
            case 'summarize':
                return 'summarize_desc';
        }
    }

    private getExampleKey(): string {
        switch (this.feature) {
            case 'punctuate':
                return 'punctuate_example';
            case 'cosmetic':
                return 'cosmetic_example';
            case 'split':
                return 'split_desc'; // reuse description if no specific example
            case 'summarize':
                return 'summarize_example';
        }
    }

    private getEffectivePrompt(): string {
        const custom = this.plugin.settings.customPrompts ?? {};
        if (this.feature === 'punctuate') return custom.punctuate ?? DEFAULT_PUNCTUATE_PROMPT;
        if (this.feature === 'cosmetic') return custom.cosmetic ?? DEFAULT_COSMETIC_PROMPT;
        if (this.feature === 'split') return custom.split ?? DEFAULT_SPLIT_PROMPT;
        return custom.summarize ?? DEFAULT_SUMMARIZE_PROMPT;
    }

    private setCustomPrompt(value: string | undefined): void {
        const store = this.plugin.settings.customPrompts ?? {};
        if (this.feature === 'punctuate') store.punctuate = value;
        else if (this.feature === 'cosmetic') store.cosmetic = value;
        else if (this.feature === 'split') store.split = value;
        else store.summarize = value;
        this.plugin.settings.customPrompts = store;
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}


