# Agent memory

## Learned User Preferences

- Use Bun for package scripts and runtime in this repo (`bun run`, `bunx`, `Bun.file` / `Bun.write`); do not replace Bun with Node, npm, or npx unless the user explicitly overrides project rules.
- Keep Readwise-related TypeScript strict: Zod schemas and types mirror the API—do not relax or delete types for convenience.
- When preparing changes for review, split noisy refactors from substantive work and keep commits in a logical order.
- Use Jujutsu (`jj`) for version control in this workspace when colocated with `.jj/`, not ad-hoc git commands that fight the jj workflow.
- Save implementation plans as markdown files in `.plans/` and commit them alongside code changes.
- Keep all imports at the top of the file, sorted and grouped with blank lines between groups; no hidden inline imports.
- Commit messages should explain the problem, the fix, and the reasoning—not just describe what changed.
- Investigate root causes before patching symptoms; prefer explicit, readable filtering conditions (e.g., check `category` over structural null-checks).
- Regularly audit and remove unused code, CSS classes, dependencies, and exports.
- Prefer Tailwind utility classes over raw CSS property declarations when both achieve the same result.

## Learned Workspace Facts

- Cursor agent shells may not have `bun` on `PATH`; prepending `$HOME/.bun/bin` (or using the full path to `bun`) is often required for builds and scripts to run.
- The Astro app loads Readwise-backed content at build time; content code expects the Bun runtime for cache helpers.
- Astro 5.x bundles Zod v3 (`astro/zod`); the project also has Zod v4. `llm.ts` must use Zod v4 for the Anthropic SDK (`betaZodOutputFormat` requires `_zod.def`), while `types.ts`/`config.ts` use `astro/zod` for Astro content collections.
- The Readwise Reader API returns highlights and notes as first-class documents (`category: "highlight"` or `"note"`, `source_url: null`); these must be filtered out of document processing.
- The Readwise API has a 20 req/min rate limit; both v3/list and v2/export support `updatedAfter` for incremental fetching.
- The user refers to the inbox page (`/inbox`) as the "queue page".
