// llm.ts
// LLM-powered Readwise queue processing (summarization, tagging, reordering)
// This file is used at build time to generate JSON caches for Astro content collections

import Anthropic from '@anthropic-ai/sdk';
import { strict as assert } from 'node:assert';

// Types for document input and LLM output
export interface InputDocument {
	id: string;
	title: string;
	author: string;
	source: string;
	content: string;
}

export interface DocumentSummary {
	id: string;
	summary: string;
	tags: string[];
}

export interface DocumentOrder {
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

const DUMB_MODEL = 'claude-haiku-4-5';
const SMART_MODEL = 'claude-sonnet-4-5';

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

async function retry<T>(closure: () => Promise<T>, maxRetries: number = 3): Promise<T> {
	let lastError: unknown = null;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await closure();
		} catch (err) {
			console.error(err);
			lastError = err;
			if (attempt < maxRetries) {
				// Wait before retrying
				await new Promise(res => setTimeout(res, 30000));
			}
		}
	}
	throw new Error(`Failed to execute Anthropic request after ${maxRetries} attempts: ${lastError}`);
}

// Summarize a single document using Anthropic LLM
export async function summariseDocument(
	anthropic: Anthropic,
	document: InputDocument,
): Promise<DocumentSummary> {
	const inputJson = JSON.stringify(document, null, 2);
	const prompt = `${SUMMARY_PROMPT}\n${inputJson}`;

	return retry(async () => {
		const response = await anthropic.messages.create({
			model: DUMB_MODEL,
			max_tokens: 50000,
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
		});
		let raw = response.content[0]?.type === 'text' ? response.content[0].text : '';

		// Strip markdown code blocks if present (Claude sometimes adds them despite instructions)
		raw = raw.trim();
		if (raw.startsWith('```')) {
			// Remove opening ```json or ``` and closing ```
			raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
		}

		let summary: DocumentSummary;
		try {
			summary = JSON.parse(raw);
		} catch (error) {
			console.error('Failed to parse JSON response:', raw);
			throw new Error(`JSON parse error: ${error instanceof Error ? error.message : String(error)}\nRaw response: ${raw.substring(0, 200)}...`);
		}

		if (!summary.id || !summary.summary || !Array.isArray(summary.tags)) {
			throw new Error(`Malformed summary response: ${raw}`);
		}
		return summary;
	});
}

const REORDERING_PROMPT = `
You are an expert librarian and archivist tasked with organizing a collection of documents. You will receive JSON data containing document summaries and tags from an initial analysis phase, and your job is to reorder these documents and consolidate their tags for better organization.

Here is the document collection data from the previous analysis:

<document_summaries>
{{summaries}}
</document_summaries>

Your task involves two main activities:

**Document Reordering:**
- Analyze the document summaries and tags to understand thematic relationships
- Reorder the documents to create a natural, logical flow
- Minimize "switching cost" between consecutive documents by grouping related content
- Ensure smooth transitions from one document to the next

**Tag Consolidation:**
- Review all existing tags across documents and identify opportunities to merge similar tags into higher-level topics
- Consolidate redundant or overly specific tags into broader, more useful categories
- Ensure each document has exactly 5 tags from your consolidated tag set
- Format all tags as single words, joining multi-word concepts with underscores (e.g., "nuclear_power", "development_economics")

**Critical Requirements:**
- Preserve every document ID exactly as provided in the input - do not modify IDs in any way
- Include ALL documents from the input - do not drop or forget any documents
- Output exactly 5 tags per document
- Use only single words or underscore-joined phrases for tags
- Return raw JSON without markdown code blocks or other formatting

Before creating your final output, work through this systematically in <document_organization> tags inside your thinking block:

1. First, create a complete inventory by listing out every single document ID from the input data to ensure none are forgotten. It's OK for this section to be quite long.
2. For each document, write a brief note about its main theme based on the summary
3. Group documents by thematic similarity and plan the optimal ordering sequence that creates natural flow
4. Create a comprehensive list of all existing tags across all documents
5. Design your consolidated tag vocabulary by merging similar tags and creating broader categories
6. Assign the new sequence numbers (starting from 0) and exactly 5 consolidated tags to each document
7. Perform a final completeness check by verifying that every document ID from step 1 appears exactly once in your final ordering

Your final output should be a JSON array where each object contains:
- "order": the new sequence number (starting from 0)
- "id": the original document ID (unchanged)  
- "tags": an array of exactly 5 consolidated tags

Example format:
\`\`\`json
[
  {
    "order": 0,
    "id": "doc_001",
    "tags": ["biology", "research", "methodology", "data_analysis", "peer_review"]
  },
  {
    "order": 1, 
    "id": "doc_002",
    "tags": ["biology", "genetics", "molecular_biology", "laboratory", "techniques"]
  }
]
\`\`\`
`;

