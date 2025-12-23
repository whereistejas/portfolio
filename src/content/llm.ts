// llm.ts
// LLM-powered Readwise queue processing (summarization, tagging, reordering)
// This file is used at build time to generate JSON caches for Astro content collections

import Anthropic from "@anthropic-ai/sdk";
import { strict as assert } from "node:assert";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Message } from "@anthropic-ai/sdk/resources";

const DUMB_MODEL = "claude-haiku-4-5";
const SMART_MODEL = "claude-sonnet-4-5";

// Types for document input and LLM output
export interface InputDocument {
	id: string;
	title: string;
	author: string;
	source: string;
	content: string;
}

// Zod schema for structured output matching DocumentSummary interface
const DocumentSummarySchema = z.object({
	id: z.string().describe("The document ID (must match the input document ID)"),
	summary: z
		.string()
		.max(250)
		.describe(
			"A concise summary of the document (less than 250 characters, should not mention title, source, or author)"
		),
	tags: z
		.array(z.string())
		.describe(
			"A wide variety of tags that capture the various categories this document could fall into"
		),
});

// Infer TypeScript type from Zod schema
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

// Anthropic client setup
export function getAnthropicClient(apiKey: string) {
	return new Anthropic({
		apiKey,
		timeout: 240000, // 240 seconds = 4 minutes (matching Rust implementation)
	});
}

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

Your output must be a JSON object matching the structured output schema with the following required fields:
- "id" (string): The document ID - must match the input document ID exactly
- "summary" (string): A concise summary (less than 250 characters, should not mention title, source, or author)
- "tags" (array of strings): A wide variety of tags capturing various categories

The output format is enforced by the structured output schema, so ensure your response matches this format exactly.

Stricly follow the given instructions at all times. Especially the instructions above, they are non-negotiable.

Here is the document:`;

// Summarize a single document using Anthropic LLM
export async function summariseDocument(
	anthropic: Anthropic,
	document: InputDocument
): Promise<DocumentSummary> {
	return retry(async () => {
		const inputJson = JSON.stringify(document, null, 2);
		const prompt = `${SUMMARY_PROMPT}\n${inputJson}`;

		const response = await anthropic.beta.messages.parse({
			model: DUMB_MODEL,
			max_tokens: 50000,
			messages: [
				{
					role: "user",
					content: prompt,
				},
			],
			betas: ["structured-outputs-2025-11-13"],
			output_format: betaZodOutputFormat(DocumentSummarySchema),
		});

		// Automatically parsed and validated by Zod
		if (!response.parsed_output) {
			throw new Error("No parsed output received from API");
		}

		return response.parsed_output;
	});
}

const REORDERING_PROMPT = `
You are an expert librarian and archivist. You will receive JSON data containing document summaries and tags from an initial analysis phase. Your job is to determine a new ordering and produce consolidated tags, but you will only return the indices in the new order (not the documents themselves).

Here is the document collection data from the previous analysis (each entry is [index, [id, {summary, tags}]]):

<document_summaries>
{{summaries}}
</document_summaries>

Your task:
- Analyze the summaries and tags to understand thematic relationships.
- Reorder the documents to create a natural, logical flow that minimizes switching cost.
- Consolidate tags into broader, useful categories.

Strict output format:
- Return ONLY raw JSON (no markdown) as an array of objects.
- Each object must be: { "index": <number>, "tags": [tag1, tag2, tag3, tag4, tag5] }.
- The array order is the desired sequence (first element = order 0, etc.).
- Include every input index exactly once; do not drop or duplicate.
- Tags must be exactly 5 strings, single words or underscore_joined phrases.

