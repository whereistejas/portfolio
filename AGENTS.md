## Cursor Cloud specific instructions

This is a **Bun-based Astro static site** (personal website/blog). All commands use Bun as the runtime and package manager.

### Key commands

See `package.json` `scripts` for the full list. The most commonly used:

- `bun run dev` — Start dev server at `http://localhost:4321/`
- `bun run build` — Build static site to `dist/`
- `bun run check` — Astro/TypeScript type checking
- `bun run format:check` — Prettier format check
- `bun run prettier` — Auto-fix formatting

### Environment variables

A `.env` file (gitignored) must exist with `READWISE_TOKEN` for the archive content loader. Without a valid token, the Readwise API returns 401 and the app falls back to cached data — but only when `NODE_ENV !== "production"`.

**Gotcha:** `astro check` and `astro build` run in production mode by default, skipping the cache fallback. Prefix with `NODE_ENV=development` to use cached data without a real token:

```
NODE_ENV=development bun run check
NODE_ENV=development bun run build
```

The dev server (`bun run dev`) runs in development mode automatically, so the cache fallback works out of the box.

### Local cache setup

The archive loader falls back to `.readwise-cache/readwise-items.json` (gitignored) when the API is unreachable. Without a real `READWISE_TOKEN`, create this cache directory with a minimal stub:

```
mkdir -p .readwise-cache
echo '{"items":[],"timestamp":0,"options":{"token":"[REDACTED]","location":"archive"}}' > .readwise-cache/readwise-items.json
```

The LLM-processed queue data is committed in `src/content/cache-display.json`, so the inbox page works without any API keys.
