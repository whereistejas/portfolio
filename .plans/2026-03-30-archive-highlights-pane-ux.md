# Archive highlights pane: card states, overlay, and motion

**Date:** 2026-03-30  
**Status:** completed

## Context

Reading archive rows with Readwise highlights use an inline card (`.feed-item-card`) and a full-viewport scrim (`.archive-overlay`). This plan defines the exact UX behavior for the card and overlay.

## Desired behavior

### Card background

The card background must be **identical** across hover and expanded states — `neutral-100` / `dark: neutral-800/50`. There should be **no visible color change** between hovering a card, clicking the highlight button, expanding, and collapsing. The card goes from transparent (idle) → gray (hover/expanded) → transparent (idle) and that's it.

### Page background (overlay)

The page should **not dim**. The overlay is a **transparent click-catcher** only — it captures clicks outside the card to close the pane and blocks interaction with other elements, but applies no visual effect. No scrim, no tint, no dimming.

### Expand / collapse animation

- **Entry:** highlight items fade in with a staggered delay, sliding up from `translateY(0.5rem)`. The body expands via `max-height` transition. The body's `max-height` target is the actual `scrollHeight` (set via JS), so the pane is exactly as tall as its content — **no scrolling, no height cap**.
- **Exit:** items **fade out in place** (opacity only, no downward shift) with reverse-staggered delays. The body collapse runs **concurrently** with item exit.
- **Timing:** durations are computed from item count and set via CSS custom properties (`--overlay-duration`, `--body-duration`) so all animations (overlay, body, items) finish together.
- The body stays in the DOM at all times (no `hidden` attribute). It uses `max-h-0 overflow-hidden -mt-0.5` when collapsed; the negative margin cancels the parent's flex gap so there's no layout jump.

### Highlight count button

- **Idle:** transparent background, faint text/border.
- **Row hover:** light fill (`neutral-100` / `dark: neutral-800/50`).
- **Button hover:** darker fill (`neutral-300` / `dark: neutral-600`), full-opacity text.
- **Expanded (active):** same dark fill as button hover — acts as an "on" indicator.

### Touch / mobile

- All hover styles gated behind `@media (hover: hover)`.
- Global `a:hover` color change excludes `.feed-item` links.

### Mobile spacing

- `main`, `header`, `footer`: `px-1.5` (24px) on mobile, `md:px-0` on desktop.
- `.feed-item` and `.feed-item-card`: `px-0.75 -mx-0.75` (12px) on mobile, `md:px-1 md:-mx-1` on desktop.
- Uniform spacing: **screen → card edge = card edge → text = 12px** on mobile.

### Top padding alignment

- Unconditional `pt-1.5` on `div.feed` and `article.blog-article` (not `first:pt-1.5`).
- `> :first-child { mt-0 }` in `blog-article` to cancel prose heading margin.

## Implementation touchpoints

- `src/styles/global.css` — overlay, card, button, body, stagger, mobile spacing, hover media queries, reduced-motion overrides.
- `src/pages/archive.astro` — inline script: `openPane` / `closePaneAnimated` / `clearOpenState`; timing constants; `--body-max-h` from `scrollHeight`.

## Tasks

- [x] Align highlight-card hover with plain `.feed-item` hover
- [x] Overlay is transparent click-catcher only (no page dimming)
- [x] Consistent card background across hover, expand, and close
- [x] Remove border and box-shadow from card
- [x] Concurrent body collapse and item exit on close
- [x] Fix 8px jump from flex gap (negative margin, no `hidden`)
- [x] Full-height pane (no scroll cap) using `scrollHeight`
- [x] Items fade out in place on exit (no downward shift)
- [x] Highlight button "on" state when expanded; darker hover
- [x] Gate all hover styles behind `@media (hover: hover)`
- [x] Uniform mobile spacing (12px screen→card = card→text)
- [x] Consistent top padding across all pages
- [x] Exclude `.feed-item` from global `a:hover` color change
