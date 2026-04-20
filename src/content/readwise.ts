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

function parseRetryAfter(value: string): number {
	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) return seconds;
	const date = Date.parse(value);
	if (!Number.isNaN(date)) {
		return Math.max(0, Math.ceil((date - Date.now()) / 1000));
	}
	return 60;
}

async function fetchWithRetry(
	url: string,
	init: RequestInit,
	maxAttempts = 5
): Promise<Response> {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const response = await fetch(url, init);
		if (response.status !== 429 || attempt === maxAttempts) {
			return response;
		}
		const retryAfter = response.headers.get("retry-after");
		const waitSeconds = retryAfter ? parseRetryAfter(retryAfter) : 60;
		console.log(
			`[readwise] 429 rate limited, waiting ${waitSeconds}s (attempt ${attempt}/${maxAttempts})`
		);
		await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
	}
	throw new Error("fetchWithRetry: unreachable");
}

type HighlightsBySourceUrl = Map<
	string,
	{ texts: string[]; lastHighlightedAt: string | null }
>;

function pickLatest(a: string | null, b: string | null): string | null {
	if (!a) return b;
	if (!b) return a;
	return a > b ? a : b;
}

async function fetchAllReadwiseHighlightsBySourceUrl(
	token: string
): Promise<HighlightsBySourceUrl> {
	const baseUrl = "https://readwise.io/api/v2/export/";
	const highlightsBySourceUrl: HighlightsBySourceUrl = new Map();
	let nextPageCursor: string | null = null;

	do {
		const url = new URL(baseUrl);
		if (nextPageCursor) {
			url.searchParams.set("pageCursor", nextPageCursor);
		}

		const response = await fetchWithRetry(url.toString(), {
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

			const activeHighlights = book.highlights.filter((h) => !h.is_deleted);
			const texts = activeHighlights
				.map((h) => h.text)
				.filter((text) => text.length > 0);

			if (texts.length === 0) {
				continue;
			}

			const lastHighlightedAt = activeHighlights.reduce<string | null>(
				(acc, h) => pickLatest(acc, h.highlighted_at),
				null
			);

			const key = normalizeUrlForJoin(book.source_url);
			const existing = highlightsBySourceUrl.get(key);
			if (existing) {
				existing.texts.push(...texts);
				existing.lastHighlightedAt = pickLatest(
					existing.lastHighlightedAt,
					lastHighlightedAt
				);
			} else {
				highlightsBySourceUrl.set(key, { texts, lastHighlightedAt });
			}
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

		const response = await fetchWithRetry(url.toString(), {
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
	highlightsBySourceUrl: HighlightsBySourceUrl
): ProcessedItem {
	const joinKey = normalizeUrlForJoin(item.url.href);
	const bundle = highlightsBySourceUrl.get(joinKey);
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
		last_highlighted_at: bundle?.lastHighlightedAt ?? null,
		date_group: dateGroup,
		highlights: bundle?.texts ?? [],
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

	const merged = new Map<string, ProcessedItem>();
	for (const item of [...archiveItems, ...queueItems]) {
		merged.set(item.id, toProcessedItem(item, highlightsBySourceUrl));
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
			last_highlighted_at: item.last_highlighted_at
				? new Date(item.last_highlighted_at)
				: null,
		}));
}
