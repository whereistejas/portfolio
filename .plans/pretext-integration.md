---
name: Pretext text layout integration
overview: Replace CSS-driven text wrapping and clamping with Pretext's JS-based text measurement and line-breaking across feed descriptions, highlights, blog articles, and the info page.
isProject: true
---

# Pretext Text Layout Integration

## Context

[Pretext](https://github.com/chenglou/pretext) is a pure JS/TS library for multiline text measurement and layout. It side-steps DOM measurements (`getBoundingClientRect`, `offsetHeight`) by implementing its own text measurement logic using canvas `measureText` as ground truth.

The site currently relies on CSS properties (`text-pretty`, `hyphens-auto`, `line-clamp-2`) for text layout. Pretext replaces these with a JS-driven line-breaking algorithm that is more accurate and consistent across browsers.

## Architecture

### Runtime model

Pretext requires the browser's canvas `measureText` API, so it runs **client-side only**. The integration follows a progressive-enhancement pattern:

1. Astro SSG renders HTML normally — CSS provides the initial layout
2. On page load, wait for `document.fonts.ready` (InterVariable must be loaded for accurate measurement)
3. Pretext processes target text elements: measures, computes line breaks, and updates the DOM
4. CSS transitions or `opacity` toggling can mask the re-layout if the delta is noticeable

### Font configuration

Pretext's `prepare()` requires a CSS font shorthand string that must match the rendered font exactly:

| Context | CSS classes | Pretext font string |
|---------|------------|---------------------|
| Feed items (title, desc, meta) | `text-base` (16px, weight 400) | `"16px InterVariable"` |
| Blog article prose | `text-base` via `prose` (16px) | `"16px InterVariable"` |
| Highlight blockquotes | inherits `text-base` (16px) | `"16px InterVariable"` |

Line height: Tailwind's `text-base` produces `line-height: 1.5rem` (24px). The Typography plugin (`prose`) uses `line-height: 1.75` on paragraphs (= 28px at 16px font). These values must be passed to `layout()` / `layoutWithLines()` accordingly.

### Shared utility module

Create `src/lib/pretext.ts` — a thin wrapper that:
- Re-exports Pretext APIs
- Defines font string constants (`FONT_BASE = "16px InterVariable"`)
- Defines line height constants (`LH_FEED = 24`, `LH_PROSE = 28`)
- Exports a `ready()` async function that awaits `document.fonts.ready`
- Exports helper functions for common operations (e.g., clamp text to N lines)

---

## CSS Property Changes

This is the core of the plan. Pretext makes assumptions about the CSS environment. For its width calculations to match the browser's actual rendering, certain CSS properties must be aligned and others must be removed.

### Pretext's assumed CSS baseline

Pretext internally models text layout under these CSS defaults:

```
white-space: normal
word-break: normal
overflow-wrap: break-word
line-break: auto
```

All managed text elements must conform to this baseline.

### Properties to REMOVE

#### 1. `text-pretty` → removed from `main` and `.blog-article`

**Current:**
```css
main { @apply text-base text-pretty; }
article.blog-article { @apply text-pretty hyphens-auto; }
```
**Reason:** `text-wrap: pretty` is a CSS-native line-breaking hint that rebalances lines to avoid orphans. Pretext replaces this with its own line-breaking algorithm — having both active would cause Pretext's calculated breaks to diverge from the CSS-rendered breaks.

**After:** Remove `text-pretty` from both selectors. Pretext's `layoutWithLines()` or `walkLineRanges()` will drive line breaking instead.

#### 2. `hyphens-auto` → removed from `.blog-article`

**Current:**
```css
article.blog-article { @apply text-pretty hyphens-auto; }
```
**Reason:** `hyphens: auto` inserts soft hyphens at syllable boundaries, changing where line breaks occur. Pretext does not model hyphenation — if CSS hyphens are active, the browser will break lines at different positions than Pretext predicts, making Pretext's measurements inaccurate. The line-breaking quality from Pretext's own algorithm should compensate for the loss of hyphenation.

**After:** Remove `hyphens-auto`. If hyphenation is strongly desired, it would need to be implemented as a Pretext preprocessing step (segmenting words at hyphenation points), which is out of scope for initial integration.

#### 3. `line-clamp-2` → removed from `.feed-desc`

**Current:**
```css
.feed-desc { @apply line-clamp-2 opacity-75 text-neutral-600 dark:text-neutral-400; }
```
**Reason:** CSS `line-clamp` uses `-webkit-line-clamp` + `display: -webkit-box` to truncate after N lines. Pretext can compute exactly which text fits in 2 lines via `layoutWithLines()`, then truncate the string and append "…" — this is more predictable and doesn't rely on the non-standard `-webkit-line-clamp` property.

**After:** Remove `line-clamp-2`. Add `overflow: hidden` as a safety net. The client-side script will truncate `.feed-desc` content to exactly 2 lines using Pretext.

### Properties to ADD

#### 4. `overflow-wrap: break-word` → add to managed text containers

**Where:** `main` or a new utility class applied to all Pretext-managed containers.

**Reason:** Pretext assumes `overflow-wrap: break-word` in its layout model. This must be explicitly set on all managed text to ensure CSS rendering matches Pretext's calculations. Tailwind class: `break-words` (or `wrap-break-word`).

**Proposed:**
```css
main { @apply text-base break-words; }
```

This is already present on highlight `<li>` elements (`wrap-break-word`). Making it consistent across all managed text.

### Properties to KEEP unchanged

| Property | Location | Reason |
|----------|----------|--------|
| `truncate` | `.feed-title` | Single-line ellipsis for titles is a layout concern, not a text-wrap concern. Pretext can optionally detect overflow, but CSS `truncate` is simpler and sufficient. |
| `text-nowrap` | `info.astro` book title | Intentional no-wrap for a specific inline phrase. Not a general text layout property. |
| `wrap-break-word` | highlight `<li>` | Already matches Pretext's assumption. Keep for consistency. |
| `prose` / `prose-invert` | `.blog-article` | Typography plugin handles margins, spacing, list styles, etc. — not line breaking. Keep for non-text-layout prose styling. |

### Summary of `global.css` changes

```css
/* BEFORE */
main {
  @apply text-base text-pretty;
}
article.blog-article {
  @apply text-pretty hyphens-auto;
}
.feed-desc {
  @apply line-clamp-2 opacity-75 text-neutral-600 dark:text-neutral-400;
}

/* AFTER */
main {
  @apply text-base break-words;
}
article.blog-article {
  /* text-pretty and hyphens-auto removed */
}
.feed-desc {
  @apply overflow-hidden opacity-75 text-neutral-600 dark:text-neutral-400;
}
```

---

## Integration by Surface

### 1. Feed descriptions (archive, inbox, blog index)

**Files:** `archive.astro`, `inbox.astro`, `blog.astro`
**Element:** `.feed-desc` (`<span>` containing plain-text summary / first paragraph)

**Approach:**
- Client-side `<script>` runs after font load
- For each `.feed-desc`, call `prepareWithSegments(text, FONT_BASE)` then `layoutWithLines(prepared, containerWidth, LH_FEED)`
- If `lines.length > 2`: take `lines[0].text + lines[1].text`, trim trailing whitespace, append "…"
- Replace the element's `textContent` with the truncated string
- Handles the varying container width across breakpoints (read `clientWidth` once)

**Why not just CSS `line-clamp`?** Pretext gives us the exact truncated text, which is useful for:
- Consistent cross-browser behavior
- Potential server-side rendering of truncated text in the future
- Accurate height prediction for virtual scrolling

### 2. Highlights pane (archive)

**File:** `archive.astro`
**Element:** `aside.archive_highlights_pane` blockquote content

**Approach:**
- The highlights contain markdown-rendered HTML. Pretext operates on plain text strings, so:
  - Extract `textContent` from each `<blockquote>` (stripping HTML)
  - Use `prepare(text, FONT_BASE)` + `layout(prepared, paneWidth, LH_FEED)` to get accurate height
- Use the computed heights to improve pane positioning (replacing the current `getBoundingClientRect` calls)
- The rendered HTML stays as-is (Pretext measures, CSS renders)

**Alternative:** If we want Pretext to also drive line-breaking in highlights, we'd need to process the plain text through `layoutWithLines()` and re-render it — but this would lose the markdown formatting (bold, links, etc). For highlights, **measurement-only** is the pragmatic choice.

### 3. Blog articles and info page

**Files:** `layouts/blog.astro` (wraps all `posts/*.md`), `info.astro`
**Element:** `article.blog-article` paragraphs

**Approach:**
- Target all `<p>` elements inside `.blog-article`
- For each paragraph, extract `textContent`, run through `prepareWithSegments()` + `layoutWithLines()`
- Insert `<br>` elements at Pretext's computed line break positions
- This replaces CSS `text-pretty` with Pretext's own line-balancing

**Complexity note:** Paragraphs may contain inline elements (`<a>`, `<em>`, `<strong>`, `<code>`). Pretext operates on plain text, so:
- Option A: Process `textContent` only, insert `<br>` at character offsets (need to map character positions back to DOM nodes) — complex but preserves formatting
- Option B: Only apply Pretext to paragraphs that are pure text (no inline children) — simpler, partial coverage
- Option C: Use Pretext for measurement only (height prediction) and accept CSS line-breaking for prose — pragmatic compromise

**Recommendation:** Start with **Option C** for the initial integration. Use Pretext to measure paragraph heights (useful for scroll anchoring and future virtualization) but let the browser handle line-breaking for rich HTML content. Remove `text-pretty` and `hyphens-auto` so the CSS baseline matches Pretext's model, and evaluate whether the default `text-wrap: wrap` line-breaking quality is acceptable. Pretext-driven line-breaking for prose can be a follow-up.

### 4. Carousel captions (home page)

**File:** `carousel.astro`
**Not in scope.** Captions are single-line and layout uses the CSS `lh` unit for vertical sizing. No text-wrapping concern.

---

## Implementation Order

### Phase 1: Setup
1. Install `@chenglou/pretext` via `bun add @chenglou/pretext`
2. Create `src/lib/pretext.ts` with font constants, line-height constants, and `ready()` helper
3. Apply CSS changes in `global.css` (remove `text-pretty`, `hyphens-auto`, `line-clamp-2`; add `break-words`)
4. Verify the site still renders correctly with just the CSS changes (before any JS integration)

### Phase 2: Feed description clamping
5. Add a client-side script (shared or per-page) that clamps `.feed-desc` to 2 lines via Pretext
6. Test on archive, inbox, and blog index pages
7. Verify behavior across breakpoints (mobile narrow → desktop `md:w-48`)

### Phase 3: Highlight measurement
8. Integrate Pretext measurement into the archive highlight pane positioning logic
9. Replace or supplement the `getBoundingClientRect` calls with Pretext-calculated heights

### Phase 4: Blog/info prose measurement
10. Add Pretext measurement to `.blog-article` paragraphs for height prediction
11. Evaluate line-breaking quality without `text-pretty` and `hyphens-auto`
12. Decide whether to pursue Pretext-driven line-breaking for rich prose (follow-up)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Flash of re-layout (FOUC) when Pretext processes text after page load | Visual jank on slow connections | Hide managed text with `opacity: 0` until Pretext finishes; CSS provides fallback if JS fails |
| Font not loaded when Pretext runs → wrong measurements | Incorrect line breaks / heights | Gate on `document.fonts.ready` before any Pretext calls |
| Pretext line-breaking quality worse than `text-pretty` for prose | Awkward line breaks in blog posts | Start with measurement-only for prose (Phase 4); keep `text-pretty` removal reversible |
| Paragraphs with inline HTML (`<a>`, `<em>`) can't be line-broken by Pretext | Limited prose integration | Use measurement-only approach; Pretext-driven breaking is a follow-up for plain-text-only paragraphs |
| Bundle size increase | Slower page loads | Pretext is small (~15KB); lazy-load via dynamic `import()` if needed |
| `system-ui` font fallback before InterVariable loads | Pretext measures with wrong font | InterVariable is preloaded with `<link rel="preload">`; `document.fonts.ready` gates execution |
