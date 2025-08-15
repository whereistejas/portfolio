// readwise-llm.ts
// LLM-powered Readwise queue processing (summarization, tagging, reordering)
// This file is used at build time to generate JSON caches for Astro content collections

import Anthropic from '@anthropic-ai/sdk';

// Types for document input and LLM output
export interface LLMDocumentInput {
	id: string;
	title: string;
	author: string;
	source: string;
	content: string;
}

export interface LLMSummary {
	id: string;
	summary: string;
	tags: string[];
}

export interface LLMReordered {
	order: number;
	id: string;
	tags: string[];
}

// Anthropic client setup
export function getAnthropicClient(apiKey: string) {
	return new Anthropic({
		apiKey,
		timeout: 240000 // 240 seconds = 4 minutes (matching Rust implementation)
	});
}

// Anthropic model name (Claude Sonnet 4)
const ANTHROPIC_MODEL = 'claude-sonnet-4-0'; // Use the latest available Sonnet model

// Summarization prompt (from Rust)
const SUMMARY_PROMPT = `You are my reading assistant. Your job is to look through my reading list and arrange all the items in the best order possible.

My reading list will often have items from a lot of different authors, subjects and themes. I want you to go through each item and try to understand its core ideas. Then, I want you to rearrange my reading list such that I have to context switch as little as possible when I go from one item to another.

For example, you can group all items about "biology" (i.e., based on subject) or group all items from "Siddhartha Mukherjee" (i.e., based on author) or group all items related to "productivity" (i.e., based on theme).

I'm going to give you 1 item at a time. I want you to return to me a summary in whatever structure that makes most sense to you for later retrival and a list of "tokens/tags" that capture the various categories this item could fall into.

The summary should be concise and should not mention thinks like the title or source or author.

Remember, while generating the summary and tags that the final goal is to reorder my reading list, in the best way possible.

Each item will be given to you along with some metadata in the json format:
{
    "id": "uuid",
    "title": "item title",
    "author": "item name",
    "source": "source_url",
    "content": "item content"
}

For each item give output in JSON format with keys: "id" (string), "summary" (string) and "tags" (list of string).
For example,
{
    "id": "<uuid>",
    "summary": "<your summary>",
    "tags": ["your tags"]
}

Remember, to never change the "id" of the item and always, always preserve it.
When adding the summary to the JSON object, always escape characters in order to produce valid JSON.

Do not wrap your JSON response in markdown code blocks or any other formatting. Return only the raw JSON object.

Here is the item:`;

// Summarize a single document using Anthropic LLM
export async function summariseDocument(
	anthropic: Anthropic,
	document: LLMDocumentInput,
	maxRetries = 3
): Promise<LLMSummary> {
	const inputJson = JSON.stringify(document, null, 2);
	const prompt = `${SUMMARY_PROMPT}\n${inputJson}`;

	let lastError: unknown = null;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await anthropic.messages.create({
				model: ANTHROPIC_MODEL,
				max_tokens: 50000,
				messages: [
					{
						role: 'user',
						content: prompt,
					},
				],
			});
			// Anthropic returns the response as a string
			const raw = response.content[0]?.type === 'text' ? response.content[0].text : '';
			// Try to parse the JSON from the response
			const summary: LLMSummary = JSON.parse(raw);
			if (!summary.id || !summary.summary || !Array.isArray(summary.tags)) {
				throw new Error('Malformed summary response');
			}
			return summary;
		} catch (err) {
			lastError = err;
			if (attempt < maxRetries) {
				// Wait before retrying
				await new Promise(res => setTimeout(res, 30000));
			}
		}
	}
	throw new Error(`Failed to summarize document after ${maxRetries} attempts: ${lastError}`);
}

