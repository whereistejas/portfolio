import { defineCollection, z } from 'astro:content';
import { loadReadwiseArchive } from './readwise.ts';

// ========================================
// Readwise Collection Schemas
// ========================================

/**
 * Base schema for Readwise Reader items
 * Common fields shared by both archive and queue collections
 */
const readwiseBaseSchema = z.object({
	// Core item data
	id: z.string(),
	title: z.string(),
	summary: z.string(),

	// URLs and dates - these get serialized as strings in the collection
	url: z.string().url(), // URL objects become strings
	last_moved_at: z.string().datetime(), // Date objects become ISO strings

	// Readwise metadata
	location: z.enum(['new', 'later', 'shortlist', 'archive', 'feed']),
	category: z.enum(['article', 'email', 'rss', 'highlight', 'note', 'pdf', 'epub', 'tweet', 'video']).optional(),
});

/**
 * Schema for Readwise Archive items
 * Archive items are grouped by date for display
 */
const readwiseArchiveSchema = readwiseBaseSchema.extend({
	// Archive items include date grouping information
	dateGroup: z.string(), // Required for archive items
});

// ========================================
// Collection Definitions
// ========================================

/**
 * Readwise Archive Collection
 * Contains items that have been read/archived, grouped by date
 */
const readwiseArchive = defineCollection({
	loader: async () => {
		const token = import.meta.env.READWISE_TOKEN;
		if (!token) {
			throw new Error('READWISE_TOKEN environment variable is required');
		}
		return loadReadwiseArchive(token);
	},
	schema: readwiseArchiveSchema,
});

// ========================================
// Export Collections
// ========================================

export const collections = {
	'readwise-archive': readwiseArchive,
	// 'readwise-queue': readwiseQueue,
};
