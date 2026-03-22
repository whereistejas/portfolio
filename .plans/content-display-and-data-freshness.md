# Content Display and Data Freshness

## Visual updates

### Two-line descriptions

Feed descriptions on queue, archive, and blog pages changed from `line-clamp-1`
to `line-clamp-2` in `global.css`. This shows more context for each item without
overwhelming the layout.

### Yellow middle-dot separators

The `·` separator between tags (inbox) and between category/date (archive) is now
wrapped in a `<span class="text-yellow-700 dark:text-yellow-600">` so the dot
stands out from the surrounding neutral text. Previously it was plain text inside
a `.join(" · ")` call; now each segment is mapped with the styled separator
rendered between items.

### Neutral-600 headers

All section headers except page titles now use `text-neutral-600` /
`dark:text-neutral-400`:

- **Info page row labels** (`row.astro`): changed from `text-yellow-700` to
  `text-neutral-600`.
- **Archive highlights heading**: changed from `text-yellow-700` to
  `text-neutral-600`.
- **Blog article prose headings**: set `--tw-prose-headings: var(--color-neutral-600)`
  on `article.blog-article` so `h1`–`h6` inside posts inherit the neutral color.

Page titles (rendered via `textorlink.astro` inside `<header>`) are intentionally
left unchanged.

## Data freshness bug fix

### Problem

The Readwise content loaders were serving stale data:

1. `loadReadwiseArchive()` short-circuited when the processed cache already
   contained archive items, never re-fetching from the API. Items moved in or out
   of the archive in Readwise were invisible until the cache was manually cleared.

2. `loadReadwiseQueue()` only read from the processed cache with no API fetch path.
   Items added to or removed from the queue in Readwise were not reflected.

3. `fetchAndCacheArchiveItems()` merged fresh items with a naive
   `[...existing, ...new]` spread, producing duplicate entries whenever the same
   item appeared in both the cache and the API response.

### Fix

- Both `loadReadwiseArchive()` and `loadReadwiseQueue()` now attempt an API fetch
  when `READWISE_TOKEN` is available. On failure (invalid token, network error)
  they fall back gracefully to the processed cache.

- A new `fetchAndCacheQueueItems()` function mirrors the archive fetch pattern for
  queue items.

- Cache merging uses a `Map<readwise_id, ProcessedItem>` to deduplicate. For
  archive items, LLM-enriched fields (`tags`, `display_tags`, `summary`, `order`)
  are preserved from the cache when present. For queue items, cached enrichments
  are kept while title/url/timestamp are refreshed from the API. Items that no
  longer appear in the API response for their location are pruned from the cache.
