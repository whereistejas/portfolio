// ========================================
// Readwise Reader API integration for Astro Content Collections
// ========================================

// ========================================
// Enums and Constants
// ========================================

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

// ========================================
// Core Types
// ========================================

/**
 * Represents a simplified Readwise Reader document entry
 * for use in Astro content collections.
 */
interface ReadwiseItem {
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
	/** Optional date group for rendering (added by loaders) */
	dateGroup?: string;
}

/**
 * Raw response structure from Readwise Reader API
 */
interface ReadwiseApiDocument {
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
interface ReadwiseApiResponse {
	results: ReadwiseApiDocument[];
	nextPageCursor?: string;
	count: number;
}

/**
 * Options for fetching documents from Readwise Reader API
 */
interface FetchReadwiseOptions {
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
 * Base serialized version of ReadwiseItem for storage in collections
 * URLs and Dates become strings when serialized
 */
interface ReadwiseItemSerializedBase {
	/** The original URL of the article/document (as string) */
	url: string;
	/** When this item was last moved/updated in Readwise (as ISO string) */
	last_moved_at: string;
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
 * Archive item with required dateGroup for grouped display
 */
interface ReadwiseArchiveItem extends ReadwiseItemSerializedBase {
	/** Date group for rendering (required for archive items) */
	dateGroup: string;
}

/**
 * Archive collection entry (flat structure for Astro)
 */
interface ReadwiseArchiveEntry extends ReadwiseArchiveItem {
	// Inherits all fields from ReadwiseArchiveItem, no nested 'data' property
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
	} while (nextPageCursor);

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
			id: item.id,
			title: item.title,
			summary: item.summary,
			url: item.url.href, // Convert URL object to string
			last_moved_at: item.last_moved_at.toISOString(), // Convert Date to ISO string
			location: item.location,
			category: item.category,
			dateGroup: formatDateForDisplay(item.last_moved_at), // Add date group for archive
		}));

		console.log('Processed archive entries count:', entries.length);
		return entries;
	} catch (error) {
		console.error('Error in loadReadwiseArchive:', error);
		throw error;
	}
}

// ========================================
// Utility Functions
// ========================================

/**
 * Formats a date for display in the UK format (DD.MM.YYYY)
 */
function formatDateForDisplay(date: Date): string {
	return date
		.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		})
		.replace(/\//g, ".");
}




