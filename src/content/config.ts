import { defineCollection, z } from 'astro:content';
import { loadReadwiseArchive } from './readwise.ts';

/**
 * Base schema for Readwise Reader items
 * Common fields shared by both archive and queue collections
 */
const readwiseBaseSchema = z.object({
	id: z.string(),

	url: z.object({
		href: z.string(),
		origin: z.string(),
	}),
	last_moved_at: z.date(),

	title: z.string(),
	summary: z.string(),
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

export const collections = {
	'readwise-archive': readwiseArchive,
	// 'readwise-queue': readwiseQueue,
};
