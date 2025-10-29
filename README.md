# File Handler AI — AI text processing for Obsidian

The plugin leverages AI (OpenAI or Ollama) to automate text cleanup, topic-based splitting, and summarization. It also supports batch processing, custom prompts, dictionaries, and a text comparison tool.

![preview](preview.jpg)

## Features

- **Punctuation**: Add proper punctuation to raw text
- **Cosmetic cleanup**: Light formatting and fixes with custom dictionary (key → value)
- **Topic separation**: Split text into topic-based sections
- **Summarization**: Iterative, chunk-based summarization into a concise result
- **Batch processing**: Apply a feature to many files/folders at once
- **Text comparison**: Compare original and processed files side-by-side
- **Custom prompts**: Override default prompts per feature
- **Multi-language UI**: en, zh-CN, es, pt, fr, de, ru, ja
- **Providers**: OpenAI GPT and local Ollama

## Installation

### From Community Plugins (recommended)
Search for `File Handler AI` in the Obsidian Community Plugins browser and install it.

### Manual installation
1. Go to your vault folder:
```
cd path/to/vault
mkdir -p .obsidian/plugins
cd .obsidian/plugins
```
2. Clone the repository:
```
git clone https://github.com/Vadimovski/obsidian_ai.git file-handler-ai
```
3. Install and build:
```
cd file-handler-ai
npm install
npm run build
```
4. In Obsidian: Settings → Community plugins → Turn on → enable `File Handler AI`.

## Usage

- Right-click a file in the file explorer or open the editor menu to launch processing
- Choose a feature: punctuate, cosmetic, split by topics, summarize
- Optionally run batch processing from the modal to process multiple files/folders

## Settings

- **Provider**: OpenAI or Ollama
  - OpenAI: requires API key
  - Ollama: uses local base URL and model
- **Model**: e.g. `gpt-4o-mini` (default)
- **Chunk sizes**: tune per feature for large documents
- **Custom prompts**: per-feature overrides
- **Dictionary**: key → value mappings for cosmetic cleanup
- **Language**: UI translations (en, zh-CN, es, pt, fr, de, ru, ja)
- **Backups**: create a backup copy before processing

## How it works

- Topic separation and summarization use chunking with careful boundaries to preserve context
- Summarization iteratively condenses intermediate results until a final summary remains

## Releasing

When publishing a new version:
- Update `manifest.json` and `versions.json` with matching versions
- Create a GitHub release and attach `main.js`, `manifest.json` (and `styles.css` if present)
- Submit your plugin to `obsidian-releases` if this is the first public release

## Troubleshooting

- Open the Developer Console to see logs: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
- Ensure an API key is set for OpenAI provider, or that Ollama is running locally

## Links

- Repository: `https://github.com/Vadimovski/obsidian_ai`

## License

MIT
