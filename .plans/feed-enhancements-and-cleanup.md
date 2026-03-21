# Feed Enhancements and Cleanup

## Blog descriptions

Blog feed items now show the first paragraph of each post as a one-line description
(`feed-desc`). Extracted at build time from `rawContent()` of the markdown glob,
skipping headings.

## Inbox tag style

Tags on the inbox page changed from uppercase `#`-prefixed flex-wrapped spans to
lowercase dot-separated (`·`) plain text. Matches the archive page meta style.
The CSS `span.tag::before` rule and flex/uppercase on `.feed-tags` were removed.

## Dead code removal

- `dotenv` dependency removed (Bun loads `.env` natively).
- `tsx` dependency removed (Bun runs TypeScript directly).
- `bodyClass` prop removed from `page.astro` (never passed by any page).
- `--font-serif` theme variable removed (never used).
- `left-0`, `top-0`, `bottom-0` removed from header/footer (no-op without positioning).
- `font-feature-settings` removed from `@font-face` (redundant with `--default-font-feature-settings`).
