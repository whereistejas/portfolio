import { mkdir } from "fs/promises";

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
import {
	PROCESSED_CACHE_PATH,
	RAW_CACHE_PATH,
	READWISE_CACHE_DIR,
	writeJsonCache,
} from "./utils.ts";

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

/**
 * Fetches items and highlights, writes raw cache, and builds ProcessedItem[]
 * with highlights and date_group. Queue items have empty tags, display_tags,
 * summary, order (to be filled by LLM).
 */
export async function buildUnfinishedProcessedCache(
	token: string
): Promise<ProcessedItem[]> {
	const allItems = await fetchAllReadwiseReaderItems({
		token,
		withHtmlContent: true,
	});
	const highlightsBySourceUrl =
		await fetchAllReadwiseHighlightsBySourceUrl(token);
	const highlightsMap = Object.fromEntries(highlightsBySourceUrl);

	await mkdir(READWISE_CACHE_DIR, { recursive: true });

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

	return allItems.map((item) => {
		const joinKey = normalizeUrlForJoin(item.url.href);
		const highlights = highlightsMap[joinKey] ?? [];
		const dateGroup = item.last_moved_at
			.toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
			.replace(/\//g, ".");

		const isQueueArticle =
			item.location === "new" &&
			(item.category === "article" || !item.category);

		return {
			readwise_id: item.id,
			title: item.title,
			url: item.url.href,
			tags: [],
			display_tags: [],
			category: item.category ?? "article",
			location: item.location,
			last_moved_at: item.last_moved_at.toISOString(),
			date_group: dateGroup,
			highlights,
			summary: isQueueArticle ? item.summary : "",
			order: 0,
			needs_summarizing: isQueueArticle,
			needs_grouping: isQueueArticle,
		};
	});
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

async function fetchAndCacheArchiveItems(): Promise<ProcessedItem[]> {
	const token = process.env["READWISE_TOKEN"];
	if (!token) {
		console.warn(
			"[readwise] No READWISE_TOKEN set — cannot fetch archive items from API"
		);
		return [];
	}

	console.log("[readwise] Fetching archive items from Readwise API...");
	const archiveItems = await fetchAllReadwiseReaderItems({
		token,
		location: "archive",
	});
	const highlightsBySourceUrl =
		await fetchAllReadwiseHighlightsBySourceUrl(token);
	const highlightsMap = Object.fromEntries(highlightsBySourceUrl);

	const archiveProcessed: ProcessedItem[] = archiveItems.map((item) => {
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
			tags: [],
			display_tags: [],
			category: item.category ?? "article",
			location: item.location,
			last_moved_at: item.last_moved_at.toISOString(),
			date_group: dateGroup,
			highlights,
			summary: item.summary,
			order: 0,
			needs_summarizing: false,
			needs_grouping: false,
		};
	});

	const existing = await loadProcessedCache();
	const mergedMap = new Map<string, ProcessedItem>();
	for (const item of existing) {
		mergedMap.set(item.readwise_id, item);
	}
	for (const item of archiveProcessed) {
		const cached = mergedMap.get(item.readwise_id);
		if (cached) {
			mergedMap.set(item.readwise_id, {
				...item,
				tags: cached.tags.length > 0 ? cached.tags : item.tags,
				display_tags:
					cached.display_tags.length > 0
						? cached.display_tags
						: item.display_tags,
				summary: cached.summary || item.summary,
				order: cached.order || item.order,
			});
		} else {
			mergedMap.set(item.readwise_id, item);
		}
	}
	const merged = Array.from(mergedMap.values());
	await writeJsonCache(PROCESSED_CACHE_PATH, merged);
	console.log(
		`[readwise] Cached ${archiveProcessed.length} archive items (${merged.length} total)`
	);

	return archiveProcessed;
}

function processedToArchive(item: ProcessedItem): ReadwiseArchiveItem {
	return {
		id: item.readwise_id,
		readwise_id: item.readwise_id,
		title: item.title,
		url: item.url,
		last_moved_at: new Date(item.last_moved_at),
		summary: item.summary,
		location: item.location,
		category: item.category,
		dateGroup: item.date_group,
		highlights: item.highlights,
	};
}

export async function loadReadwiseArchive(): Promise<ReadwiseArchiveItem[]> {
	const token = process.env["READWISE_TOKEN"];
	if (token) {
		try {
			const fetched = await fetchAndCacheArchiveItems();
			if (fetched.length > 0) {
				return fetched.map(processedToArchive);
			}
		} catch (err) {
			console.warn(
				"[readwise] Failed to fetch archive from API, falling back to cache:",
				err
			);
		}
	}

	const items = await loadProcessedCache();
	const archive = items.filter((item) => item.location === "archive");
	return archive.map(processedToArchive);
}

/**
 * Fetches the current queue item IDs from the API, then merges fresh metadata
 * (title, url, timestamp) with LLM-enriched fields from the cache. Does NOT
 * write to the processed cache to avoid racing with the archive loader.
 */
async function fetchQueueItems(token: string): Promise<ProcessedItem[]> {
	console.log("[readwise] Fetching queue items from Readwise API...");
	const queueItems = await fetchAllReadwiseReaderItems({
		token,
		location: "new",
	});

	const cached = await loadProcessedCache();
	const cacheMap = new Map<string, ProcessedItem>();
	for (const item of cached) {
		cacheMap.set(item.readwise_id, item);
	}

	return queueItems.map((item) => {
		const existing = cacheMap.get(item.id);
		const dateGroup = item.last_moved_at
			.toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
			.replace(/\//g, ".");

		if (existing && existing.location === "new") {
			return {
				...existing,
				title: item.title,
				url: item.url.href,
				last_moved_at: item.last_moved_at.toISOString(),
				date_group: dateGroup,
			};
		}

		return {
			readwise_id: item.id,
			title: item.title,
			url: item.url.href,
			tags: [],
			display_tags: [],
			category: item.category ?? "article",
			location: item.location,
			last_moved_at: item.last_moved_at.toISOString(),
			date_group: dateGroup,
			highlights: [],
			summary: item.summary,
			order: 0,
			needs_summarizing: true,
			needs_grouping: true,
		};
	});
}

export async function loadReadwiseQueue(): Promise<ReadwiseQueueItem[]> {
	const token = process.env["READWISE_TOKEN"];
	let queue: ProcessedItem[];

	if (token) {
		try {
			queue = await fetchQueueItems(token);
		} catch (err) {
			console.warn(
				"[readwise] Failed to fetch queue from API, falling back to cache:",
				err
			);
			const items = await loadProcessedCache();
			queue = items.filter((item) => item.location === "new");
		}
	} else {
		const items = await loadProcessedCache();
		queue = items.filter((item) => item.location === "new");
	}

	return queue.map((item) => ({
		id: item.readwise_id,
		readwise_id: item.readwise_id,
		title: item.title,
		url: item.url,
		display_tags: item.display_tags,
		summary: item.summary,
		order: item.order,
	}));
}
