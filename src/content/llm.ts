import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Message } from "@anthropic-ai/sdk/resources";
import type { ProcessedItem } from "./types.ts";
import { readJsonCache, writeJsonCache } from "./utils.ts";

const DUMB_MODEL = "claude-haiku-4-5";
const SMART_MODEL = "claude-sonnet-4-5";

interface InputDocument {
	id: string;
	title: string;
	author: string;
	source: string;
	content: string;
}

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

type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

function getAnthropicClient(apiKey: string) {
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

Strictly follow the given instructions at all times. Especially the instructions above, they are non-negotiable.

Here is the document:`;

async function summariseDocument(
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

type SummaryCache = Record<string, { summary: string; tags: string[] }>;
type GroupCache = Record<string, { tags: string[]; order: number }>;

// Schema and type for reorder response: array ordered by desired sequence
const ReorderItemSchema = z.object({
	index: z.number().int().nonnegative(),
	tags: z.array(z.string()).length(5),
});
const ReorderResponseSchema = z.array(ReorderItemSchema);
type ReorderResponse = z.infer<typeof ReorderResponseSchema>;

async function tagAndGroupDocuments(
	anthropic: Anthropic,
	summaries: SummaryCache
): Promise<GroupCache> {
	return retry(async () => {
		const indexedSummaries: Array<
			[number, [string, { summary: string; tags: string[] }]]
		> = Object.entries(summaries).map(([id, data], idx) => [idx, [id, data]]);
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

		const parsed: ReorderResponse = ReorderResponseSchema.parse(
			extractJsonArray(responseContent)
		);

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

// Cache file paths
const READWISE_CACHE_DIR = ".readwise-cache";
const RAW_CACHE_PATH = `${READWISE_CACHE_DIR}/readwise-raw.json`;
const SUMMARY_CACHE_PATH = `${READWISE_CACHE_DIR}/llm-summary.json`;
const GROUPED_CACHE_PATH = `${READWISE_CACHE_DIR}/llm-group.json`;
const PROCESSED_CACHE_PATH = "src/content/cache-processed.json";

type DisplayDocument = {
	id: string;
	title: string;
	url: string;
	tags: string[];
	summary: string;
	order: number;
};

function assertNoMissing(
	documents: InputDocument[],
	cache: Record<string, unknown>,
	label: string
): void {
	const missing = documents.filter((d) => !(d.id in cache));
	if (missing.length > 0) {
		const titles = missing.map((d) => d.title);
		throw new Error(`[LLM][${label}] Missing ${missing.length}: ${titles}`);
	}
}

async function processDocuments(
	llm_client: Anthropic,
	documents: InputDocument[]
): Promise<DisplayDocument[]> {
	let summaryCache: SummaryCache = await readJsonCache(SUMMARY_CACHE_PATH, {});
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

		summaryCache[document.id] = {
			summary: llmSummary.summary,
			tags: llmSummary.tags,
		};
	}
	await writeJsonCache(SUMMARY_CACHE_PATH, summaryCache);

	summaryCache = await readJsonCache(SUMMARY_CACHE_PATH, {});
	assertNoMissing(documents, summaryCache, "Summary cache");

	let groupCache: GroupCache = await readJsonCache(GROUPED_CACHE_PATH, {});
	console.log(`[LLM][Group cache] len: ${Object.keys(groupCache).length}`);

	const missingFromGroup = documents.filter((d) => !(d.id in groupCache));

	if (missingFromGroup.length !== 0) {
		const missingTitles = missingFromGroup.map((d) => d.title);
		console.warn(`[LLM][Group cache] Missing: `, missingTitles);

		await retry(async () => {
			console.log(`[LLM] Reordering documents...`);

			const requestedSummaries = Object.fromEntries(
				Object.entries(summaryCache).filter(([id]) =>
					documents.some((d) => d.id === id)
				)
			);

			const groupedDocuments = await tagAndGroupDocuments(
				llm_client,
				requestedSummaries
			);

			const stillMissing = missingFromGroup.filter(
				(d) => !groupedDocuments[d.id]
			);
			if (stillMissing.length > 0) {
				const titles = stillMissing.map((d) => d.title);
				throw new Error(
					`[LLM][Reordering] Missing after update: ${titles}`
				);
			}

			await writeJsonCache(GROUPED_CACHE_PATH, groupedDocuments);
		});
	} else {
		console.log(`[LLM][Reordering] All documents are already grouped.`);
	}

	groupCache = await readJsonCache(GROUPED_CACHE_PATH, {});
	assertNoMissing(documents, groupCache, "Group cache");

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

	console.log(`[LLM] Processed ${result.length} documents successfully.`);
	return result;
}

// CLI script entry point (when run directly with bun)
if (import.meta.main) {
	async function main() {
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
			const {
				fetchAllReadwiseReaderItems,
				fetchAllReadwiseHighlightsBySourceUrl,
				normalizeUrlForJoin,
			} = await import("./readwise");

			// 1. Fetch ALL Readwise items (no location filter)
			console.log("🔄 Fetching all documents from Readwise...");
			const allItems = await fetchAllReadwiseReaderItems({
				token: readwiseToken,
				withHtmlContent: true,
			});
			console.log(`📚 Found ${allItems.length} items across all locations`);

			// 2. Fetch all highlights
			console.log("🔄 Fetching highlights from Readwise export API...");
			const highlightsBySourceUrl =
				await fetchAllReadwiseHighlightsBySourceUrl(readwiseToken);
			const highlightsMap = Object.fromEntries(highlightsBySourceUrl);
			console.log(
				`📚 Found highlights for ${highlightsBySourceUrl.size} sources`
			);

			// 3. Write raw cache
			const { mkdir, copyFile } = await import("fs/promises");
			await mkdir(READWISE_CACHE_DIR, { recursive: true });

			// Migrate LLM caches from old location if they exist
			const oldSummary = "src/content/cache-summary.json";
			const oldGroup = "src/content/cache-group.json";
			for (const [src, dest] of [
				[oldSummary, SUMMARY_CACHE_PATH],
				[oldGroup, GROUPED_CACHE_PATH],
			] as const) {
				try {
					await copyFile(src, dest);
					console.log(`📦 Migrated ${src} to ${dest}`);
				} catch {
					// source may not exist, ignore
				}
			}

			const rawCache = {
				items: allItems.map((item) => ({
					id: item.id,
					url: item.url.href,
					last_moved_at: item.last_moved_at.toISOString(),
					title: item.title,
					summary: item.summary,
					location: item.location,
					category: item.category ?? "",
				})),
				highlightsBySourceUrl: highlightsMap,
			};
			await writeJsonCache(RAW_CACHE_PATH, rawCache);
			console.log("✅ Wrote raw cache to", RAW_CACHE_PATH);

			// 4. For queue articles: run LLM summarize + group
			const queueArticles = allItems.filter(
				(item) =>
					item.location === "new" &&
					(item.category === "article" || !item.category)
			);

			if (queueArticles.length > 0) {
				const documents: InputDocument[] = queueArticles.map((doc) => ({
					id: doc.id,
					title: doc.title,
					author: "",
					source: doc.url.href,
					content: doc.summary,
				}));
				const anthropic = getAnthropicClient(anthropicApiKey);
				await processDocuments(anthropic, documents);
			}

			// 5. Build unified ProcessedItem[] for ALL items
			const summaryCache: SummaryCache = await readJsonCache(
				SUMMARY_CACHE_PATH,
				{}
			);
			const groupCache: GroupCache = await readJsonCache(
				GROUPED_CACHE_PATH,
				{}
			);

			const processed: ProcessedItem[] = allItems.map((item) => {
				const joinKey = normalizeUrlForJoin(item.url.href);
				const highlights = highlightsMap[joinKey] ?? [];
				const dateGroup = item.last_moved_at.toLocaleDateString("en-GB", {
					day: "2-digit",
					month: "short",
					year: "numeric",
				}).replace(/\//g, ".");

				const isQueueArticle =
					item.location === "new" &&
					(item.category === "article" || !item.category);
				const summaryData = summaryCache[item.id];
				const groupData = groupCache[item.id];

				return {
					readwise_id: item.id,
					title: item.title,
					url: item.url.href,
					tags: isQueueArticle && summaryData ? summaryData.tags : [],
					display_tags:
						isQueueArticle && groupData ? groupData.tags : [],
					category: item.category ?? "article",
					location: item.location,
					last_moved_at: item.last_moved_at.toISOString(),
					date_group: dateGroup,
					highlights,
					summary: isQueueArticle && summaryData ? summaryData.summary : "",
					order: isQueueArticle && groupData ? groupData.order : 0,
				};
			});

			await writeJsonCache(PROCESSED_CACHE_PATH, processed);
			console.log(
				`✅ Wrote processed cache (${processed.length} items) to ${PROCESSED_CACHE_PATH}`
			);
		} catch (error) {
			console.error("❌ Error:", error);
			process.exit(1);
		}
	}

	main().catch(console.error);
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
