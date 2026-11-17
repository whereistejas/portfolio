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
- `bun run build` — full static build into `dist/`. Needs `READWISE_TOKEN` in the environment (or `.env`) to fetch fresh data; otherwise reuses the committed cache.
- `bun run check` — `astro check` (type + content collection schema validation). Run this before declaring work done; there is no separate test suite.
- `bun run preview` — preview the built `dist/`.
- `bun run prettier` / `bun run format:check` — Prettier (tabs, double quotes, `astro` + `tailwindcss` plugins; config lives in `package.json`).

## Architecture

Astro 5 static site (`output: "static"`) deployed to GitHub Pages. The interesting part of the architecture is the **build-time Readwise → content collection pipeline**, which you have to understand before touching anything under `src/content/` or the `archive` / `inbox` pages.

### Content collections

`src/content/config.ts` defines two Astro collections backed by custom loaders, not filesystem globs:

- `readwise-archive` — everything with `location = archive`, rendered by `src/pages/archive.astro`.
- `readwise-queue` — queue/feed items (non-archive locations), rendered by `src/pages/inbox.astro`.

Both schemas are Zod objects defined in `src/content/types.ts`. **Always import Zod via `import { z } from "astro/zod"`** — mixing in `import { z } from "zod"` directly breaks Astro's content config. Schemas mirror the Readwise API shape; do not relax them for convenience.

### The build-time data pipeline

`src/content/readwise.ts` fetches documents and highlights from Readwise and maintains a committed processed cache:

- **Processed cache** — the merged `ProcessedItem[]` committed to `src/content/cache-processed.json`. This file is checked in so CI can build without calling the Readwise API if nothing changed.

Cache paths are centralized in `src/content/utils.ts` (`readJsonCache` / `writeJsonCache` sort keys for deterministic diffs). The archive loader fetches from the Readwise API when `READWISE_TOKEN` is set, updates the cache, and falls back to the cache otherwise. The queue loader fetches fresh each build but never writes to the cache.

The CI workflow runs on every push to `main` and daily at 00:00 UTC. It executes `bun run build` with `READWISE_TOKEN`, then commits any refreshed `src/content/*.json` back to `main` with `[skip ci]` before deploying to Pages.

### Pages and layouts

Five top-level pages (`src/pages/{index,blog,inbox,archive,info}.astro`) share `src/layouts/page.astro`; blog posts use `src/layouts/blog.astro`. Styles are a single global sheet (`src/styles/global.css`) plus Tailwind v4 via `@tailwindcss/vite`. Markdown gets `remark-math` + `rehype-katex`; highlights rendered inside `archive.astro` are processed through a `unified()` pipeline at build time, not at runtime.

## TypeScript conventions

`tsconfig.json` is aggressive: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. Keep Readwise types strict — do not weaken Zod schemas or widen types to paper over errors. `import type` is mandatory for type-only imports (`verbatimModuleSyntax`).

## Version control and change hygiene

- The repo is colocated with both `.git/` and `.jj/`. If Jujutsu is in use locally, prefer `jj` commands over raw `git` so you don't fight the jj workflow.
- Never push; leave commits local for the user to review.
- When preparing changes for review, split noisy refactors from substantive work and keep commits in a logical order.

## Planning notes

Non-trivial multi-step work often has a companion markdown file under `.plans/` (see `.plans/README.md` for the index). When the user asks for a plan or decision record for substantial work, add it there and commit it alongside the change.