Thinking steps (inside your thinking block before final output):
1) Inventory every index and its document ID to ensure completeness.
2) Note each document's main theme from the summary.
3) Plan groups and the optimal ordering sequence.
4) Merge similar tags into consolidated categories.
5) Assign exactly 5 consolidated tags to each index and finalize the order.
6) Verify every index is present exactly once in the final array.
`;

// Type for summary cache (matches cache-summary.json structure)
export type SummaryCache = Record<string, { summary: string; tags: string[] }>;

// Type for grouped documents cache (matches cache-group.json structure)
export type GroupCache = Record<string, { tags: string[]; order: number }>;

// Schema and type for reorder response: array ordered by desired sequence
const ReorderItemSchema = z.object({
	index: z.number().int().nonnegative(),
	tags: z.array(z.string()).length(5),
});
const ReorderResponseSchema = z.array(ReorderItemSchema);
type ReorderResponse = z.infer<typeof ReorderResponseSchema>;

// Reorder and tag documents using Anthropic LLM
export async function tagAndGroupDocuments(
	anthropic: Anthropic,
	summaries: SummaryCache
): Promise<GroupCache> {
	return retry(async () => {
		const indexedSummaries: Array<[number, [string, { summary: string; tags: string[] }]]> =
			Object.entries(summaries).map(([id, data], idx) => [idx, [id, data]]);
		const inputJson = JSON.stringify(indexedSummaries, null, 2);

		const prompt = REORDERING_PROMPT.replace("{{summaries}}", inputJson);

		const response: Message = await anthropic.messages.create({
			model: SMART_MODEL,
			max_tokens: 50000,
			messages: [
				{
					role: "user",
					content: prompt,
				},
			],
		});

		// Automatically parsed and validated by Zod
		if (!response.content) {
			throw new Error("No parsed output received from API");
		}

		// Read and validate the message as { index, tags }[]
		type TextBlock = { type: "text"; text: string };
		const responseContent =
			typeof response.content === "string"
				? response.content
				: response.content
					.map((block) =>
						typeof block === "object" && block && "text" in block
							? (block as TextBlock).text
							: ""
					)
					.join("");

		// Extract the JSON array payload safely even if extra text is present
		const extractJsonArray = (text: string): unknown => {
			const start = text.indexOf("[");
			const end = text.lastIndexOf("]");
			if (start === -1 || end === -1 || end <= start) {
				throw new Error("LLM response missing JSON array");
			}
			const slice = text.slice(start, end + 1);
			return JSON.parse(slice);
		};

		const parsed: ReorderResponse = ReorderResponseSchema.parse(extractJsonArray(responseContent));

		// Map ordered indices back to document IDs, preserving GroupCache shape
		const groups: GroupCache = {};
		for (const [order, item] of parsed.entries()) {
			const entry = indexedSummaries[item.index];
			if (!entry) {
				throw new Error(`LLM returned unknown index: ${item.index}`);
			}
			const [, [id]] = entry;
			groups[id] = { tags: item.tags, order };
		}

		return groups;
	});
}

// Cache file paths (in src/content/ for use by Astro collections)
const SUMMARY_CACHE_PATH = "src/content/cache-summary.json";
const GROUPED_CACHE_PATH = "src/content/cache-group.json";
const DISPLAY_CACHE_PATH = "src/content/cache-display.json";

// Final display document structure
export type DisplayDocument = {
	id: string;
	title: string;
	url: string;
	tags: string[];
	summary: string;
	order: number;
};

// Main function to process documents (equivalent to tag_documents in Rust)
export async function processDocuments(
	llm_client: Anthropic,
	documents: InputDocument[]
): Promise<DisplayDocument[]> {
	var summaryCache: SummaryCache = await readJsonCache(SUMMARY_CACHE_PATH, {});
	for (const [idx, document] of documents.entries()) {
		if (document.id in summaryCache) {
			console.log(
				`[LLM] Skipped summarizing (${idx + 1}/${documents.length}): ${document.title}`
			);
			continue;
		}

		console.log(
			`[LLM] Summarizing ${idx + 1} of ${documents.length}: ${document.title}`
		);
		const llmSummary = await summariseDocument(llm_client, document);

		// Update and save cache
		summaryCache[document.id] = {
			summary: llmSummary.summary,
			tags: llmSummary.tags,
		};
	}
	await writeJsonCache(SUMMARY_CACHE_PATH, summaryCache);

	var summaryCache: SummaryCache = await readJsonCache(SUMMARY_CACHE_PATH, {});
	var missingDocuments = documents
		.filter((document) => !Object.keys(summaryCache).includes(document.id))
	var titlesOfMissingDocuments = missingDocuments.map(
		(document) => document.title
	);
	assert(
		missingDocuments.length === 0,
		`[LLM][Summary cache] Missing after update: ${titlesOfMissingDocuments}`
	);

	var groupCache: GroupCache = await readJsonCache(GROUPED_CACHE_PATH, {});
	console.log(`[LLM][Group cache] len: ${Object.keys(groupCache).length}`);

	// Check if all the ids in `documentIds` are already present in `groupCache`.
	missingDocuments = documents
		.filter((document) => !Object.keys(groupCache).includes(document.id))
	titlesOfMissingDocuments = missingDocuments.map(
		(document) => document.title
	);

	if (missingDocuments.length != 0) {
		console.warn(`[LLM][Group cache] Missing: `, titlesOfMissingDocuments);

		await retry(async () => {
			console.log(`[LLM] Reordering documents...`);

			const requestedSummaries = Object.fromEntries(
				Object.entries(summaryCache).filter(([id]) =>
					documents.some((document) => document.id === id)
				)
			);

			var groupedDocuments = await tagAndGroupDocuments(
				llm_client,
				requestedSummaries
			);

			// Validate that LLM returned all missing items before proceeding
			missingDocuments = missingDocuments.filter((document) => !groupedDocuments[document.id]);
			titlesOfMissingDocuments = missingDocuments.map(
				(document) => document.title
			);
			assert(
				missingDocuments.length === 0,
				`[LLM][Reordering] Missing after update: ${titlesOfMissingDocuments}`
			);

			await writeJsonCache(GROUPED_CACHE_PATH, groupedDocuments);
		});
	} else {
		console.log(`[LLM][Reordering] All documents are already grouped.`);
	}

	var groupCache: GroupCache = await readJsonCache(GROUPED_CACHE_PATH, {});
	// Check if all the ids in `documentIds` are already present in `groupCache` after update.
	missingDocuments = documents.filter(
		(document) => !Object.keys(groupCache).includes(document.id)
	);
	titlesOfMissingDocuments = missingDocuments.map(
		(document) => document.title
	);
	assert(
		missingDocuments.length === 0,
		`[LLM][Group cache]Missing ${missingDocuments.length} after update: ${titlesOfMissingDocuments}`
	);

	const result: DisplayDocument[] = [];
	for (const document of documents) {
		const summary = summaryCache[document.id]!;
		const groupData = groupCache[document.id]!;

		result.push({
			id: document.id,
			title: document.title,
			url: document.source,
			summary: summary.summary,
			tags: groupData.tags,
			order: groupData.order,
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
		const anthropicApiKey = process.env["ANTHROPIC_API_KEY"];
		const readwiseToken = process.env["READWISE_TOKEN"];

		if (!anthropicApiKey) {
			console.error("❌ ANTHROPIC_API_KEY environment variable is required");
			process.exit(1);
		}

		if (!readwiseToken) {
			console.error("❌ READWISE_TOKEN environment variable is required");
			process.exit(1);
		}

		try {
			// Import Readwise functions
			const { fetchAllReadwiseReaderItems } = await import("./readwise");

			console.log("🔄 Fetching documents from Readwise...");
			const readwiseDocuments = await fetchAllReadwiseReaderItems({
				token: readwiseToken,
				location: "new" as any, // Location.NEW
				category: "article" as any, // Category.ARTICLE
				withHtmlContent: true,
			});

			console.log(`📚 Found ${readwiseDocuments.length} documents`);

			if (readwiseDocuments.length === 0) {
				console.log("✅ No new documents to process");
				return;
			}

			// Convert to LLM input format
			const documents: InputDocument[] = readwiseDocuments.map((doc) => ({
				id: doc.id,
				title: doc.title,
				author: "", // Readwise doesn't always have author info
				source: doc.url.href,
				content: doc.summary, // Use existing summary as content for now
			}));

			// Process with LLM
			const anthropic = getAnthropicClient(anthropicApiKey);
			const result = await processDocuments(anthropic, documents);

			console.log(`✅ Successfully processed ${result.length} documents`);
		} catch (error) {
			console.error("❌ Error processing documents:", error);
			process.exit(1);
		}
	}

	main().catch(console.error);
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
		if (obj === null || typeof obj !== "object") {
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

async function retry<T>(
	closure: () => Promise<T>,
	maxRetries: number = 3
): Promise<T> {
	let lastError: unknown = null;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await closure();
		} catch (err) {
			console.error(err);
			lastError = err;
			if (attempt < maxRetries) {
				// Wait before retrying
				await new Promise((res) => setTimeout(res, 30000));
			}
		}
	}
	throw new Error(
		`Failed to execute Anthropic request after ${maxRetries} attempts: ${lastError}`
	);
}
