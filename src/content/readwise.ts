import { MatterClient } from "./matter.ts";
import type {
	MatterItem,
	ProcessedItem,
	ReadwiseArchiveItem,
	ReadwiseQueueItem,
} from "./types.ts";
import { processedItemSchema } from "./types.ts";
import {
	normalizeUrlForJoin,
	PROCESSED_CACHE_PATH,
	READWISE_FROZEN_PATH,
	writeJsonCache,
} from "./utils.ts";

function cleanAuthor(raw: string | null | undefined): string {
	if (!raw) return "";
	const trimmed = raw.trim();
	if (!trimmed || trimmed.toLowerCase() === "unknown") return "";
	if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(trimmed)) return "";
	return trimmed;
}

type Highlights = { texts: string[]; lastHighlightedAt: string | null };

function joinKeys(url: string): string[] {
	const exact = normalizeUrlForJoin(url);
	const withoutQuery = exact.replace(/\?.*$/, "");
	return withoutQuery === exact ? [exact] : [exact, withoutQuery];
}

function pickLatest(a: string | null, b: string | null): string | null {
	if (!a) return b;
	if (!b) return a;
	return a > b ? a : b;
}

async function fetchHighlights(
	client: MatterClient,
	itemId: string
): Promise<Highlights> {
	const annotations = await client.listAnnotations(itemId);
	return {
		texts: annotations.map((a) => a.text).filter((text) => text.length > 0),
		lastHighlightedAt: annotations.reduce<string | null>(
			(acc, a) => pickLatest(acc, new Date(a.created_at).toISOString()),
			null
		),
	};
}

export async function loadProcessedCache(
	path: string = PROCESSED_CACHE_PATH
): Promise<ProcessedItem[]> {
	const file = Bun.file(path);
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
		console.warn(`[readwise] Failed to parse ${path}, returning empty:`, err);
		return [];
	}
}

function toProcessedItem(
	item: MatterItem,
	highlights: Highlights
): ProcessedItem {
	const movedAt = new Date(item.updated_at);
	const dateGroup = movedAt
		.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		})
		.replace(/\//g, ".");

	return {
		readwise_id: item.id,
		title: item.title,
		url: new URL(item.url).href,
		category: item.content_type ?? "article",
		location: item.status === "archive" ? "archive" : "new",
		last_moved_at: movedAt.toISOString(),
		last_highlighted_at: highlights.lastHighlightedAt,
		date_group: dateGroup,
		highlights: highlights.texts,
		summary: item.excerpt ?? "",
		author: cleanAuthor(item.author?.name),
	};
}

/**
 * Rebuild `cache-processed.json` from the Matter queue and archive, plus the
 * Readwise archive frozen in `cache-readwise.json`. Called by
 * `bun run build:queue`. Astro loaders never hit the API directly — they read
 * from the committed cache.
 *
 * Annotations are only fetched for items whose `updated_at` changed since the
 * last refresh; Matter bumps it whenever an annotation is added. A Matter item
 * without annotations keeps the Readwise highlights for the same URL.
 */
export async function refreshProcessedCache(token: string): Promise<void> {
	console.log("[matter] Fetching queue + archive items from Matter API...");
	const client = new MatterClient(token);
	const [matterItems, previous, frozen] = await Promise.all([
		client.listItems(["queue", "archive"]),
		loadProcessedCache(),
		loadProcessedCache(READWISE_FROZEN_PATH),
	]);

	const previousById = new Map(
		previous.map((item) => [item.readwise_id, item])
	);
	// Matter drops tracking parameters when it saves a URL, so a Readwise URL
	// with a query string also matches the same URL without one.
	const readwiseByUrl = new Map<string, ProcessedItem>();
	for (const item of frozen) {
		for (const key of joinKeys(item.url)) {
			if (!readwiseByUrl.get(key)?.highlights.length) {
				readwiseByUrl.set(key, item);
			}
		}
	}

	const items: ProcessedItem[] = [];
	const matterUrls = new Set<string>();
	let annotationFetches = 0;
	for (const item of matterItems) {
		const keys = joinKeys(item.url);
		for (const key of keys) matterUrls.add(key);

		const cached = previousById.get(item.id);
		let highlights: Highlights;
		if (cached?.last_moved_at === new Date(item.updated_at).toISOString()) {
			highlights = {
				texts: cached.highlights,
				lastHighlightedAt: cached.last_highlighted_at,
			};
		} else {
			annotationFetches++;
			highlights = await fetchHighlights(client, item.id);
		}

		const readwise = keys
			.map((key) => readwiseByUrl.get(key))
			.find((match) => match !== undefined);
		if (highlights.texts.length === 0 && readwise) {
			highlights = {
				texts: readwise.highlights,
				lastHighlightedAt: readwise.last_highlighted_at,
			};
		}

		items.push(toProcessedItem(item, highlights));
	}

	const readwiseArchive = frozen.filter(
		(item) =>
			item.location === "archive" &&
			!joinKeys(item.url).some((key) => matterUrls.has(key))
	);

	const merged = [...items, ...readwiseArchive].sort((a, b) =>
		b.last_moved_at.localeCompare(a.last_moved_at)
	);
	await writeJsonCache(PROCESSED_CACHE_PATH, merged);

	const archived = items.filter((item) => item.location === "archive").length;
	console.log(
		`[matter] Cached ${archived} archive + ${items.length - archived} queue items from Matter and ${readwiseArchive.length} archive items from Readwise (${merged.length} total, annotations fetched for ${annotationFetches})`
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
			highlights: item.highlights,
			last_moved_at: new Date(item.last_moved_at),
			last_highlighted_at: item.last_highlighted_at
				? new Date(item.last_highlighted_at)
				: null,
		}));
}
