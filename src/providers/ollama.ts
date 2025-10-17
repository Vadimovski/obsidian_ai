import TextProcessingPlugin from "#/main";

// Simple fetch-based chat completion for Ollama API
export async function getOllamaResponse(system_prompt: string, user_prompt: string, plugin: TextProcessingPlugin, opts?: { temperature?: number; top_p?: number; }): Promise<string> {
	const baseUrl = plugin.settings.ollama_base_url || 'http://localhost:11434';
	const model = plugin.settings.model || 'llama3:latest';

    const body = {
		model,
		messages: [
			{ role: 'system', content: system_prompt },
			{ role: 'user', content: user_prompt },
		],
		stream: false,
        options: {
            temperature: opts?.temperature ?? 0.1,
            top_p: opts?.top_p ?? 0.7,
        },
	};

	try {
		const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		if (!resp.ok) {
			throw new Error(`Ollama HTTP ${resp.status}`);
		}
		const json = await resp.json();
		// Try OpenAI-compatible response first
		if (json && json.choices && json.choices.length > 0) {
			return json.choices[0].message?.content ?? '';
		}
		// Fallback to native Ollama schema if using /api/chat
		if (json && json.message && json.message.content) {
			return json.message.content;
		}
		return '';
	} catch (e) {
		console.error('Ollama request failed', e);
		throw e;
	}
}