// Type for summary cache (matches cache-summary.json structure)
export type SummaryCache =
	Record<string, { summary: string, tags: string[] }>


// Reorder and tag documents using Anthropic LLM
export async function tagAndGroupDocuments(
	anthropic: Anthropic,
	summaries: SummaryCache,
): Promise<GroupCache> {
	const inputJson = JSON.stringify(summaries, null, 2);
	const prompt = REORDERING_PROMPT.replace('{{summaries}}', inputJson);

	return retry(async () => {
		const response = await anthropic.messages.create({
			model: SMART_MODEL,
			max_tokens: 50000,
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
		});
		let raw = response.content[0]?.type === 'text' ? response.content[0].text : '';

		// Remove everything between and including <document_organization> tags
		raw = raw.replace(/<document_organization>[\s\S]*?<\/document_organization>/g, '').trim();
		// Strip markdown code blocks if present (Claude sometimes adds them despite instructions)
		raw = raw.trim();
		if (raw.startsWith('```')) {
			// Remove opening ```json or ``` and closing ```
			raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
		}

		let reordered: DocumentOrder[];
		try {
			reordered = JSON.parse(raw);
		} catch (error) {
			console.error('Failed to parse JSON response:', raw);
			throw new Error(`JSON parse error: ${error instanceof Error ? error.message : String(error)}\nRaw response: ${raw.substring(0, 200)}...`);
		}

		if (!Array.isArray(reordered)) {
			throw new Error(`Expected array of reordered items: ${raw.substring(0, 200)}...`);
		}
		const groups = reordered.reduce((acc, item) => {
			acc[item.id] = { tags: item.tags, order: item.order };
			return acc;
		}, {} as GroupCache);

		return groups;
	});
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
		const file = Bun.file(path);
		if (!(await file.exists())) {
			return defaultValue;
		}
		const data = await file.text();
		return JSON.parse(data);
	} catch {
		return defaultValue;
	}
}

async function writeJsonCache<T>(path: string, data: T): Promise<void> {
	// Sort object keys recursively to ensure consistent ordering
	const sortKeys = (obj: any): any => {
		if (obj === null || typeof obj !== 'object') {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map(sortKeys);
		}

		// Sort object keys alphabetically
		const sortedObj: any = {};
		const keys = Object.keys(obj).sort();
		for (const key of keys) {
			sortedObj[key] = sortKeys(obj[key]);
		}
		return sortedObj;
	};

	const sortedData = sortKeys(data);
	await Bun.write(path, JSON.stringify(sortedData, null, 2));
}

// Type for grouped documents cache (matches cache-group.json structure)
export type GroupCache = Record<string, { tags: string[]; order: number }>

