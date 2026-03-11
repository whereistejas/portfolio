import { z } from "astro/zod";

export const readwiseLocationSchema = z.enum([
	"new",
	"later",
	"shortlist",
	"archive",
	"feed",
]);
export type ReadwiseLocation = z.infer<typeof readwiseLocationSchema>;

export const readwiseCategorySchema = z.enum([
	"article",
	"email",
	"rss",
	"highlight",
	"note",
	"pdf",
	"epub",
	"tweet",
	"video",
]);
export type ReadwiseCategory = z.infer<typeof readwiseCategorySchema>;

export const readwiseApiDocumentSchema = z.object({
	id: z.string(),
	source_url: z.string(),
	last_moved_at: z.string(),
	title: z.string(),
	summary: z.string(),
	location: readwiseLocationSchema,
	category: readwiseCategorySchema,
});
export type ReadwiseApiDocument = z.infer<typeof readwiseApiDocumentSchema>;

export const readwiseExportHighlightSchema = z.object({
	text: z.string(),
	is_deleted: z.boolean(),
});
export const readwiseExportBookSchema = z.object({
	source_url: z.string().nullable(),
	is_deleted: z.boolean(),
	highlights: z.array(readwiseExportHighlightSchema),
});
export type ReadwiseExportBook = z.infer<typeof readwiseExportBookSchema>;

export const readwiseExportResponseSchema = z.object({
	results: z.array(readwiseExportBookSchema),
	nextPageCursor: z.coerce.string().nullable(),
});

export const rawCacheItemSchema = z.object({
	id: z.string(),
	url: z.string(),
	last_moved_at: z.string(),
	title: z.string(),
	summary: z.string(),
	location: readwiseLocationSchema,
	category: z.string(),
});
export const rawCacheSchema = z.object({
	items: z.array(rawCacheItemSchema),
	highlightsBySourceUrl: z.record(z.string(), z.array(z.string())),
});

export const processedItemSchema = z.object({
	readwise_id: z.string(),
	title: z.string(),
	url: z.string(),
	tags: z.array(z.string()),
	display_tags: z.array(z.string()),
	category: z.string(),
	location: z.string(),
	last_moved_at: z.string(),
	date_group: z.string(),
	highlights: z.array(z.string()),
	summary: z.string(),
	order: z.number(),
	needs_summarizing: z.boolean().default(false),
	needs_grouping: z.boolean().default(false),
});
export type ProcessedItem = z.infer<typeof processedItemSchema>;

export const readwiseArchiveSchema = z.object({
	id: z.string(),
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
export type ReadwiseArchiveItem = z.infer<typeof readwiseArchiveSchema>;

export const readwiseQueueSchema = z.object({
	id: z.string(),
	readwise_id: z.string(),
	title: z.string(),
	url: z.string(),
	display_tags: z.array(z.string()),
	summary: z.string(),
	order: z.number(),
});
export type ReadwiseQueueItem = z.infer<typeof readwiseQueueSchema>;

export type ReadwiseItem = {
	id: string;
	url: URL;
	last_moved_at: Date;
	title: string;
	summary: string;
	location: ReadwiseLocation;
	category?: ReadwiseCategory;
};

export type FetchReadwiseOptions = {
	token: string;
	location?: ReadwiseLocation;
	category?: ReadwiseCategory;
	updatedAfter?: string;
	withHtmlContent?: boolean;
};
