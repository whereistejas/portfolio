import { DISPLAY_CACHE_PATH, type DisplayDocument } from "./llm.ts";

const CACHE_FILE = ".readwise-cache/readwise-items.json";

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
	/** The original URL of the article/document */
	url: URL;
	/** When this item was last moved/updated in Readwise */
	last_moved_at: Date;
	/** The title of the article/document */
	title: string;
	/** AI-generated summary of the content */
	summary: string;
	/** Unique identifier from Readwise */
	id: string;
	/** Location in Readwise (archive, later, etc.) */
	location: ReadwiseLocation;
	/** Category of content (article, pdf, etc.) */
	category?: ReadwiseCategory;
};

/**
 * Raw response structure from Readwise Reader API
 */
type ReadwiseApiDocument = {
	id: string;
	source_url: string;
	last_moved_at: string; // ISO8601 date string from API
	title: string;
	summary: string;
	location: ReadwiseLocation;
	category: ReadwiseCategory;
};

/**
 * Readwise API response structure
 */
type ReadwiseApiResponse = {
	results: ReadwiseApiDocument[];
	nextPageCursor?: string;
	count: number;
};

/**
 * Options for fetching documents from Readwise Reader API
 */
type FetchReadwiseOptions = {
	/** Your Readwise API token */
	token: string;
	/** Filter by location */
	location?: ReadwiseLocation;
	/** Filter by category */
	category?: ReadwiseCategory;
	/** Only fetch items updated after this ISO8601 date string */
	updatedAfter?: string;
	/** Whether to include HTML content in response */
	withHtmlContent?: boolean;
};

/**
 * Archive item with required dateGroup for grouped display
 */
type ReadwiseArchiveItem = ReadwiseItem & {
	/** Date group for rendering (required for archive items) */
	dateGroup: string;
};

/**
 * Serialized cache data structure
 */
type CacheData = {
	items: ReadwiseItem[];
	timestamp: number;
	options: FetchReadwiseOptions;
};

async function saveToCache(
	items: ReadwiseItem[],
	options: FetchReadwiseOptions
): Promise<void> {
	try {
		const cacheData: CacheData = {
			items,
			timestamp: Date.now(),
			options: {
				...options,
				token: "[REDACTED]",
			},
		};

		await Bun.write(CACHE_FILE, JSON.stringify(cacheData, null, 2));
		console.log("✅ Cached Readwise data successfully");
	} catch (error) {
		console.warn("⚠️ Failed to save cache:", error);
	}
}

async function loadFromCache(): Promise<ReadwiseItem[] | null> {
	try {
		const cacheFile = Bun.file(CACHE_FILE);
		if (!(await cacheFile.exists())) {
			console.log("📁 No cache file found");
			return null;
		}

		const cacheContent = await cacheFile.text();
		const cacheData: CacheData = JSON.parse(cacheContent);

		const items: ReadwiseItem[] = cacheData.items.map((item) => {
			const base: ReadwiseItem = {
				id: item.id,
				url: new URL(item.url as unknown as string),
				last_moved_at: new Date(item.last_moved_at as unknown as string),
				title: item.title,
				summary: item.summary,
				location: item.location,
			};
			if (item.category) {
				base.category = item.category;
			}
			return base;
		});

		console.log(`📦 Loaded ${items.length} items from cache`);
		return items;
	} catch (error) {
		console.warn("⚠️ Failed to load cache:", error);
		return null;
	}
}

/**
 * Fetches ALL documents from Readwise Reader API with pagination support.
 * Returns a flat array of ReadwiseItem objects for maximum flexibility.
 */
