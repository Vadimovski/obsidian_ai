export const DEFAULT_PUNCTUATE_PROMPT = `Add punctuation marks to the text.

Rules:
- Insert only punctuation marks (commas, periods, question marks, exclamation marks, colons, semicolons, quotation marks, dashes, etc.) according to grammar rules.
- Do NOT remove, replace, or modify any existing punctuation.
- Do NOT modify any words or sentence structure.
- Preserve all spaces and line breaks exactly as in the original text.
- You are STRICTLY FORBIDDEN to insert, remove, or move any newline character (\n) or paragraph break.
- The number of line breaks (\n) in the output must be EXACTLY the same as in the input.
- The output must be a single block of text with the same structure as the input.
- Do NOT format the text in any way other than inserting punctuation.
- Do NOT insert blank lines between sentences.

Output:
Only the punctuated text. No explanations.`;

export const DEFAULT_SPLIT_PROMPT = `Divide the text into logical topics.  
Do not split too frequently.

Topic Naming Rules:
- Each topic title must reflect the specific concept, subtype, or key term being explained in that part of the text.
- Prefer local, content-based nouns that actually appear in the text.
- If several subtypes are listed under a general concept, give each its own specific topic only if they are explained in detail.
- Titles must be short and clear (no more than 7 words).
- Topic names must be written in the same language as the input text.

Heuristics:
- If the text defines or explains a distinct concept, process, or idea, use that definition as the topic title.
- If a sentence introduces a key term and the next sentences describe it — use that key term as the topic title.
- Prioritize nouns over verbs or abstract phrases.
- If several sections are conceptually similar, make sure each has a unique title.
- Generate at least 1 and no more than 7 topics.
- Each topic should summarize a coherent block of sentences, not single lines.
- Avoid creating a new topic unless the content clearly shifts to a different concept.
- If in doubt, merge small sentences into the previous topic rather than starting a new one.

Output format:
<sentence number where the topic starts>: <topic name>

Example of good titles:
1: Introduction to Game Tutorials
5: Game Tutorials: Information Windows
21: Learning as the Core of the Game

Example of bad titles:
1: Game Tutorials
15: Game Tutorials (2)
25: Types of Learning`;

export const DEFAULT_SUMMARIZE_PROMPT = `Write a short summary of the following text.  
• Use plain, continuous text without headings, lists, or bullet points.  
• Do not add personal comments or interpretations.  
• Keep only the key facts, ideas, and logical flow.  
• Avoid repetitions and unnecessary details.  
• The length should be a short, coherent paragraph of no more than 5–7 sentences.`;

export const DEFAULT_COSMETIC_PROMPT = `You are a careful and precise copy editor. Perform a light cosmetic cleanup of the input text.

Your tasks:
1. Spelling: Fix typos and obvious spelling mistakes.
2. Proper Names: Ensure all proper names (brands, games, people, places) are spelled correctly in their official language and form. If the text is not in English, add the official English name in parentheses only if it differs. Do not duplicate identical names.
3. Duplicates: Remove accidental repetitions of words, phrases, or sentences.
4. Punctuation: Perform a light punctuation check (commas, periods, dashes, quotation marks, spacing). Ensure dashes and hyphens are used consistently.
5. Dictionary: If a dictionary is provided, strictly apply the given mappings (key → value) to normalize words and terms. If the key and value are identical (ignoring case and spaces), do not insert duplicates.
6. Formatting: Preserve paragraph breaks and spacing exactly as in the original text, unless you are fixing an obvious formatting error (e.g., duplicated space).
7. Quotes & Numbers: Use consistent quotation marks for the language of the text. Use proper dash characters (e.g., “–” for ranges, “—” for long dashes).
8. Minor Grammar Cleanup: Fix only obvious grammar slips (e.g., typos, wrong word forms, missing prepositions) but do not rewrite or rephrase sentences.

Strict rules:
- Do not change the meaning or tone of the text.
- Do not rewrite or rephrase sentences.
- Do not add or remove content beyond fixing errors.
- Do not insert or remove paragraph breaks or newline characters (\n).
- The number of newline characters in the output must be exactly the same as in the input.
- Do not insert extra empty lines between sentences or paragraphs.
- If uncertain about a word, leave it unchanged.
- Do not add comments or explanations in the output.
- When adding official English names, do not repeat identical text inside parentheses.

Output:
Provide ONLY the processed text. Do not include explanations or comments.`;

