# Cache pipeline refactor

Three-phase refactor of the Readwise → Astro data flow. The goal is to delete
the defunct LLM summariser, unify archive + queue around a single
`cache-processed.json`, and surface a more useful ordering for the inbox.

## Phase 1 — Remove LLM pipeline and prune dead fields

LLM summarisation and grouping stopped being used some time ago but the code
and the now-dead fields they populated (`tags`, `display_tags`, `order`,
`needs_summarizing`, `needs_grouping`) are still present in schemas, loaders,
and page templates. They should all go.

Steps:

1. Delete `src/content/llm.ts`.
2. Remove `SUMMARY_CACHE_PATH` and `GROUPED_CACHE_PATH` from
   `src/content/utils.ts`.
3. Drop `@anthropic-ai/sdk` from `package.json` and run `bun install`.
4. Strip `ANTHROPIC_API_KEY` and the commented `Build queue` block from
   `.github/workflows/deploy.yml`; rename the "Update LLM cache files" commit
   message to "Update cache files".
5. Remove the following from `src/content/types.ts`:
   - `processedItemSchema`: `tags`, `display_tags`, `order`,
     `needs_summarizing`, `needs_grouping`
   - `readwiseQueueSchema`: `display_tags`, `order`
   Zod's default `.strip()` mode silently drops unknown keys, so the checked-in
   `cache-processed.json` does not need to be rewritten.
6. Stop setting those fields in `src/content/readwise.ts`.
7. `src/pages/inbox.astro`: remove `display_tags` rendering. Sort by
   `last_moved_at desc` as a placeholder until Phase 3 adds
   `last_highlighted_at`.
8. Update `CLAUDE.md` — drop the LLM pipeline paragraph and
   `ANTHROPIC_API_KEY` mentions.
9. `bun run check` — clean.

## Phase 2 — Unify the cache pipeline

Today `loadReadwiseArchive` writes `cache-processed.json` at build time and
`loadReadwiseQueue` fetches queue items live each build. The inbox page has
been empty in offline builds because of that split. Move all fetching into
`build:queue` and have Astro read a single cache.

Steps:

1. Extend `build:queue` to fetch both archive + queue in one pass, merge them,
   and write `cache-processed.json` as the single source of truth.
2. Strip the API-fetching branches from `loadReadwiseArchive` and
   `loadReadwiseQueue` — they become thin filters over the processed cache by
   `location`.
3. CI: add a `Build queue` step before `Build site`, and move `READWISE_TOKEN`
   into it. The build step is now fully offline.

## Phase 3 — Sort the inbox by `last_highlighted_at`

The reading queue is more useful when the most recently highlighted items
surface first. Items with no highlights fall back to `last_moved_at`.

Steps:

1. Extend `readwiseExportHighlightSchema` with `highlighted_at`.
2. Change `fetchAllReadwiseHighlightsBySourceUrl` to return
   `sourceUrl → { texts, lastHighlightedAt }`.
3. Add `last_highlighted_at: string | null` to `processedItemSchema` and
   `readwiseQueueSchema`.
4. `inbox.astro`: sort by `last_highlighted_at desc`, fall back to
   `last_moved_at` when null.

## Verification cadence

After each phase and each numbered step, run `bun run check` and confirm
generated types, schemas, and templates still agree. Commit at the end of each
phase, not per step.