async function fetchAllReadwiseReaderItems(
	options: FetchReadwiseOptions
): Promise<ReadwiseItem[]> {
	const { token, location, category, updatedAfter, withHtmlContent } = options;

	const baseUrl = "https://readwise.io/api/v3/list/";
	const items: ReadwiseItem[] = [];

	let nextPageCursor: string | null = null;
	let allRequestsSuccessful = true;

	do {
		const url = new URL(baseUrl);
		if (location) url.searchParams.set("location", location);
		if (category) url.searchParams.set("category", category);
		if (updatedAfter) url.searchParams.set("updatedAfter", updatedAfter);
		if (withHtmlContent != null)
			url.searchParams.set("withHtmlContent", String(withHtmlContent));
		if (nextPageCursor) url.searchParams.set("pageCursor", nextPageCursor);

		try {
			const response = await fetch(url.toString(), {
				headers: {
					Authorization: `Token ${token}`,
				},
			});

			if (!response.ok) {
				allRequestsSuccessful = false;
				throw new Error(
					`Failed to fetch Reader items: ${response.status} ${response.statusText}`
				);
			}

			const data: ReadwiseApiResponse = await response.json();
			const docs = data.results ?? [];

			for (const doc of docs) {
				const item: ReadwiseItem = {
					id: doc.id,
					url: new URL(doc.source_url),
					last_moved_at: new Date(doc.last_moved_at),
					title: doc.title,
					summary: doc.summary,
					location: doc.location as ReadwiseLocation,
					category: doc.category as ReadwiseCategory,
				};

				items.push(item);
			}

			nextPageCursor = data.nextPageCursor || null;
		} catch (error) {
			allRequestsSuccessful = false;
			console.error("❌ Network error or fetch exception:", error);

			// In non-production, try cache fallback
			if (process.env.NODE_ENV !== "production") {
				console.log("🔄 Attempting to use cached data due to network error...");
				const cachedItems = await loadFromCache();
				if (cachedItems) {
					console.log("✅ Using cached data instead due to network error");
					return cachedItems.sort(
						(a, b) => b.last_moved_at.getTime() - a.last_moved_at.getTime()
					);
				}
			}

			throw new Error(
				`Network error occurred: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	} while (nextPageCursor);

	// Only cache the response if all requests were successful
	if (allRequestsSuccessful && process.env.NODE_ENV !== "production") {
		await saveToCache(items, options);
	}

	// Sort items by date in descending order (most recent first)
	return items.sort(
		(a, b) => b.last_moved_at.getTime() - a.last_moved_at.getTime()
	);
}

/**
 * Content loader for Readwise archive items.
 * Archive items include dateGroup for grouped display.
 */
export async function loadReadwiseArchive(
	token: string
): Promise<ReadwiseArchiveItem[]> {
	try {
		const items = await fetchAllReadwiseReaderItems({
			token,
			location: ReadwiseLocation.ARCHIVE,
		});

		// Return flat structure for Astro Content Collections
		const entries = items.map((item) => ({
			...item,
			dateGroup: item.last_moved_at
				.toLocaleDateString("en-GB", {
					day: "2-digit",
					month: "short",
					year: "numeric",
				})
				.replace(/\//g, "."),
		}));

		console.log("Processed archive entries count:", entries.length);
		return entries;
	} catch (error) {
		console.error("Error in loadReadwiseArchive:", error);
		throw error;
	}
}

/**
 * Content loader for Readwise queue items.
 * Queue items are loaded from the cache-display.json file (generated by LLM processing)
 */
export async function loadReadwiseQueue(): Promise<DisplayDocument[]> {
	try {
		const displayCacheFile = Bun.file(DISPLAY_CACHE_PATH);

		if (!(await displayCacheFile.exists())) {
			console.log("📁 No display cache found, returning empty queue");
			return [];
		}

		const cacheContent = await displayCacheFile.text();
		const displayDocuments: DisplayDocument[] = JSON.parse(cacheContent);

		console.log("Processed queue entries count:", displayDocuments.length);
		return displayDocuments;
	} catch (error) {
		console.error("Error in loadReadwiseQueue:", error);
		return [];
	}
}

// Export the fetch function for use by the LLM processing script
export { fetchAllReadwiseReaderItems };