// Reordering prompt (from Rust)
const REORDERING_PROMPT = `You are my reading assistant. Your job is to look through my reading list and arrange all the items in the best order possible.

My reading list will often have items from a lot of different authors, subjects and themes. I want you to go through each item and try to understand its core ideas. Then, I want you to rearrange my reading list such that I have to context switch as little as possible when I go from one item to another.

For example, you can group all items about "biology" (i.e., based on subject) or group all items from "Siddhartha Mukherjee" (i.e., based on author) or group all items related to "productivity" (i.e., based on theme).

After giving you each item, you returned to me a summary in whatever structure that made most sense to you for later retrival and a list of "tokens/tags" that capture the various categories the item could fall into.

After going through all the items in my reading list, I'm giving all of the summaries and tags back to you and asking you to reorder my reading list.
    
Follow these instructions:
- Condense the tags for each item to fit in with the rest of the items, as best as you can. Use the summaries to get more context.
- Each item should only have 5 tags.
- The "index" of each item should be stored in the \`order\` field.
- Feel free to merge tags into higher level topics so that they can used for multiple items.

For each item give output in JSON format with keys: "order" (number), "id" (string) and "tags" (list of string).
For example,
{
    "order": 0,
    "id": "<document id>",
    "tags": ["your tags"]
}

Do not wrap your JSON response in markdown code blocks or any other formatting. Return only the raw JSON object.

STRICTLY NEVER change the "id" of the item and ALWAYS, ALWAYS PRESERVE it.

Thank you for helping me out.`;

// Type for summary cache (matches document-summary-cache.json structure)
export interface SummaryCache {
	[id: string]: {
		summary: string;
		tags: string[];
	};
}

// Reorder and tag documents using Anthropic LLM
export async function tagAndGroupDocuments(
	anthropic: Anthropic,
	summaries: SummaryCache,
	maxRetries = 3
): Promise<{ [id: string]: string[] }> {
	const inputJson = JSON.stringify(summaries, null, 2);
	const prompt = `${REORDERING_PROMPT}\n\`\`\`json\n${inputJson}\n\`\`\``;

	let lastError: unknown = null;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await anthropic.messages.create({
				model: ANTHROPIC_MODEL,
				max_tokens: 50000,
				messages: [
					{
						role: 'user',
						content: prompt,
					},
				],
			});

			const raw = response.content[0]?.type === 'text' ? response.content[0].text : '';
			const reordered: LLMReordered[] = JSON.parse(raw);

			if (!Array.isArray(reordered)) {
				throw new Error('Expected array of reordered items');
			}

			// Sort by order and return as grouped documents cache format
			reordered.sort((a, b) => a.order - b.order);

			const result: { [id: string]: string[] } = {};
			for (const item of reordered) {
				if (!item.id || !Array.isArray(item.tags) || item.tags.length !== 5) {
					throw new Error(`Invalid reordered item: ${JSON.stringify(item)}`);
				}
				result[item.id] = item.tags;
			}

			return result;
		} catch (err) {
			lastError = err;
			if (attempt < maxRetries) {
				// Wait before retrying
				await new Promise(res => setTimeout(res, 30000));
			}
		}
	}
	throw new Error(`Failed to reorder documents after ${maxRetries} attempts: ${lastError}`);
}

// Cache file paths (in src/content/ for use by Astro collections)
const SUMMARY_CACHE_PATH = 'src/content/document-summary-cache.json';
const GROUPED_CACHE_PATH = 'src/content/grouped-documents-cache.json';
const DISPLAY_CACHE_PATH = 'src/content/display-documents-cache.json';

// Final display document structure
export interface DisplayDocument {
	id: string;
	title: string;
	url: string;
	tags: string[];
	summary: string;
}

// Cache helper functions
async function readJsonCache<T>(path: string, defaultValue: T): Promise<T> {
	try {
		const { readFile } = await import('fs/promises');
		const data = await readFile(path, 'utf-8');
		return JSON.parse(data);
	} catch {
		return defaultValue;
	}
}

