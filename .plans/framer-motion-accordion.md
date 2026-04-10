# Plan: Framer Motion Highlights Accordion

## Current State

- `src/pages/archive.astro` has a highlights accordion built with:
  - Vanilla `<script is:inline>` JS managing open/close state via `data-*` attributes
  - Pure CSS transitions on `max-height`, `opacity`, and staggered `transition-delay` per `<li>`
- No React or framer-motion installed; no `@astrojs/react` integration
- Astro config has no framework integrations

## Goal

Replace the CSS transition-based expand/collapse with framer-motion's `AnimatePresence` + `motion.div` for smoother, spring-based animations with proper enter/exit orchestration. Keep everything else (data fetching, markup structure, styling) intact.

## Steps (incremental, one commit each)

### Step 1 — Install dependencies & wire up React integration

- `bun add @astrojs/react react react-dom framer-motion`
- Add `@astrojs/react` to `astro.config.mjs` integrations
- Add `resolve.dedupe` and `optimizeDeps.exclude` for framer-motion in Vite config (per workspace notes)
- Verify `bun run build` still succeeds with no React components yet

**Commit:** `deps: add React, framer-motion, and @astrojs/react integration`

### Step 2 — Extract a static (non-animated) React accordion island

- Create `src/components/HighlightsAccordion.tsx` as a `client:load` React island
- Accept props: highlights HTML array, highlightId, paneId, highlightCount
- Render the same markup (button + collapsible body + blockquote list) but with React state (`useState` for open/close) — **no framer-motion yet**, just conditional rendering
- Update `archive.astro` to use the new component for items with highlights
- Remove the corresponding inline `<script>` toggle logic (overlay can stay in Astro for now)
- Verify the accordion opens/closes with no animation, matching current structure

**Commit:** `refactor: extract highlights accordion into React island (no animation)`

### Step 3 — Add framer-motion expand/collapse animation

- Wrap the highlights body in `AnimatePresence` + `motion.div`
- Animate `height: 0 → "auto"` using framer-motion's layout or `animate` prop
- Use a spring or tween transition (e.g. `type: "spring", stiffness: 300, damping: 30`)
- Keep `opacity` fade on the container

**Commit:** `feat: animate accordion expand/collapse with framer-motion`

### Step 4 — Add staggered highlight item entrance/exit

- Wrap each `<li>` in `motion.li` with staggered `transition.delay` (based on index)
- On exit, reverse the stagger (last item fades first)
- Use `AnimatePresence mode="wait"` or `staggerChildren` via `variants`
- Respect `prefers-reduced-motion` by disabling animations or using instant transitions

**Commit:** `feat: staggered highlight item enter/exit animations`

### Step 5 — Polish: overlay, scroll, cleanup

- Animate the overlay scrim with framer-motion (or keep CSS — evaluate)
- Remove leftover CSS transition rules from `global.css` that are now handled by framer-motion
- Clean up any remaining inline script logic that's no longer needed
- Final visual QA and `bun run build` verification

**Commit:** `chore: clean up legacy CSS transitions and inline scripts`

## Constraints

- **Bun only** — all commands use `bun` / `bunx --bun`, never node/npm/npx
- **jj** for version control — commit after each step
- `resolve.dedupe` for react/react-dom, `optimizeDeps.exclude` for framer-motion (no `resolve.alias` to node_modules paths)
- Keep `prefers-reduced-motion` support throughout
