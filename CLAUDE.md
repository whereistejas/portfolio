# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package manager and runtime: Bun only

**Never use `npm`, `yarn`, `pnpm`, `npx`, `node`, `ts-node`, or `vite` in this repo.** All scripts, installs, and ad-hoc runs must go through Bun. CI (`.github/workflows/deploy.yml`) installs and builds exclusively with `bun`, and the package scripts shell out to `bunx --bun astro …`.

- Install deps: `bun install` (never `npm install`).
- Run package scripts: `bun run <script>` (never `npm run …`).
- Execute a TS/JS file: `bun <file.ts>` (never `node <file>`).
- One-off CLI binaries: `bunx <tool>` (never `npx <tool>`).
- Reading/writing files from repo scripts: prefer `Bun.file()` and `Bun.write()` over `node:fs`.
- Do not introduce `dotenv` — Bun auto-loads `.env`.

If `bun` is not on `PATH` (common in sandboxed shells), fall back to `$HOME/.bun/bin/bun` rather than substituting another runtime.

## Common commands

- `bun run dev` — local Astro dev server.
- `bun run build` — full static build into `dist/` from the committed cache.
- `bun run build:queue` — refresh the cache from Matter. Needs `MATTER_TOKEN` in the environment (or `.env`).
- `bun run check` — `astro check` (type + content collection schema validation). Run this before declaring work done; there is no separate test suite.
- `bun run preview` — preview the built `dist/`.
- `bun run prettier` / `bun run format:check` — Prettier (tabs, double quotes, `astro` + `tailwindcss` plugins; config lives in `package.json`).

## Architecture

Astro 5 static site (`output: "static"`) deployed to GitHub Pages. The interesting part of the architecture is the **build-time Matter → content collection pipeline**, which you have to understand before touching anything under `src/content/` or the `archive` / `inbox` pages.

### Content collections

`src/content/config.ts` defines two Astro collections backed by custom loaders, not filesystem globs:

- `readwise-archive` — everything with `location = archive`, rendered by `src/pages/archive.astro`.
- `readwise-queue` — queue/feed items (non-archive locations), rendered by `src/pages/inbox.astro`.

Both schemas are Zod objects defined in `src/content/types.ts`. **Always import Zod via `import { z } from "astro/zod"`** — mixing in `import { z } from "zod"` directly breaks Astro's content config. Schemas mirror the Matter API shape; do not relax them for convenience.

### The build-time data pipeline

Reading data comes from [Matter](https://docs.getmatter.com/api); the site used Readwise before, and the collection names, the `readwise_id` field and the `ProcessedItem` shape are kept from then.

- **Processed cache** — the merged `ProcessedItem[]` committed to `src/content/cache-processed.json`. Both loaders read only this file, so a build never calls the API.
- **Frozen Readwise cache** — `src/content/cache-readwise.json`, the Readwise library as of the switch. Never refreshed.

`refreshProcessedCache` in `src/content/readwise.ts` (run by `bun run build:queue`) rebuilds the processed cache:

- Matter `queue` items become `location: "new"` (the inbox page), `archive` items stay `archive`. Matter's own `inbox` (its subscription feed) is skipped. `updated_at` stands in for `last_moved_at`, `excerpt` for `summary`, `content_type` for `category`.
- Matter has no bulk annotations endpoint, so annotations are fetched per item, and only when the item's `updated_at` differs from the cached `last_moved_at`.
- A Matter item without annotations keeps the Readwise highlights for the same normalised URL.
- Readwise archive items whose URL is not in Matter are kept; Readwise inbox items are dropped (they were moved to Matter by the one-off `src/content/migrate-inbox-to-matter.ts`).

The Matter client lives in `src/content/matter.ts` and paces requests to Matter's rate limits. Cache paths are centralized in `src/content/utils.ts` (`writeJsonCache` sorts keys for deterministic diffs).

The CI workflow runs on every push to `main` and daily at 00:00 UTC. It runs `bun run build:queue` with `MATTER_TOKEN`, then `bun run build`, then commits any refreshed `src/content/*.json` back to `main` with `[skip ci]` before deploying to Pages.

### Pages and layouts

Five top-level pages (`src/pages/{index,blog,inbox,archive,info}.astro`) share `src/layouts/page.astro`; blog posts use `src/layouts/blog.astro`. Styles are a single global sheet (`src/styles/global.css`) plus Tailwind v4 via `@tailwindcss/vite`. Markdown gets `remark-math` + `rehype-katex`; highlights rendered inside `archive.astro` are processed through a `unified()` pipeline at build time, not at runtime.

## TypeScript conventions

`tsconfig.json` is aggressive: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. Keep Matter and cache types strict — do not weaken Zod schemas or widen types to paper over errors. `import type` is mandatory for type-only imports (`verbatimModuleSyntax`).

## Version control and change hygiene

- The repo is colocated with both `.git/` and `.jj/`. If Jujutsu is in use locally, prefer `jj` commands over raw `git` so you don't fight the jj workflow.
- Never push; leave commits local for the user to review.
- When preparing changes for review, split noisy refactors from substantive work and keep commits in a logical order.

## Planning notes

Non-trivial multi-step work often has a companion markdown file under `.plans/` (see `.plans/README.md` for the index). When the user asks for a plan or decision record for substantial work, add it there and commit it alongside the change.
