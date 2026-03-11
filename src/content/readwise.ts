import type { ProcessedItem } from "./llm.ts";

const PROCESSED_CACHE_PATH = "src/content/cache-processed.json";

const ReadwiseLocation = {
	NEW: "new",
	LATER: "later",
	SHORTLIST: "shortlist",
	ARCHIVE: "archive",
	FEED: "feed",
} as const;
type ReadwiseLocation =
	(typeof ReadwiseLocation)[keyof typeof ReadwiseLocation];

const ReadwiseCategory = {
	ARTICLE: "article",
	EMAIL: "email",
	RSS: "rss",
	HIGHLIGHT: "highlight",
	NOTE: "note",
	PDF: "pdf",
	EPUB: "epub",
	TWEET: "tweet",
	VIDEO: "video",
} as const;
type ReadwiseCategory =
	(typeof ReadwiseCategory)[keyof typeof ReadwiseCategory];

/**
 * Represents a simplified Readwise Reader document entry
 * for use in Astro content collections.
 */
type ReadwiseItem = {
	url: URL;
	last_moved_at: Date;
	title: string;
	summary: string;
	id: string;
	location: ReadwiseLocation;
	category?: ReadwiseCategory;
};

type ReadwiseApiDocument = {
	id: string;
	source_url: string;
	last_moved_at: string;
	title: string;
	summary: string;
	location: ReadwiseLocation;
	category: ReadwiseCategory;
};

type ReadwiseApiResponse = {
	results: ReadwiseApiDocument[];
	nextPageCursor?: string;
	count: number;
};

type ReadwiseExportHighlight = {
	text: string;
	is_deleted: boolean;
};

type ReadwiseExportBook = {
	source_url: string | null;
	is_deleted: boolean;
	highlights: ReadwiseExportHighlight[];
};

type ReadwiseExportResponse = {
	results: ReadwiseExportBook[];
	nextPageCursor: string | null;
};

type FetchReadwiseOptions = {
	token: string;
	location?: ReadwiseLocation;
	category?: ReadwiseCategory;
	updatedAfter?: string;
	withHtmlContent?: boolean;
};

/**
 * Archive item shape for Astro content collection
 */
export type ReadwiseArchiveItem = {
	readwise_id: string;
	title: string;
	url: string;
	last_moved_at: Date;
	summary: string;
	location: string;
	category: string;
	dateGroup: string;
	highlights: string[];
};

/**
 * Queue item shape for Astro content collection
 */
export type ReadwiseQueueItem = {
	readwise_id: string;
	title: string;
	url: string;
	display_tags: string[];
	summary: string;
	order: number;
};

export function normalizeUrlForJoin(input: string): string {
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

export async function fetchAllReadwiseHighlightsBySourceUrl(
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

		const data: ReadwiseExportResponse = await response.json();
		for (const book of data.results ?? []) {
			if (book.is_deleted || !book.source_url) {
				continue;
			}

			const key = normalizeUrlForJoin(book.source_url);
			const highlightTexts = (book.highlights ?? [])
				.filter((highlight) => !highlight.is_deleted)
				.map((highlight) => highlight.text)
				.filter((text) => text.length > 0);

			if (highlightTexts.length === 0) {
				continue;
			}

			const existing = highlightsBySourceUrl.get(key) ?? [];
			highlightsBySourceUrl.set(key, [...existing, ...highlightTexts]);
		}

		nextPageCursor = data.nextPageCursor || null;
	} while (nextPageCursor);

	return highlightsBySourceUrl;
}

/**
 * Fetches ALL documents from Readwise Reader API with pagination support.
 */
export async function fetchAllReadwiseReaderItems(
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

		const data: ReadwiseApiResponse = await response.json();
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
 * Loads the unified processed cache from disk.
 * Returns [] if file is missing or invalid (e.g. corrupt JSON).
 */
export async function loadProcessedCache(): Promise<ProcessedItem[]> {
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
		return parsed as ProcessedItem[];
	} catch (err) {
		console.warn(
			`[readwise] Failed to parse ${PROCESSED_CACHE_PATH}, returning empty:`,
			err
		);
		return [];
	}
}

/**
 * Content loader for Readwise archive items.
 * Filters processed cache by location === "archive".
 */
export async function loadReadwiseArchive(): Promise<ReadwiseArchiveItem[]> {
	const items = await loadProcessedCache();
	const archive = items.filter((item) => item.location === "archive");

	return archive.map((item) => ({
		readwise_id: item.readwise_id,
		title: item.title,
		url: item.url,
		last_moved_at: new Date(item.last_moved_at),
		summary: item.summary,
		location: item.location,
		category: item.category,
		dateGroup: item.date_group,
		highlights: item.highlights,
	}));
}

/**
 * Content loader for Readwise queue items.
 * Filters processed cache by location === "new".
 */
export async function loadReadwiseQueue(): Promise<ReadwiseQueueItem[]> {
	const items = await loadProcessedCache();
	const queue = items.filter((item) => item.location === "new");

	return queue.map((item) => ({
		readwise_id: item.readwise_id,
		title: item.title,
		url: item.url,
		display_tags: item.display_tags,
		summary: item.summary,
		order: item.order,
	}));
}
