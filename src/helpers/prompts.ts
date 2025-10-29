export const DEFAULT_PUNCTUATE_PROMPT = `Add punctuation marks to the text.

Guidelines:
- Insert proper punctuation marks (commas, periods, question marks, exclamation points, colons, semicolons, quotation marks, dashes, etc.) according to the grammar rules of the text's language.
- Do NOT change or correct wording, spelling, capitalization, or sentence structure — only add or adjust punctuation and spacing.
- Preserve all line breaks and spacing exactly as in the original text (except for mandatory spaces after punctuation).

Output:
- Provide ONLY the punctuated text. Do not include explanations or comments.`;

export const DEFAULT_SPLIT_PROMPT = `Divide the text into topics.

Topic Naming:
- Use broad, descriptive titles that capture the essence of each thematic cluster.
- Avoid narrow or overly specific labels; prefer names that could encompass several detailed points.
- Topic names must be written in the same language as the input text.

Notes:
- A topic should summarize a paragraph or a coherent block of sentences; do NOT create a separate topic for every sentence.
- Generate at least 1 and no more than 5 topics total.
- The topic name will be placed before the sentence number where that topic starts.

Keep in Mind:
- What primary subject domains does the text cover?
- How do detailed subtopics cluster thematically?
- What high-level narrative or conceptual threads run through the text?

Output format (one topic per line):
<sentence number where the topic starts>: <Topic name>

Output example:
1: Cars
15: Planes
23: Ships`;

export const DEFAULT_SUMMARIZE_PROMPT = `I have the text, and I would like you to create a short summary of the text.
The summary should include only a plain text. Remove all the headings`;

export const DEFAULT_COSMETIC_PROMPT = `You are a careful copy editor. Perform a light cosmetic cleanup of the input text.

Your tasks:
1) **Spelling:** Fix typos and obvious spelling mistakes.
2) **Proper Names:** Ensure all proper names (brands, games, people, places) are spelled correctly in their official language and form. If the text is not in English, add the official English name in parentheses after the original.
   Example: Вархаммер → Вархаммер (Warhammer 40,000)
3) **Duplicates:** Remove accidental word or text duplications.
4) **Punctuation:** Perform a light punctuation check (basic commas, periods, dashes, quotation marks, spacing), but do not restructure sentences.
5) **Dictionary:** If a dictionary is provided, strictly apply the given mappings (key → value) to normalize words and terms.

Rules:
- Do not change the meaning or tone of the text.
- Do not rewrite or paraphrase sentences.
- Preserve all line breaks and spacing except when fixing errors.
- Use consistent quotation marks appropriate for the language.
- Do not add comments or explanations in the output.
- If you are uncertain about the meaning of a word or its correct form, **do not change it**. Leave the word exactly as it appears in the original text.

Dictionary:`;

