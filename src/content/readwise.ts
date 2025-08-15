import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Cache file path for storing Readwise API responses
 */
const CACHE_DIR = '.readwise-cache';
const CACHE_FILE = join(CACHE_DIR, 'readwise-items.json');

/**
 * Readwise Reader location types
 */
enum ReadwiseLocation {
	NEW = 'new',
	LATER = 'later',
	SHORTLIST = 'shortlist',
	ARCHIVE = 'archive',
	FEED = 'feed'
}

/**
 * Readwise Reader content categories
 */
enum ReadwiseCategory {
	ARTICLE = 'article',
	EMAIL = 'email',
	RSS = 'rss',
	HIGHLIGHT = 'highlight',
	NOTE = 'note',
	PDF = 'pdf',
	EPUB = 'epub',
	TWEET = 'tweet',
	VIDEO = 'video'
}

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
}

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
}

/**
 * Readwise API response structure
 */
type ReadwiseApiResponse = {
	results: ReadwiseApiDocument[];
	nextPageCursor?: string;
	count: number;
}

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
}

/**
 * Archive item with required dateGroup for grouped display
 */
type ReadwiseArchiveItem = ReadwiseItem & {
	/** Date group for rendering (required for archive items) */
	dateGroup: string;
}

/**
 * Archive collection entry (flat structure for Astro)
 */
type ReadwiseArchiveEntry = ReadwiseArchiveItem & {
	// Inherits all fields from ReadwiseArchiveItem, no nested 'data' property
}

/**
 * Queue item structure (matches display-documents-cache.json)
 */
type ReadwiseQueueItem = {
	id: string;
	title: string;
	url: string;
	tags: string[];
	summary: string;
	order: number;
}

/**
 * Queue collection entry (flat structure for Astro)
 */
type ReadwiseQueueEntry = ReadwiseQueueItem & {
	// Inherits all fields from ReadwiseQueueItem, no nested 'data' property
}

/**
 * Serialized cache data structure
 */
type CacheData = {
	items: ReadwiseItem[];
	timestamp: number;
	options: FetchReadwiseOptions;
}

/**
 * Cache management for Readwise API responses
 */
class ReadwiseCache {
	/**
	 * Save items to cache file
	 */
	static async saveToCache(items: ReadwiseItem[], options: FetchReadwiseOptions): Promise<void> {
		try {
			// Ensure cache directory exists
			if (!existsSync(CACHE_DIR)) {
				await mkdir(CACHE_DIR, { recursive: true });
			}

			const cacheData = {
				items,
				timestamp: Date.now(),
				options: {
					...options,
					token: '[REDACTED]' // Don't store the actual token
				}
			};

			await writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2));
			console.log('✅ Cached Readwise data successfully');
		} catch (error) {
			console.warn('⚠️ Failed to save cache:', error);
		}
	}

	/**
	 * Load items from cache file
	 */
	static async loadFromCache(): Promise<ReadwiseItem[] | null> {
		try {
			if (!existsSync(CACHE_FILE)) {
				console.log('📁 No cache file found');
				return null;
			}

			const cacheContent = await readFile(CACHE_FILE, 'utf-8');
			const cacheData = JSON.parse(cacheContent);

			// Deserialize items back to ReadwiseItem objects
			const items: ReadwiseItem[] = cacheData.items.map((item: any) => ({
				id: item.id,
				url: new URL(item.url),
				last_moved_at: new Date(item.last_moved_at),
				title: item.title,
				summary: item.summary,
				location: item.location,
				category: item.category,
			}));

			console.log(`📦 Loaded ${items.length} items from cache`);
			return items;
		} catch (error) {
			console.warn('⚠️ Failed to load cache:', error);
			return null;
		}
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
			// Handle network errors, timeout, or other fetch exceptions
			console.error('❌ Network error or fetch exception:', error);

			if (process.env.NODE_ENV !== 'production') {
				// Try to use cache as fallback
				console.log('🔄 Attempting to use cached data due to network error...');
				const cachedItems = await ReadwiseCache.loadFromCache();
				if (cachedItems) {
					console.log('✅ Using cached data instead due to network error');
					return cachedItems.sort((a, b) => b.last_moved_at.getTime() - a.last_moved_at.getTime());
				} else {
					console.error('❌ No cache available and network error occurred');
					throw new Error(`Network error occurred and no cache available: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
	} while (nextPageCursor);

	// Only cache the response if all requests were successful
	if (allRequestsSuccessful && process.env.NODE_ENV !== 'production') {
		await ReadwiseCache.saveToCache(items, options);
	}

	// Sort items by date in descending order (most recent first)
	return items.sort((a, b) => b.last_moved_at.getTime() - a.last_moved_at.getTime());
}

/**
 * Content loader for Readwise archive items.
 * Archive items include dateGroup for grouped display.
 */
export async function loadReadwiseArchive(token: string): Promise<ReadwiseArchiveEntry[]> {
	try {
		const items = await fetchAllReadwiseReaderItems({
			token,
			location: ReadwiseLocation.ARCHIVE,
		});

		// Return flat structure for Astro Content Collections
		const entries = items.map(item => ({
			...item,
			dateGroup:
				item.last_moved_at
					.toLocaleDateString("en-GB", {
						day: "2-digit",
						month: "short",
						year: "numeric",
					})
					.replace(/\//g, ".")
		}));

		console.log('Processed archive entries count:', entries.length);
		return entries;
	} catch (error) {
		console.error('Error in loadReadwiseArchive:', error);
		throw error;
	}
}

/**
 * Content loader for Readwise queue items.
 * Queue items are loaded from the display-documents-cache.json file (generated by LLM processing)
 */
export async function loadReadwiseQueue(): Promise<ReadwiseQueueEntry[]> {
	try {
		const displayCachePath = 'src/content/display-documents-cache.json';

		// Check if the display cache exists
		if (!existsSync(displayCachePath)) {
			console.log('📁 No display cache found, returning empty queue');
			return [];
		}

		// Read the display cache
		const cacheContent = await readFile(displayCachePath, 'utf-8');
		const displayDocuments: ReadwiseQueueItem[] = JSON.parse(cacheContent);

		console.log('Processed queue entries count:', displayDocuments.length);
		return displayDocuments;
	} catch (error) {
		console.error('Error in loadReadwiseQueue:', error);
		// Return empty array instead of throwing to prevent build failures
		return [];
	}
}

// Export the fetch function for use by the LLM processing script
export { fetchAllReadwiseReaderItems };
