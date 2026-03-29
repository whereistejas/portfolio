---
name: Unify font styling
overview: Unify the font styling of archive item descriptions and highlight items so they match, and ensure only titles and headers use black text color.
todos:
  - id: unify-highlights
    content: Add explicit `text-neutral-600 dark:text-neutral-400` to `.archive_highlights_content` in global.css to match `.feed-desc`
    status: completed
  - id: prose-body-muted
    content: Change `.blog-article` text color from black to `text-neutral-600 dark:text-neutral-400` with `opacity-75` for prose paragraphs
    status: completed
  - id: headings-black
    content: "Make blog headings (`h1`-`h6`) black: remove `opacity-75`, set `text-neutral-950 dark:text-neutral-50`, update `--tw-prose-headings` vars"
    status: completed
  - id: verify-build
    content: Build the site and visually verify the changes
    status: completed
isProject: false
---

# Unify Font Styling for Descriptions, Highlights, and Prose

All changes are in [`src/styles/global.css`](src/styles/global.css).

## Current state

- **`.feed-desc`** (archive/blog/inbox item descriptions): `opacity-75` + explicit `text-neutral-600` / `dark:text-neutral-400` + `line-clamp-2`
- **Highlight pane content** (`.archive_highlights_content`): `opacity-75` only, inheriting body text color (`text-neutral-950` / `dark:text-neutral-50`) -- so effectively darker than `.feed-desc`
- **`.feed-meta`** / **`.feed-tags`**: `opacity-60` + `text-neutral-400` / `dark:text-neutral-500`
- **`.blog-article`** prose body: `text-neutral-950` / `dark:text-neutral-100` (black-ish), no opacity reduction
- **Blog headings** (`h1`-`h6` in `.blog-article`): `--tw-prose-headings: neutral-600` with `opacity-75` and `uppercase` -- these are currently *muted*, not black

## Proposed changes

### 1. Make `.feed-desc` and highlight items use the same styling

Pick a single muted style for both. The natural choice is `text-neutral-600 dark:text-neutral-400` with `opacity-75` (matching the current `.feed-desc`):

- **`.feed-desc`** -- keep as-is: `opacity-75 text-neutral-600 dark:text-neutral-400 line-clamp-2`
- **`.archive_highlights_content`** -- change from just `opacity-75` to `opacity-75 text-neutral-600 dark:text-neutral-400` so highlight text matches `.feed-desc` exactly

### 2. Ensure only titles and headers use black

- **`.blog-article` prose body** -- change from `text-neutral-950 dark:text-neutral-100` to `text-neutral-600 dark:text-neutral-400 opacity-75` so prose paragraphs match the descriptions/highlights style, not black
- **Blog headings** (`h1`-`h6` in `.blog-article`) -- change to use black: remove `opacity-75`, set `text-neutral-950 dark:text-neutral-50` (and keep `uppercase text-base`)
- **`--tw-prose-headings`** -- update from `neutral-600` / `neutral-400` to `neutral-950` / `neutral-50` so the typography plugin also renders headings as black
- **`.feed-title`** -- already black via the global `a` tag rule, no change needed
- **Page headers** (`header`) -- already black via body color inheritance, no change needed

### 3. Summary of what uses black vs muted

After the changes:

**Black** (`text-neutral-950` / `dark:text-neutral-50`):
- `.feed-title` (item titles, via `a` rule)
- Page `<header>` text
- Blog `h1`-`h6` headings

**Muted** (`text-neutral-600 dark:text-neutral-400 opacity-75`):
- `.feed-desc` (archive/blog/inbox descriptions)
- Highlight pane content (blockquotes)
- `.blog-article` prose body paragraphs

**More muted** (`text-neutral-400 dark:text-neutral-500 opacity-60`):
- `.feed-meta`, `.feed-tags` (dates, categories, tags)
