# Readwise Types & Structure Restructure

---
name: Readwise types restructure
overview: "Reorganise Readwise code into types.ts, readwise.ts (processing), llm.ts (LLM only), and config.ts (collections only). Use Zod throughout."
status: implemented
---

## Overview

Reorganise Readwise-related code into clear layers: shared types, processing logic, LLM-specific logic, and minimal config. Use Zod throughout for validation and schema derivation.

---

## 1. Types (`src/content/types.ts`)

Centralise all Readwise and cache types as Zod schemas. Export inferred TypeScript types.

### Readwise API types (formalise API spec)

```ts
// Location & category enums (Readwise API v3 list)
export const readwiseLocationSchema = z.enum([
  "new", "later", "shortlist", "archive", "feed"
]);
export type ReadwiseLocation = z.infer<typeof readwiseLocationSchema>;

export const readwiseCategorySchema = z.enum([
  "article", "email", "rss", "highlight", "note",
  "pdf", "epub", "tweet", "video"
]);
export type ReadwiseCategory = z.infer<typeof readwiseCategorySchema>;

// List API (v3)
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

// Export API (v2)
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
```

### Cache types

```ts
// Raw cache (dev workflows)
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

// Processed cache (what Astro reads)
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
});
export type ProcessedItem = z.infer<typeof processedItemSchema>;
```

### Collection schemas (derived from ProcessedItem)

Archive and queue are filtered views of `ProcessedItem`. Use `.pick()` / `.extend()` to derive:

```ts
// Archive: location=archive, needs dateGroup, highlights
export const readwiseArchiveSchema = processedItemSchema.pick({
  readwise_id: true,
  title: true,
  url: true,
  last_moved_at: true,
  summary: true,
  location: true,
  category: true,
  date_group: true,
  highlights: true,
}).transform((v) => ({
  ...v,
  dateGroup: v.date_group,
  last_moved_at: new Date(v.last_moved_at),
}));
// Or keep date_group and map in loader

// Queue: location=new, needs display_tags, summary, order
export const readwiseQueueSchema = processedItemSchema.pick({
  readwise_id: true,
  title: true,
  url: true,
  display_tags: true,
  summary: true,
  order: true,
});
```

**Note on `reference()`:** Astro's `reference(collection)` links entries across collections (foreign-key style). Our archive and queue are filtered views of the same source, not separate collections that reference each other. The "relationship" here is schema derivation (Zod `.pick()`/`.extend()`), not cross-collection references. If we later add a `readwise-processed` collection with all items, archive/queue could use `reference('readwise-processed')` to point at it—but that would duplicate IDs and change the loader model. For now, schema derivation is the right relationship.

---

## 2. Processing logic (`src/content/readwise.ts`)

Single place for all Readwise item processing:

- `normalizeUrlForJoin()`
- `fetchAllReadwiseReaderItems()` – API fetch
- `fetchAllReadwiseHighlightsBySourceUrl()` – API fetch
- `loadProcessedCache()` – read cache, validate with `processedItemSchema`
- `loadReadwiseArchive()` – filter `location === "archive"`, map to archive shape
- `loadReadwiseQueue()` – filter `location === "new"`, map to queue shape

No types defined here—import from `types.ts`. No LLM logic.

---

## 3. LLM / reading queue (`src/content/llm.ts`)

Only LLM-specific logic:

- `summariseDocument()`, `tagAndGroupDocuments()`, `processDocuments()`
- LLM cache paths, prompts, Anthropic client
- `main()` – build script that:
  1. Fetches items + highlights (from `readwise.ts`)
  2. Writes raw cache
  3. Runs LLM for queue articles
  4. Builds `ProcessedItem[]` and writes processed cache

Imports `ProcessedItem` and API types from `types.ts`. Imports fetch/helpers from `readwise.ts`.

---

## 4. Config (`src/content/config.ts`)

Only collection definitions:

```ts
import { defineCollection } from "astro:content";
import { loadReadwiseArchive, loadReadwiseQueue } from "./readwise.ts";
import { readwiseArchiveSchema, readwiseQueueSchema } from "./types.ts";

export const collections = {
  "readwise-archive": defineCollection({
    loader: loadReadwiseArchive,
    schema: readwiseArchiveSchema,
  }),
  "readwise-queue": defineCollection({
    loader: loadReadwiseQueue,
    schema: readwiseQueueSchema,
  }),
};
```

No inline schemas, no loader logic, no comments beyond what’s needed.

---

## File layout (final)

```
src/content/
├── types.ts          # All Zod schemas + inferred types
├── readwise.ts       # Fetch, cache load, archive/queue loaders
├── llm.ts            # LLM summarise/group, build script
├── config.ts         # defineCollection only
└── cache-processed.json
```

---

## Commit order

1. **Add `types.ts`** – Zod schemas for API, cache, archive, queue. No behaviour change.
2. **Refactor `readwise.ts`** – Use types from `types.ts`, keep processing logic.
3. **Refactor `llm.ts`** – Use types from `types.ts`, keep LLM logic.
4. **Slim `config.ts`** – Import schemas and loaders, define collections only.

---

## Schema details to finalise

- **last_moved_at**: Store as ISO string in cache; loader returns `Date` for collection. Zod can use `z.coerce.date()` or a transform.
- **Archive schema**: Use `date_group` or `dateGroup`? Align with `processedItemSchema` and page usage.
- **Queue schema**: `display_tags` – allow variable length or enforce `.length(5)` for LLM output?
