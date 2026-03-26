# Page Transitions: Shared-Element Float + Staggered Feed Entrance

## Goal

When a user clicks a nav link on the index page (INBOX, BLOG, ARCHIVE, INFO),
the clicked element floats from its current position to the header of the
destination page while the rest of the index page fades out. Then the
destination page's content appears item by item, rising into view like something
surfacing from deep water. Back navigation reverses the transition with
choreographed timing. Highlights pane on archive also animates in/out.

## Approach: Astro View Transitions (`<ClientRouter />`)

Astro 5's `<ClientRouter />` wraps the browser's View Transitions API:

- **Shared-element morphing** via `transition:name` — the browser interpolates
  position, size, and opacity between matching elements across pages.
- **Graceful fallback** — Firefox gets instant navigation, no broken animations.

## All changes made

### `src/layouts/page.astro`

- Added `<ClientRouter />` to `<head>`
- Added `<slot name="head" />` so child layouts can inject into `<head>`
- Removed KaTeX stylesheet (moved to `blog.astro` — only blog posts need it)
- Removed PostHog analytics (`posthog.astro` deleted)

### `src/layouts/blog.astro`

- Added KaTeX stylesheet via `slot="head"`

### `src/components/textorlink.astro`

- Accepts optional `transitionName` prop, applied as `transition:name` on the
  outer `<div>`.

### `src/pages/index.astro`

- All four nav links pass `transitionName`: `nav-inbox`, `nav-blog`,
  `nav-archive`, `nav-info`.

### Sub-pages (`inbox.astro`, `blog.astro`, `archive.astro`, `info.astro`)

- Headers renamed to match index link text (`READING INBOX` → `INBOX`,
  `READING ARCHIVE` → `ARCHIVE`; blog/info already matched).
- All headers have matching `transitionName`.
- Feed items set `style={--i: ${idx}}` for stagger delay.

### `src/pages/archive.astro` — highlights pane reverse animation

The inline script was updated to animate highlights out before hiding:

- `hidePane()` now sets `data-sinking="true"` on the active group, waits
  300ms for the `sink` CSS animation, then removes attributes.
- `showPane()` cancels any in-progress sink (`clearTimeout`) and removes
  `data-sinking` before activating the new group. This handles the race
  condition when users hover quickly between items.

### `src/styles/global.css`

**Keyframes:**

| Name | Effect |
|------|--------|
| `surface` | opacity 0→1, translateY(1rem→0), blur(2px→0) |
| `sink` | opacity 1→0, translateY(0→1rem), blur(0→2px) |
| `fade-out` | opacity 1→0 |
| `fade-in` | opacity 0→1 |

**Applied to:**

| Element | Animation |
|---------|-----------|
| `.feed-item` | `surface 0.4s`, staggered via `--i` × 60ms, capped at 12 items |
| `article.blog-article` | `surface 0.5s` (single block, no stagger) |
| Highlight groups `[data-active="true"]` | `surface 0.3s` (triggers on hover) |
| Highlight groups `[data-sinking="true"]` | `sink 0.3s` (triggers on leave) |

**View Transition CSS:**

| Selector | Animation |
|----------|-----------|
| `::view-transition-group(nav-*)` | 0.5s `cubic-bezier(0.65, 0, 0.35, 1)` — slow-fast-slow |
| **Forward** `::view-transition-old(root)` | `fade-out 0.4s` |
| **Forward** `::view-transition-new(root)` | `none` + `opacity: 0` — hidden; CSS `surface` handles entry |
| **Back** `::view-transition-old(root)` | `sink 0.4s` — sinks with blur |
| **Back** `::view-transition-new(root)` | `fade-in 0.4s`, delayed **125ms** |
| **Back** `::view-transition-new(nav-*)` | `fade-in 0.35s`, delayed **125ms** |

The 125ms delay = 25% of the 0.5s nav float, so entering elements wait for
the returning title to be a quarter through its journey before appearing.

Direction detected via Astro's `html[data-astro-transition="back"]`.

## Transition behavior summary

| Scenario | Nav element | Old content | New content |
|----------|------------|-------------|-------------|
| Index → sub-page | Floats to header (0.5s ease-in-out) | Fades out (0.4s) | Items surface with stagger |
| Sub-page → index (back) | Floats back (0.5s ease-in-out) | Sinks + blur (0.4s) | Other nav + carousel fade in after 125ms |
| Direct URL | Appears instantly | — | Items surface with stagger |
| Firefox / no VT | Instant navigation | — | Items still surface (CSS runs on load) |

## Open questions

1. **Sub-page to sub-page**: No links exist between sub-pages yet. The same
   `transition:name` pattern extends naturally if added.
2. **Blog post pages** (`/posts/*.md`): Could make blog feed titles float to
   become the post heading — needs per-post transition names.
