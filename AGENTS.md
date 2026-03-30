# Agent memory

## Learned User Preferences

- Use Bun for package scripts and runtime in this repo (`bun run`, `bunx`, `Bun.file` / `Bun.write`); do not replace Bun with Node, npm, or npx unless the user explicitly overrides project rules.
- Keep Readwise-related TypeScript strict: Zod schemas and types mirror the API—do not relax or delete types for convenience.
- When preparing changes for review, split noisy refactors from substantive work and keep commits in a logical order.
- Use Jujutsu (`jj`) for version control in this workspace when colocated with `.jj/`, not ad-hoc git commands that fight the jj workflow.
- For substantial multi-step work, save plans or decision notes as markdown under `.plans/` and commit them with related changes when requested.
- In Astro content code, import Zod from `astro/zod` consistently; avoid mixing direct `zod` package imports with `astro/zod`.

## Learned Workspace Facts

- Cursor agent shells may not have `bun` on `PATH`; prepending `$HOME/.bun/bin` (or using the full path to `bun`) is often required for builds and scripts to run.
- The Astro app loads Readwise-backed content at build time; content code expects the Bun runtime for cache helpers.
- Readwise and related LLM intermediate caches live under `.readwise-cache/` in the repo so builds can reuse data without refetching on every run.
