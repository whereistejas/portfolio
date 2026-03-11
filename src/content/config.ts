import { defineCollection, z } from "astro:content";
import { loadReadwiseArchive, loadReadwiseQueue } from "./readwise.ts";

/**
 * Readwise collections load from cache-processed.json. Run `bun run build:queue`
 * before `bun run build` to populate the cache (requires READWISE_TOKEN and
 * ANTHROPIC_API_KEY).
 */

/**
 * Schema for Readwise Archive items
 * Items from archive location, grouped by date
 */
const readwiseArchiveSchema = z.object({
	readwise_id: z.string(),
	title: z.string(),
	url: z.string(),
	last_moved_at: z.date(),
	summary: z.string(),
	location: z.string(),
	category: z.string(),
	dateGroup: z.string(),
	highlights: z.array(z.string()),
});

/**
 * Schema for Readwise Queue items
 * LLM-processed items from the reading queue with display tags and summaries
 */
const readwiseQueueSchema = z.object({
	readwise_id: z.string(),
	title: z.string(),
	url: z.string(),
	display_tags: z.array(z.string()),
	summary: z.string(),
	order: z.number(),
});

/**
 * Readwise Archive Collection
 */
const readwiseArchive = defineCollection({
	loader: loadReadwiseArchive,
	schema: readwiseArchiveSchema,
});

/**
 * Readwise Queue Collection
 */
const readwiseQueue = defineCollection({
	loader: loadReadwiseQueue,
	schema: readwiseQueueSchema,
});

export const collections = {
	"readwise-archive": readwiseArchive,
	"readwise-queue": readwiseQueue,
};
