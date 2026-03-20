# Feed-style list items

## Goal

Redesign list items on the blog, inbox, and archive pages to match the
feed-style pattern seen on [joshpuckett.me](https://joshpuckett.me/) (Projects
section) and [cursor.com/blog](https://cursor.com/blog).

## Reference designs

**Josh Puckett's Projects**: full-width block links, bold title, lighter gray
description, rounded hover background (`hover:bg-neutral-100`), generous
whitespace, no borders.

**Cursor Blog**: full-width rows, bold title, description in muted text, small
tag + date metadata line, subtle card separation.

## Design decisions

### Layout

- Replaced the old `Row`-based key/value layout (`archive_main`) with a flat
  `div.feed` list.
- Each item is a self-contained `.feed-item` block — no more date group headers
  in archive; dates are inline per item.
- Hover background uses the **padding/negative-margin trick**: `px-1 -mx-1`
  keeps text aligned with page content while the `rounded-xl` background
  extends beyond.

### Typography hierarchy (three tiers)

| Tier | Class | Mobile | Desktop (md:) | Color |
|------|-------|--------|---------------|-------|
| Title | `.feed-title` | `text-lg` (1.1rem) | `text-xl` (1.25rem) | full (neutral-950/50) |
| Description | `.feed-desc` | `text-xs` (0.75rem) | `text-sm` (0.875rem) | mid-muted (neutral-600/400) |
| Meta | `.feed-meta` | `text-xs` (0.75rem) | `text-xs` (0.75rem) | most muted (neutral-400/500) |
| Tags | `.feed-tags` | `text-xs` (0.75rem) | `text-xs` (0.75rem) | most muted, uppercase |

- Title: single line, truncated with ellipsis (`truncate`).
- Description: single line, truncated with `line-clamp-1`. Always visible (no
  expand/collapse).
- Meta: category and date joined by ` · ` (e.g. "article · 05 Mar 2026").

### Per-page structure

**Blog** (title + date, no description available in frontmatter):
```
Kahn's Algorithm
14 Nov 2025
```

**Inbox** (title + Readwise link, description, tags):
```
The Suck Is Why We're Here    Ⓡ
AI can mimic writing but lacks the authentic thinking process...
#ARTIFICIAL_INTELLIGENCE  #WRITING  #CREATIVITY
```

**Archive** (title, description, category + date):
```
The Claude C Compiler: What It Reveals About the Future of Software
Anthropic used AI agents to build a C compiler called Claude...
article · 05 Mar 2026
```

### Hover effect

- `transition-colors duration-150`
- `hover:bg-neutral-100 dark:hover:bg-neutral-800/50`
- `rounded-xl` for rounded corners

### Files changed

- `src/styles/global.css` — new `div.feed` component styles replacing
  `div.archive_main`; removed toggle/expand machinery.
- `src/pages/blog.astro` — removed `Row` component, uses feed list with
  `<a class="feed-item">`.
- `src/pages/inbox.astro` — replaced expandable summary with always-visible
  `.feed-desc`; simplified tags from `<label>` to `<span>`.
- `src/pages/archive.astro` — removed `Row` component and date group labels;
  each item now self-contained with inline date; removed `Row` import.
- `src/components/row.astro` — unchanged, still used by `info.astro`.