async function writeJsonCache<T>(path: string, data: T): Promise<void> {
	const { writeFile } = await import('fs/promises');
	await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

// Main function to process documents (equivalent to tag_documents in Rust)
export async function processDocuments(
	anthropic: Anthropic,
	documents: LLMDocumentInput[]
): Promise<DisplayDocument[]> {
	const total = documents.length;
	console.log(`Processing ${total} documents...`);

	// Load summary cache
	const summaryCache: SummaryCache = await readJsonCache(SUMMARY_CACHE_PATH, {});
	console.log(`Summary cache has ${Object.keys(summaryCache).length} items.`);

	const requestedSummaries: SummaryCache = {};

	// Process each document for summarization
	for (let idx = 0; idx < documents.length; idx++) {
		const document = documents[idx];
		const id = document.id;

		let summary;
		if (summaryCache[id]) {
			console.log(`Skipped ${idx + 1} of ${total}: ${document.title}`);
			summary = summaryCache[id];
		} else {
			console.log(`Summarizing ${idx + 1} of ${total}: ${document.title}`);
			const llmSummary = await summariseDocument(anthropic, document);
			summary = {
				summary: llmSummary.summary,
				tags: llmSummary.tags
			};

			// Update and save cache
			summaryCache[id] = summary;
			await writeJsonCache(SUMMARY_CACHE_PATH, summaryCache);
			console.log(`Summarized ${idx + 1} of ${total}: ${document.title}`);
		}

		requestedSummaries[id] = summary;
	}

	console.log(`Starting reorder step with ${Object.keys(requestedSummaries).length} tagged documents`);

	// Load grouped documents cache
	const groupCache: { [id: string]: string[] } = await readJsonCache(GROUPED_CACHE_PATH, {});
	console.log(`Group cache has ${Object.keys(groupCache).length} items.`);

	let groupedDocuments: { [id: string]: string[] };

	// Check if all documents are already grouped
	const allDocumentsGrouped = Object.keys(requestedSummaries).every(id => groupCache[id]);

	if (allDocumentsGrouped) {
		console.log('All documents are already grouped.');
		groupedDocuments = {};
		for (const id of Object.keys(requestedSummaries)) {
			groupedDocuments[id] = groupCache[id];
		}
	} else {
		console.log('Reordering documents...');
		groupedDocuments = await tagAndGroupDocuments(anthropic, requestedSummaries);
		await writeJsonCache(GROUPED_CACHE_PATH, groupedDocuments);
	}

	// Create final display documents
	const result: DisplayDocument[] = [];
	for (const [id, tags] of Object.entries(groupedDocuments)) {
		const document = documents.find(d => d.id === id);
		const summary = requestedSummaries[id];

		if (!document || !summary) {
			throw new Error(`Missing document or summary for id: ${id}`);
		}

		result.push({
			id,
			title: document.title,
			url: document.source,
			tags,
			summary: summary.summary
		});
	}

	// Save display cache
	await writeJsonCache(DISPLAY_CACHE_PATH, result);
	console.log(`Processed ${result.length} documents successfully.`);

	return result;
}

// CLI script entry point (when run with tsx)
if (import.meta.url === `file://${process.argv[1]}`) {
	async function main() {
		// Load environment variables from .env file
		const { config } = await import('dotenv');
		config();

		const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
		const readwiseToken = process.env.READWISE_TOKEN;

		if (!anthropicApiKey) {
			console.error('❌ ANTHROPIC_API_KEY environment variable is required');
			process.exit(1);
		}

		if (!readwiseToken) {
			console.error('❌ READWISE_TOKEN environment variable is required');
			process.exit(1);
		}

		try {
			// Import Readwise functions
			const { fetchAllReadwiseReaderItems } = await import('./readwise.js');

			console.log('🔄 Fetching documents from Readwise...');
			const readwiseDocuments = await fetchAllReadwiseReaderItems({
				token: readwiseToken,
				location: 'new' as any, // Location.NEW
				category: 'article' as any, // Category.ARTICLE
				withHtmlContent: true
			});

			console.log(`📚 Found ${readwiseDocuments.length} documents`);

			if (readwiseDocuments.length === 0) {
				console.log('✅ No new documents to process');
				return;
			}

			// Convert to LLM input format
			const documents: LLMDocumentInput[] = readwiseDocuments.map(doc => ({
				id: doc.id,
				title: doc.title,
				author: '', // Readwise doesn't always have author info
				source: doc.url.href,
				content: doc.summary // Use existing summary as content for now
			}));

			// Process with LLM
			const anthropic = getAnthropicClient(anthropicApiKey);
			const result = await processDocuments(anthropic, documents);

			console.log(`✅ Successfully processed ${result.length} documents`);
		} catch (error) {
			console.error('❌ Error processing documents:', error);
			process.exit(1);
		}
	}

	main().catch(console.error);
}
