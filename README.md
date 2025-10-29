# File Handler AI — AI text processing for Obsidian

The plugin leverages AI to automate text cleanup, topic-based splitting, and summarization. It also supports batch processing, custom prompts, dictionaries, and a text comparison tool.

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
- **Providers**: OpenAI GPT

## Usage

- Right-click a file in the file explorer or open the editor menu to launch processing
- Choose a feature: punctuate, cosmetic, split by topics, summarize
- Optionally run batch processing from the modal to process multiple files/folders
- You can also select a fragment of text in the editor — features will apply only to the selected range

## Settings

- **Provider**: OpenAI: requires API key
- **Model**: e.g. `gpt-4o-mini` (default)
- **Chunk sizes**: tune per feature for large documents
- **Custom prompts**: per-feature overrides
- **Dictionary**: key → value mappings for cosmetic cleanup
- **Language**: UI translations (en, zh-CN, es, pt, fr, de, ru, ja)
- **Backups**: create a backup copy before processing

## How it works

- **Punctuation**: Adds punctuation marks and sentence boundaries to raw or loosely formatted text. Headings can be preserved. Output stays close to original wording but becomes readable.
- **Cosmetic cleanup**: Performs light formatting and small fixes (spaces, minor grammar, consistent style). Optional dictionary replaces terms using your key → value pairs. Output aims to keep the author’s tone.
- **Topic separation**: Splits the document into coherent sections by topic while keeping paragraph integrity. It inserts headings or markers so the structure is easy to navigate and edit later.
- **Summarization**: Produces a concise summary of the document’s main points. Large files are handled in chunks; intermediate results are condensed until a single clean summary remains.

## Troubleshooting

- Open the Developer Console to see logs: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
- Ensure an API key is set for OpenAI provider

## Feedback

- Found a bug or have a feature request? Please open an issue here: `https://github.com/Vadimovski/obsidian_ai/issues`
