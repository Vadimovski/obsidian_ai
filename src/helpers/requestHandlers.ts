import TextProcessingPlugin from "#/main";
import { getChatGPTResponse } from "#/providers/openai";
import { getOllamaResponse } from "#/providers/ollama";
import { Notice } from "obsidian";
import { DEFAULT_SUMMARIZE_PROMPT, DEFAULT_SPLIT_PROMPT, DEFAULT_COSMETIC_PROMPT } from "#/helpers/prompts";

// Unified router by provider (OpenAI/Ollama)
export async function llmResponse(system_prompt: string, user_prompt: string, plugin: TextProcessingPlugin, opts?: { temperature?: number; top_p?: number; }): Promise<string> {
    const provider = plugin.settings.provider;
    if (provider === 'ollama') {
        // No API key required; uses plugin.settings.ollama_base_url and model
        return await getOllamaResponse(system_prompt, user_prompt, plugin, opts);
    }
    // Default: OpenAI
    return await getChatGPTResponse(system_prompt, user_prompt, plugin, opts);
}

// Default prompts provided by helpers/prompts; can be overridden by user settings

// Function to request topic extraction from OpenAI
export async function topicsRequest(text: string, plugin: TextProcessingPlugin, systemPrompt?: string): Promise<string | null> {
	try {
        const prompt = systemPrompt ?? (plugin.settings.customPrompts?.split ?? DEFAULT_SPLIT_PROMPT);
        const response = await llmResponse(prompt, text, plugin);
        return typeof response === 'string' ? response : (response ?? null);
	} catch (error) {
		console.error("Error in topicsRequest:", error);
		new Notice('Error generating topics');
		return null;
	}
}

// Function to request a summary from OpenAI
export async function summarizeRequest(text: string, plugin: TextProcessingPlugin, systemPrompt?: string): Promise<string | null> {
	try {
        const prompt = systemPrompt ?? (plugin.settings.customPrompts?.summarize ?? DEFAULT_SUMMARIZE_PROMPT);
        const response = await llmResponse(prompt,  text, plugin, { temperature: 0.2, top_p: 0.7 });
        return typeof response === 'string' ? response : (response ?? null);
	} catch (error) {
		console.error("Error in summarizeRequest:", error);
		new Notice('Error generating summary');
		return null;
	}
}

// Function to request cosmetic cleanup (light copy-edit)
export async function cosmeticRequest(text: string, plugin: TextProcessingPlugin, systemPrompt?: string): Promise<string | null> {
    try {
        const basePrompt = systemPrompt ?? (plugin.settings.customPrompts?.cosmetic ?? DEFAULT_COSMETIC_PROMPT);
        // Append dictionary only if we are building the prompt here
        let prompt = basePrompt;
        if (systemPrompt === undefined) {
            const dict = Array.isArray(plugin.settings.cosmeticDictionary) ? plugin.settings.cosmeticDictionary : [];
            const dictSection = dict.length > 0 ? '\n' + dict.map(p => `${p.key} -> ${p.value}`).join('\n') : '';
            prompt = basePrompt + dictSection;
        }
        const response = await llmResponse(prompt, text, plugin, { temperature: 0.0, top_p: 0.9 });
        return typeof response === 'string' ? response : (response ?? null);
    } catch (error) {
        console.error("Error in cosmeticRequest:", error);
        new Notice('Error during Cosmetic Cleanup');
        return null;
    }
}

