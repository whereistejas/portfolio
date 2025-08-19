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

const ANTHROPIC_MODEL = 'claude-sonnet-4-0';

// Summarization prompt (from Rust)
const SUMMARY_PROMPT = `Imagine you are a librarian or archivist. Your job is  to go through a bunch of documents and summarize, categorise and tag them. Your job is also to group these documents based on different criterias such as subject, theme, source, author, etc.

For example, you can group all documents about "biology" (i.e., based on subject) or group all documents from "Siddhartha Mukherjee" (i.e., based on author) or group all documents related to "productivity" (i.e., based on theme).

We're going to do this in 2 steps:
Step 1: Create a summary and a wide-variety of tags for each document.
Step 2: Reorder the documents based on the tags and merge the tags into higher-level topics so that they can used for multiple documents.

Instructions for Step 1:

Instructions for creating the summary:
- The summary should be concise and should NOT mention things like the title or source or author.
- The summary should be less than 250 characters.

Instructions for creating the tags:
- Read the content of the document before creating the tags.
- The tags should be a wide-variety of tags that capture the various categories this document could fall into.

Remember, while generating the summary and tags that the FINAL GOAL IS TO CATEGORISE AND GROUP THE DOCUMENTs.

Each document will be given to you along with some metadata in the json format:
{
    "id": "uuid",
    "title": "document title",
    "author": "document name",
    "source": "source_url",
    "content": "document content"
}

For each document give output in JSON format with keys: "id" (string), "summary" (string) and "tags" (list of string).
For example,
{
    "id": "<uuid>",
    "summary": "<your summary>",
    "tags": ["your tags"]
}

ALWAYS perform these checks before returning the JSON object to me:
- Make sure the "id" is the SAME.
- Make sure the "summary" ALWAYS escapes characters in order to produce valid JSON.
- NEVER WRAP the JSON response in markdown code blocks, ALWAYS return the raw JSON object.

Stricly follow the given instructions at all times. Especially the instructions above, they are non-negotiable.

Here is the document:`;

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
			console.error(`Error summarizing document ${document.id}:`, err);
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
const REORDERING_PROMPT = `Imagine you are a librarian or archivist. Your job is  to go through a bunch of documents and summarize, categorise and tag them. Your job is also to group these documents based on different criterias such as subject, theme, source, author, etc.

For example, you can group all documents about "biology" (i.e., based on subject) or group all documents from "Siddhartha Mukherjee" (i.e., based on author) or group all documents related to "productivity" (i.e., based on theme).

We're going to do this in 2 steps:
Step 1: Create a summary and a wide-variety of tags for each document.
Step 2: Reorder the documents based on the tags and merge the tags into higher-level topics so that they can used for multiple documents.

Instructions for Step 2:
    
Instructions for reordering the documents:
- Reorder the documents based on the tags and summaries.
- Make sure that the order flows naturally and makes sense.
- Make sure that the "switching cost" from one document to the next is as low as possible.

Instructions for merging the tags into higher-level topics:
- Merge the tags into higher-level topics so that they can used for multiple documents.
- Make sure that each document only has 5 tags.
- Make sure all tags are single words. If you need a tag like "nuclear power" or "development economics", then join them using a "_".

For each document give output in JSON format with keys: "order" (number), "id" (string) and "tags" (list of string).
For example,
{
    "order": 0,
    "id": "<document id>",
    "tags": ["your tags"]
}

Do not wrap your JSON response in markdown code blocks or any other formatting. Return only the raw JSON object.

ALWAYS perform these checks before returning the JSON object to me:
- Make sure the "id" remains the SAME or UNCHANGED.
- Make sure that you return ALL the documents.
- NEVER WRAP the JSON response in markdown code blocks, ALWAYS return the raw JSON object.`;

// Type for summary cache (matches cache-summary.json structure)
export type SummaryCache = {
	[id: string]: {
		summary: string;
		tags: string[];
	};
}