// Main function to process documents (equivalent to tag_documents in Rust)
export async function processDocuments(
	llm_client: Anthropic,
	documents: InputDocument[]
): Promise<DisplayDocument[]> {
	const documentIds = documents.map(doc => doc.id);

	// Load summary cache
	var summaryCache: SummaryCache = await readJsonCache(SUMMARY_CACHE_PATH, {});
	console.log(`[LLM][Summary cache] len: ${Object.keys(summaryCache).length}`);

	// Log missing items from summary cache
	var missingIds = documentIds.filter(id => !Object.keys(summaryCache).includes(id));
	console.error(
		`[LLM][Summary cache] Missing: `,
		missingIds.map(id => documents.find(d => d.id === id)!.title)
	);

	// Process each document for summarization
	for (const [idx, id] of documentIds.entries()) {
		const document = documents[idx];

		if (summaryCache[id]) {
			console.log(`[LLM] Skipped summarizing (${idx + 1}/${documentIds.length}): ${document.title}`);
		} else {
			console.log(`[LLM] Summarizing ${idx + 1} of ${documentIds.length}: ${document.title}`);
			const llmSummary = await summariseDocument(llm_client, document);

			// Update and save cache
			summaryCache[id] = {
				summary: llmSummary.summary,
				tags: llmSummary.tags
			};

			await writeJsonCache(SUMMARY_CACHE_PATH, summaryCache);
		}
	}

	var summaryCache: SummaryCache = await readJsonCache(SUMMARY_CACHE_PATH, {});
	// Log missing items from summary cache after update
	var missingIds: string[] = documentIds.filter(id => !Object.keys(summaryCache).includes(id));
	assert(
		missingIds.length === 0,
		`[LLM][Summary cache] Missing after update: ${missingIds.map(id => documents.find(d => d.id === id)!.title)}`,
	);

	var groupCache: GroupCache = await readJsonCache(GROUPED_CACHE_PATH, {});
	console.log(`[LLM][Group cache] len: ${Object.keys(groupCache).length}`);

	// Check if all the ids in `documentIds` are already present in `groupCache`.
	missingIds = documentIds.filter(id => !Object.keys(groupCache).includes(id));
	console.error(`[LLM][Group cache] Missing: `, missingIds.map(id => documents.find(d => d.id === id)!.title));

	if (missingIds.length != 0) {
		await retry(async () => {
			console.log(`[LLM][Group] Reordering documents...`);

			const requestedSummaries = Object.fromEntries(
				Object
					.entries(summaryCache)
					.filter(([id, _]) => documentIds.includes(id))
			);
			var groupedDocuments = await tagAndGroupDocuments(llm_client, requestedSummaries);

			// Validate that LLM returned all missing items before proceeding
			missingIds = missingIds.filter(id => !groupedDocuments[id]);

			assert(
				missingIds.length === 0,
				`[LLM][Group] Missing after update: ${missingIds.map(id => documents.find(d => d.id === id)!.title)}`,
			);

			await writeJsonCache(GROUPED_CACHE_PATH, groupedDocuments);
			// If we get here, the operation was successful
			return;
		});
	} else {
		console.log(`[LLM][Group] All documents are already grouped.`);
	};

	var groupCache: GroupCache = await readJsonCache(GROUPED_CACHE_PATH, {});
	// Check if all the ids in `documentIds` are already present in `groupCache` after update.
	var missingIds = documentIds.filter(id => !Object.keys(groupCache).includes(id));
	assert(
		missingIds.length === 0,
		`[LLM][Group cache] Missing ${missingIds.length} after update: ${missingIds.map(id => documents.find(d => d.id === id)!.title)}`
	);

	const result: DisplayDocument[] = [];
	for (const id of documentIds) {
		const document: InputDocument = documents.find(d => d.id === id)!;
		const summary = summaryCache[id];
		const groupData = groupCache[id];

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
	console.log(`[LLM] Processed ${result.length} documents successfully.`);

	return result;
}

// CLI script entry point (when run directly with bun)
if (import.meta.main) {
	async function main() {
		// Bun automatically loads environment variables from .env file
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
			const { fetchAllReadwiseReaderItems } = await import('./readwise');

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
			const documents: InputDocument[] = readwiseDocuments.map(doc => ({
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
