# Reduce Font Sizes to Two

## Before

The site used **7 distinct font sizes** across two files:

- `text-xs` (12px) -- `.feed-desc`, `.feed-meta`, `.feed-tags`
- `text-sm` (14px) -- `md:` on `.feed-desc`, archive highlights pane, `.footnotes`, `row.astro`
- `text-lg` (custom 1.1rem) -- `main`, `.feed-title`, `article.blog-article`
- `text-xl` (20px) -- `md:` on `.feed-title`
- `text-2xl` (24px) -- `header, footer`
- `text-3xl` (30px) -- `md:` on `header, footer`
- `prose-base` -- typography plugin on `article.blog-article`

Custom theme overrides `--text-md` and `--text-lg` existed. Font weight was non-standard at 380.

## After

Two font sizes only:
- **`text-2xl` (24px)** -- header and footer
- **`text-base` (16px)** -- everything else

### Visual hierarchy via opacity and spacing

With uniform `text-base`, hierarchy previously conveyed by font size is replaced:

- **Primary** (feed title, body text, article prose): full opacity.
- **Secondary** (feed description, archive highlights content): `opacity-75`.
- **Tertiary** (feed meta, feed tags, footnotes): `opacity-60`.
- **Spacing**: `.feed-item` gap increased from `gap-0.25` to `gap-0.5`.

Existing lighter text colors (`text-neutral-400`, `text-neutral-600`) are kept -- opacity stacks on top.

### Font setup

- Removed `--text-md` and `--text-lg` theme overrides.
- Removed `--font-weight-normal: 400` (400 is Tailwind's default).
- Added `font-feature-settings: 'liga' 1, 'calt' 1` to `@font-face` declarations.
- Added `@supports (font-variation-settings: normal)` block.

### Redundant class cleanup

Removed classes that are inherited or default:

- `text-base` on child elements (inherited from `main`).
- `font-normal` on `.blog-article` (400 is default).
- `prose-base` on `.blog-article` (`prose` defaults to base).
- `leading-snug` on `.feed-title`, `leading-1.5` on `.blog-article` (`text-base` provides 24px line-height).
