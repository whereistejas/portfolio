import type {
	FetchReadwiseOptions,
	ProcessedItem,
	ReadwiseArchiveItem,
	ReadwiseCategory,
	ReadwiseItem,
	ReadwiseLocation,
	ReadwiseQueueItem,
} from "./types.ts";
import { processedItemSchema, readwiseExportResponseSchema } from "./types.ts";
import { PROCESSED_CACHE_PATH, writeJsonCache } from "./utils.ts";

function cleanAuthor(raw: string | null | undefined): string {
	if (!raw) return "";
	const trimmed = raw.trim();
	if (!trimmed || trimmed.toLowerCase() === "unknown") return "";
	if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(trimmed)) return "";
	return trimmed;
}

function normalizeUrlForJoin(input: string): string {
	try {
		const url = new URL(input);
		url.hash = "";
		if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
			url.pathname = url.pathname.slice(0, -1);
		}
		return url.toString();
	} catch {
		return input.trim();
	}
}

async function fetchAllReadwiseHighlightsBySourceUrl(
	token: string
): Promise<Map<string, string[]>> {
	const baseUrl = "https://readwise.io/api/v2/export/";
	const highlightsBySourceUrl = new Map<string, string[]>();
	let nextPageCursor: string | null = null;

	do {
		const url = new URL(baseUrl);
		if (nextPageCursor) {
			url.searchParams.set("pageCursor", nextPageCursor);
		}

		const response = await fetch(url.toString(), {
			headers: {
				Authorization: `Token ${token}`,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch highlights from export API: ${response.status} ${response.statusText}`
			);
		}

		const data = readwiseExportResponseSchema.parse(await response.json());
		for (const book of data.results) {
			if (book.is_deleted || !book.source_url) {
				continue;
			}

			const key = normalizeUrlForJoin(book.source_url);
			const highlightTexts = book.highlights
				.filter((highlight) => !highlight.is_deleted)
				.map((highlight) => highlight.text)
				.filter((text) => text.length > 0);

			if (highlightTexts.length === 0) {
				continue;
			}

			const existing = highlightsBySourceUrl.get(key) ?? [];
			highlightsBySourceUrl.set(key, [...existing, ...highlightTexts]);
		}

		nextPageCursor = data.nextPageCursor;
	} while (nextPageCursor);

	return highlightsBySourceUrl;
}

async function fetchAllReadwiseReaderItems(
	options: FetchReadwiseOptions
): Promise<ReadwiseItem[]> {
	const { token, location, category, updatedAfter, withHtmlContent } = options;

	const baseUrl = "https://readwise.io/api/v3/list/";
	const items: ReadwiseItem[] = [];
	let nextPageCursor: string | null = null;

	do {
		const url = new URL(baseUrl);
		if (location) url.searchParams.set("location", location);
		if (category) url.searchParams.set("category", category);
		if (updatedAfter) url.searchParams.set("updatedAfter", updatedAfter);
		if (withHtmlContent != null)
			url.searchParams.set("withHtmlContent", String(withHtmlContent));
		if (nextPageCursor) url.searchParams.set("pageCursor", nextPageCursor);

		const response = await fetch(url.toString(), {
			headers: {
				Authorization: `Token ${token}`,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch Reader items: ${response.status} ${response.statusText}`
			);
		}

		const data = await response.json();
		const docs = data.results ?? [];

		for (const doc of docs) {
			items.push({
				id: doc.id,
				url: new URL(doc.source_url),
				last_moved_at: new Date(doc.last_moved_at),
				title: doc.title,
				summary: doc.summary,
				author: cleanAuthor(doc.author),
				location: doc.location as ReadwiseLocation,
				category: doc.category as ReadwiseCategory,
			});
		}

		nextPageCursor = data.nextPageCursor || null;
	} while (nextPageCursor);

	return items.sort(
		(a, b) => b.last_moved_at.getTime() - a.last_moved_at.getTime()
	);
}

async function loadProcessedCache(): Promise<ProcessedItem[]> {
	const file = Bun.file(PROCESSED_CACHE_PATH);
	if (!(await file.exists())) {
		return [];
	}
	try {
		const content = await file.text();
		const parsed: unknown = JSON.parse(content);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed
			.map((item) => processedItemSchema.safeParse(item))
			.filter((r): r is { success: true; data: ProcessedItem } => r.success)
			.map((r) => r.data);
	} catch (err) {
		console.warn(
			`[readwise] Failed to parse ${PROCESSED_CACHE_PATH}, returning empty:`,
			err
		);
		return [];
	}
}

function toProcessedItem(
	item: ReadwiseItem,
	highlightsMap: Record<string, string[]>
): ProcessedItem {
	const joinKey = normalizeUrlForJoin(item.url.href);
	const highlights = highlightsMap[joinKey] ?? [];
	const dateGroup = item.last_moved_at
		.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		})
		.replace(/\//g, ".");

	return {
		readwise_id: item.id,
		title: item.title,
		url: item.url.href,
		category: item.category ?? "article",
		location: item.location,
		last_moved_at: item.last_moved_at.toISOString(),
		date_group: dateGroup,
		highlights,
		summary: item.summary,
		author: item.author ?? "",
	};
}

/**
 * Fetch both archive and queue items plus highlights from the Readwise API
 * and write them to `cache-processed.json`. Called by `bun run build:queue`.
 * Astro loaders never hit the API directly — they read from the committed
 * cache.
 */
export async function refreshProcessedCache(token: string): Promise<void> {
	console.log("[readwise] Fetching archive + queue items from Readwise API...");
	const [archiveItems, queueItems, highlightsBySourceUrl] = await Promise.all([
		fetchAllReadwiseReaderItems({ token, location: "archive" }),
		fetchAllReadwiseReaderItems({ token, location: "new" }),
		fetchAllReadwiseHighlightsBySourceUrl(token),
	]);
	const highlightsMap = Object.fromEntries(highlightsBySourceUrl);

	const merged = new Map<string, ProcessedItem>();
	for (const item of [...archiveItems, ...queueItems]) {
		merged.set(item.id, toProcessedItem(item, highlightsMap));
	}

	const items = Array.from(merged.values());
	await writeJsonCache(PROCESSED_CACHE_PATH, items);
	console.log(
		`[readwise] Cached ${archiveItems.length} archive + ${queueItems.length} queue items (${items.length} total)`
	);
}

function processedToArchive(item: ProcessedItem): ReadwiseArchiveItem {
	return {
		id: item.readwise_id,
		readwise_id: item.readwise_id,
		title: item.title,
		url: item.url,
		last_moved_at: new Date(item.last_moved_at),
		summary: item.summary,
		author: item.author,
		location: item.location,
		category: item.category,
		dateGroup: item.date_group,
		highlights: item.highlights,
	};
}

export async function loadReadwiseArchive(): Promise<ReadwiseArchiveItem[]> {
	const items = await loadProcessedCache();
	return items
		.filter((item) => item.location === "archive")
		.map(processedToArchive);
}

export async function loadReadwiseQueue(): Promise<ReadwiseQueueItem[]> {
	const items = await loadProcessedCache();
	return items
		.filter((item) => item.location === "new")
		.map((item) => ({
			id: item.readwise_id,
			readwise_id: item.readwise_id,
			title: item.title,
			url: item.url,
			summary: item.summary,
			author: item.author,
			category: item.category,
			dateGroup: item.date_group,
			last_moved_at: new Date(item.last_moved_at),
		}));
}
