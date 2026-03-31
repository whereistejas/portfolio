# Sync highlight button fade-off with collapse animation

## Problem

When the highlights pane closes, the button stays visually "on" for the entire
exit animation, then snaps off abruptly. This is because `data-expanded="true"`
(which drives the button's "on" color via CSS at `global.css:155`) persists on
the feed-item until `clearOpenState()` fires in a `setTimeout` after the
animation completes (`archive.astro:226-229`).

## Solution

Pure CSS rule + tiny JS tweak to propagate the duration variable.

### CSS (`src/styles/global.css`)

Add a closing-state override after the existing button "on" rule (after line 157):

```css
div.feed
	.feed-item[data-expanded="true"].is-highlight-pane-closing
	.feed-highlight-btn {
	color: inherit;
	transition: color var(--body-duration, 320ms) ease;
}
```

- `.is-highlight-pane-closing` is added immediately when the close begins.
- `--body-duration` syncs the button color fade to the same duration as the
  collapse animation.
- The combined selector has higher specificity than the existing
  `[data-expanded="true"]` rule, so it wins during the close phase.
- `color: inherit` returns the button to its default (non-highlighted) text
  color.

### JS (`src/pages/archive.astro`)

`--body-duration` is currently set on `.feed-highlights-body`, but the button
is a sibling (not a child) of that element, so it can't inherit the variable.

1. In `closePaneAnimated`, set the variable on the `item` element:
   ```js
   item.style.setProperty("--body-duration", ms + "ms");
   ```
2. In `clearOpenState`, clean it up:
   ```js
   item.style.removeProperty("--body-duration");
   ```

## Changes summary

| File                      | Change                                                    |
| ------------------------- | --------------------------------------------------------- |
| `src/styles/global.css`   | Add 1 CSS rule (~4 lines) after line 157                  |
| `src/pages/archive.astro` | 1 line in `closePaneAnimated`, 1 line in `clearOpenState` |

## Risk

Minimal — `is-highlight-pane-closing` is already purpose-built for exit
animations; we're hooking into it with one additional CSS rule. No behavioural
changes to open/close logic.
