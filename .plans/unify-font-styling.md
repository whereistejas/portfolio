---
name: Unify font styling
overview: Unified feed descriptions, archive highlights, and blog prose around semantic foreground tokens; titles and headings use full contrast; follow-up tweaks for opacity, footnotes, blog list hovers, and inbox chrome.
todos:
  - id: unify-highlights
    content: Match highlight blockquotes to `.feed-desc` (muted fg + opacity on list only)
    status: completed
  - id: prose-body-muted
    content: Blog article body uses `text-fg-muted`; removed parent `opacity-75` so headings match page titles
    status: completed
  - id: headings-black
    content: Blog and archive highlight headings use `text-fg` / `text-fg-dark`; prose heading CSS vars aligned
    status: completed
  - id: theme-tokens
    content: Semantic `--color-fg*` tokens in `@theme` with `text-fg*` utilities across global.css
    status: completed
  - id: feed-blog-hover
    content: "`a.feed-item` hover keeps title color (blog list)"
    status: completed
  - id: footnotes-prose
    content: Footnotes use same fg-muted colors as article body; sup footnote links without underline
    status: completed
  - id: inbox-readwise
    content: Removed Readwise shortcut from reading inbox
    status: completed
isProject: false
---

# Unify font styling (delivered)

## Semantic tokens ([`src/styles/global.css`](src/styles/global.css) `@theme`)

- `--color-fg` / `--color-fg-dark` — primary text (titles, headings, links default)
- `--color-fg-muted` / `--color-fg-muted-dark` — descriptions, prose body, highlights body, footnotes
- `--color-fg-faint` / `--color-fg-faint-dark` — feed meta and tags (`opacity-60` on those rows)
- `--color-fg-accent` / `--color-fg-accent-dark` — yellow accents (Readwise, markers, quote borders)

## Behaviour

- **Feed** — `.feed-desc` muted + `opacity-75`. **`a.feed-item`** hover keeps `text-fg` so blog list titles do not wash out.
- **Archive highlights** — `# Highlights` uses full `text-fg`; blockquotes stay muted with `opacity-75` on the `ul` inside each group (matches `.feed-desc` visually).
- **Blog article** — No wrapper opacity on `article`; body `text-fg-muted`; `h1`–`h6` uppercase + full fg; prose vars use `--color-fg`; footnote list items match body typography/color; `sup a` has `no-underline`.
- **Inbox** — Readwise “Ⓡ” link removed ([`src/pages/inbox.astro`](src/pages/inbox.astro)).

## Optional follow-ups

- Responsive base size `16px` / `18px` on `main` if desired (not in current tree).
- Replace inline `text-yellow-700` in Astro templates with `text-fg-accent` for consistency.