// Reorder and tag documents using Anthropic LLM
export async function tagAndGroupDocuments(
	anthropic: Anthropic,
	summaries: SummaryCache,
	maxRetries = 25
): Promise<GroupCache> {
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

			const result: GroupCache = {};
			for (const item of reordered) {
				if (!item.id || !Array.isArray(item.tags) || item.tags.length !== 5) {
					throw new Error(`Invalid reordered item: ${JSON.stringify(item)}`);
				}
				result[item.id] = { tags: item.tags, order: item.order };
			}

			return result;
		} catch (err) {
			console.error(`Error reordering documents:`, err);
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
const SUMMARY_CACHE_PATH = 'src/content/cache-summary.json';
const GROUPED_CACHE_PATH = 'src/content/cache-group.json';
const DISPLAY_CACHE_PATH = 'src/content/cache-display.json';

// Final display document structure
export type DisplayDocument = {
	id: string;
	title: string;
	url: string;
	tags: string[];
	summary: string;
	order: number;
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

// Type for grouped documents cache (matches cache-group.json structure)
export type GroupCache = { [id: string]: { tags: string[]; order: number } }

// Main function to process documents (equivalent to tag_documents in Rust)
export async function processDocuments(
	anthropic: Anthropic,
	documents: LLMDocumentInput[]
): Promise<DisplayDocument[]> {
	const documentIds = documents.map(doc => doc.id);
	console.log(`Processing ${documentIds.length} documents...`);

	// Load summary cache
	var summaryCache: SummaryCache = await readJsonCache(SUMMARY_CACHE_PATH, {});
	console.log(`Summary cache has ${Object.keys(summaryCache).length} items.`);

	// Log missing items from summary cache
	var missingIds = documents.filter(doc => !summaryCache[doc.id]).map(doc => doc.id);
	if (missingIds.length > 0) {
		console.error(`Missing ${missingIds.length} items from summary cache:`, missingIds);
	}

	// Process each document for summarization
	for (let idx = 0; idx < documents.length; idx++) {
		const document = documents[idx];
		const id = document.id;

		let summary;
		if (summaryCache[id]) {
			console.log(`Skipped ${idx + 1} of ${documentIds.length}: ${document.title}`);
			summary = summaryCache[id];
		} else {
			console.log(`Summarizing ${idx + 1} of ${documentIds.length}: ${document.title}`);
			const llmSummary = await summariseDocument(anthropic, document);
			summary = {
				summary: llmSummary.summary,
				tags: llmSummary.tags
			};

			// Update and save cache
			summaryCache[id] = summary;
			await writeJsonCache(SUMMARY_CACHE_PATH, summaryCache);
			console.log(`Summarized ${idx + 1} of ${documentIds.length}: ${document.title}`);
		}

	}

	var summaryCache: SummaryCache = await readJsonCache(SUMMARY_CACHE_PATH, {});
	// Log missing items from summary cache after update
	var missingIds = documentIds.filter(id => !summaryCache[id]);
	if (missingIds.length > 0) {
		throw new Error(`Missing document IDs in summary cache after update: ${missingIds.join(', ')}`);
	}

	console.log(`Starting reorder step with ${Object.keys(documentIds).length} tagged documents`);
	// Load grouped documents cache
	const groupCache: GroupCache = await readJsonCache(GROUPED_CACHE_PATH, {});
	console.log(`Group cache has ${Object.keys(groupCache).length} items.`);

	// Check if all the ids in `documentIds` are already present in `groupCache`.
	var missingIds = documentIds.filter(id => !groupCache[id]);
	if (missingIds.length > 0) {
		console.log(`Missing ${missingIds.length} items from group cache:`, missingIds);
	}

	var groupedDocuments: GroupCache = {};
	if (missingIds.length === 0) {
		console.log('All documents are already grouped.');

		// Filter out the documents that are already in the group cache
		groupedDocuments = Object
			.entries(groupCache)
			.filter(([id, _]) => documentIds.includes(id))
			.reduce((acc, [id, groupData]) => { acc[id] = groupData; return acc; }, {} as GroupCache);
	} else {
		console.log('Reordering documents...');

		const requestedSummaries = Object.fromEntries(
			Object
				.entries(summaryCache)
				.filter(([id, _]) => documentIds.includes(id))
		);

		const maxRetries = 3;
		let lastError: unknown = null;
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				groupedDocuments = await tagAndGroupDocuments(anthropic, requestedSummaries);

				// Validate that LLM returned all missing items before proceeding
				var missingIds = missingIds.filter(id => !groupedDocuments[id]);
				if (missingIds.length > 0) {
					throw new Error(`Missing document IDs in LLM response: ${missingIds.join(', ')}`);
				}

				// If we get here, the operation was successful
				break;
			} catch (err) {
				console.error(`Error grouping documents:`, err);
				lastError = err;
			}
		}

		if (lastError && Object.keys(groupedDocuments).length === 0) {
			throw new Error(`Failed to group documents after ${maxRetries} attempts: ${lastError}`);
		}

		await writeJsonCache(GROUPED_CACHE_PATH, groupedDocuments);
	};

	var groupedDocuments: GroupCache = await readJsonCache(GROUPED_CACHE_PATH, {});
	const result: DisplayDocument[] = [];
	for (const [id, groupData] of Object.entries(groupedDocuments)) {
		const document = documents.find(d => d.id === id);
		const summary = summaryCache[id];

		if (!document || !summary) {
			throw new Error(`Missing document or summary for id: ${id} `);
		}

		result.push({
			id,
			title: document.title,
			url: document.source,
			summary: summary.summary,
			tags: groupData.tags,
			order: groupData.order
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
