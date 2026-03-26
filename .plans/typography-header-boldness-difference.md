# Typography: Header Boldness Difference Between Index and Archive

## Observed Issue

The header/footer `Textorlink` links appear bolder on `index.astro` than on `archive.astro`.

## Key Facts

### `textorlink.astro` always renders an `<h4>`

```astro
<div class="inline-block">
    <h4>
        {href ? <a href={href}>{content}</a> : content}
    </h4>
</div>
```

The `<h4>` tag carries no Tailwind class itself — it gets its font-weight from inheritance or the browser UA stylesheet.

### `header, footer` CSS rule (global.css:36-39)

```css
header, footer {
    @apply flex w-full flex-row justify-between px-1 text-2xl font-semibold tracking-tight ...;
}
```

`font-semibold` (600) is set on the **container**, inherited by children.

### `h4` heading styles are scoped to `article.blog-article` only (global.css:136-143)

```css
article.blog-article {
    h1, h2, h3, h4, h5, h6 {
        @apply text-base uppercase opacity-75;
    }
    h4::before { content: "## "; }
}
```

The `opacity-75`, `uppercase`, and `## ` prefix apply **only inside blog articles** — not to the `<h4>` tags inside `<header>` or `<footer>`.

### Different usage of `Textorlink` across pages

| Page        | Header                                     | Footer                                |
|-------------|---------------------------------------------|---------------------------------------|
| `index`     | `INBOX` (linked), `BLOG` (linked)           | `ARCHIVE` (linked), `INFO` (linked)  |
| `archive`   | `READING ARCHIVE` (no href, plain text)     | *(empty — no footer slot)*           |

This is the structural difference: index renders `<a>` inside `<h4>`, archive renders plain text inside `<h4>`.

## Likely Root Cause

The `<h4>` tags in `textorlink.astro` on the **archive page header** have `opacity-75` applied from the `article.blog-article` rule leaking, OR — more likely — the issue is the **absence of the `href` prop on the archive header's `Textorlink`**.

Wait — the `opacity-75` rule is scoped to `article.blog-article`, so it shouldn't leak. But there's a subtler issue:

### The `opacity-75` from `article.blog-article` may not be the cause — but the archive page header IS rendered at reduced visual weight for a different reason

Looking at the archive page structure, the `<main>` content contains a dense text feed (article titles, descriptions, metadata). The header's `font-semibold` text sits above this text-heavy context. On the index page, `<main>` is a photo carousel with thin caption text — the header stands out visually by contrast.

**However**, this is a perceptual/optical explanation, not a CSS one. The more actionable CSS finding is:

### The `<h4>` in `textorlink.astro` may be picking up unexpected styles

On the archive page, the `<h4>READING ARCHIVE</h4>` in the header has no class and no `href`. This means:
- It inherits `font-semibold` from `header` ✓
- It inherits `text-2xl` from `header` ✓
- But browser UA stylesheet still targets `h4` with `font-weight: bold` (700) unless fully reset

In Tailwind v4, the preflight **does** reset headings to `font-size: inherit; font-weight: inherit`, so both `<a>` and plain text inside `<h4>` should end up at 600.

## What to Verify in the Browser

- Open DevTools and inspect the `<h4>` element in the header on both pages
- Check computed `font-weight` value on the `<h4>` and its text nodes
- Check if `opacity` differs (the `opacity-75` rule from `article.blog-article` could accidentally scope upward in unusual rendering scenarios)
- Check if the `@tailwindcss/typography` plugin is adding any global `h4` styles via CSS variables

## Hypotheses (ranked by likelihood)

1. **Optical/perceptual contrast**: The text-heavy archive feed makes the `font-semibold` header appear visually lighter in comparison to the image-only index carousel. The CSS is actually identical.
2. **`<a>` vs. plain text rendering**: Links (`<a>`) get explicit `text-neutral-950` (no opacity reduction), while plain text in the archive header inherits through the cascade. If `opacity` is applied at any ancestor level in the archive context, the plain text could appear lighter.
3. **Tailwind typography plugin global side effect**: `@plugin '@tailwindcss/typography'` in v4 may inject `h4` styles that reduce weight/opacity for headings not inside `.prose`, particularly affecting the archive page which imports more typography-related processing.

## Suggested Fix Options

Once confirmed in the browser:

- **Option A (simple)**: Add an explicit class to `textorlink.astro`'s `<h4>` to lock in font-weight: `<h4 class="font-semibold text-2xl tracking-tight">` — remove the dependency on inheritance.
- **Option B (semantic)**: Replace the `<h4>` in `textorlink.astro` with a `<span>` or `<p>` since nav links in headers/footers are not semantically headings.
- **Option C (global CSS)**: Add an explicit rule for `header h4, footer h4` in global.css to pin the desired styles.
