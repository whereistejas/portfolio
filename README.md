# portfolio-rs

Rust rewrite of [whereistejas.xyz](https://whereistejas.xyz). Leptos renders every route
to static HTML at build time; the browser gets a small behaviour-only wasm bundle. The
Astro original lives in `../portfolio`.

- [`STYLE.md`](./STYLE.md) — Rust code style
- [`AGENTS.md`](./AGENTS.md) — project conventions and porting notes

## Quick start

```bash
bun install          # Tailwind CLI
trunk serve           # http://localhost:8080
```

`trunk serve` regenerates CSS and rebuilds the wasm on change. That's the whole loop.

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Rust stable | compiler | `rustup toolchain install stable` |
| `wasm32-unknown-unknown` | compile target | automatic, via `rust-toolchain.toml` |
| Trunk | wasm bundler + dev server | `cargo install --locked trunk` |
| Bun | runs the Tailwind CLI | `brew install oven-sh/bun/bun` |

`wasm-bindgen` is **not** on that list on purpose — Trunk downloads a matching version
itself on first build (you'll see `INFO downloading wasm-bindgen version="0.2.128"`).
Installing it manually just risks a version mismatch.

`rust-toolchain.toml` pins the channel and declares the target, so `rustup` installs
`wasm32-unknown-unknown` on demand. No manual `rustup target add` needed after a clone.

## Layout

A four-member Cargo workspace:

| Package | Target | Role |
| --- | --- | --- |
| `site/` | host + wasm | the views, as a library so they compile for both |
| `prerender/` | host | renders each route to a complete HTML file |
| `portfolio` (root) | wasm | behaviour only: carousel index, accordion toggles |
| `preview/` | host | static file server imitating GitHub Pages |

The split is not cosmetic. `site` carries no `leptos` feature of its own: `portfolio`
selects `csr` and `prerender` selects `ssr`, and those stay separate only because they are
separate build roots. Keep cargo commands package-scoped — **`--workspace` unifies the
features and turns both on at once**.

`cargo run -p preview` serves `dist/` on `:4321` with Pages' quirks: exact-match files, a
301 to the trailing-slash form for directories holding an index, `404.html` with a real
404 status, and gzip but never brotli. Use it to check a release build; use `trunk serve`
while writing code.

## How the build is wired

Five files do the work:

**`Cargo.toml`** — the root package depends on `web-sys` and `wasm-bindgen`, and
deliberately **not** on `leptos`: pages arrive prerendered, so nothing on the client
builds markup. The release profile is tuned for payload rather than speed:
`opt-level = "z"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`.

**`index.html`** — Trunk's entry point, not a template. Trunk scans it for `data-trunk`
link tags, runs each through an asset pipeline, and rewrites the tag to point at the
content-hashed output. Here that's one tag:

```html
<link data-trunk rel="css" href="styles/generated.css" />
```

plus a `copy-dir` tag that flattens `public/` onto the root of `dist/`, which is what makes
`/photos/…` and `/NebulaSans-Book.woff2` resolve.

Trunk finds the Rust binary on its own from `Cargo.toml` — there is no `rel="rust"` tag.
The `<body>` holds the `rel="me"` link and a `<!-- prerender -->` marker, which is where
`prerender` splices each page's markup.

**`Trunk.toml`** — sets `dist/` as the output and declares two hooks:

```toml
[[hooks]]
stage = "pre_build"
command = "bun"
command_arguments = ["run", "css"]

[[hooks]]
stage = "post_build"
command = "cargo"
command_arguments = ["run", "--quiet", "--release", "-p", "prerender"]
```

`pre_build` runs before the asset pipeline, so `styles/generated.css` exists by the time
Trunk goes looking for it — which is why you never run Tailwind by hand. `post_build`
renders every route into its own file, since Pages cannot rewrite `/inbox` onto
`index.html`. The hook reads `TRUNK_STAGING_DIR`, because Trunk stages the build and only
moves it to `dist/` once the whole pipeline succeeds.

**`build.rs`** — the content pipeline, standing in for everything Astro did at build
time. It runs on the host, so an image decoder and a markdown parser never reach the
browser:

| Module | Replaces | Output |
| --- | --- | --- |
| `build/photos.rs` | `astro:assets`, `exifreader` | resized JPEGs + caption table |
| `build/markdown.rs` | `unified()`, `remark-*`, `rehype-katex` | — |
| `build/feed.rs` | `content/readwise.ts`, `lib/feed.ts` | `generated/feed.json` |
| `build/posts.rs` | `import.meta.glob` over `posts/*.md` | post bodies + listing table |

Sources live in `content/` and `assets/`. Generated output splits by whether it is
served: `public/` is copied into `dist/`, while `generated/` holds intermediates that only
later build steps read (`feed.json`, post bodies) and never ships. Maths is rendered to
**MathML**, so the KaTeX CDN stylesheet the Astro site loaded is gone.

**`styles/tailwind.css`** — the Tailwind v4 entry point. v4 has no `tailwind.config.js`;
configuration is CSS-native:

```css
@import "tailwindcss";

@source "../src/**/*.rs";
@source "../index.html";
```

The `@source` globs are the part that matters. Our class strings live inside `.class("…")`
calls in Rust files, and Tailwind's scanner has no idea about `.rs` files by default.
**Add a new source directory and you must add a new `@source` glob**, or those utilities
get tree-shaken out with no warning.

## Commands

```bash
trunk serve                  # dev server on :8080, rebuilds on change
trunk build                  # debug build into dist/
trunk build --release        # production build into dist/
cargo run -p preview         # serve dist/ on :4321 the way Pages would
bun run css                  # one-shot Tailwind build
bun run css:watch            # Tailwind in watch mode
cargo fmt --all
cargo clippy -p site --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo clippy -p portfolio --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo clippy -p prerender --all-targets -- -D warnings
cargo clippy -p preview --all-targets -- -D warnings
```

Per package on purpose. `site` and `portfolio` need
`--target wasm32-unknown-unknown`; `prerender` and `preview` only build for the host,
because `leptos/ssr` and `tokio`'s networking have no wasm support. `--workspace` cannot
satisfy both, and would unify the `csr`/`ssr` features besides.

## What a release build produces

```
dist/
├── index.html                    # fully rendered, one per route
├── 404.html
├── blog/index.html
├── inbox/index.html
├── archive/index.html
├── info/index.html
├── posts/<slug>/index.html       # one directory per post
├── photos/<name>-{400,800}.jpg
├── generated-<hash>.css
├── portfolio-<hash>.js           # wasm-bindgen glue
└── portfolio-<hash>_bg.wasm
```

Every HTML file contains its complete content — the pages render with JavaScript
disabled.

| Asset | Hello world | CSR peak | Now |
| --- | --- | --- | --- |
| wasm | 52 KB | 235 KB | **28 KB** |
| JS glue | 23 KB | 37 KB | **16 KB** |
| CSS | 6 KB | 55 KB | 55 KB |
| feed data on the wire | — | 598 KB | **0** |

The largest page is now the markup: `archive/index.html` is 847 KB, 220 KB gzipped,
served as a single document. Worth re-checking after adding dependencies — GitHub Pages
serves gzip but not brotli, so the wire size stays close to the gzipped size.

## CI

`.github/workflows/ci.yml`, three jobs:

- **`lint`** — `cargo fmt --all --check`, then clippy for each package with `-D warnings`
- **`build`** — installs Bun and Trunk, runs `trunk build --release`, asserts the output
  tree, uploads `dist/` as a Pages artifact
- **`deploy`** — `actions/deploy-pages`, gated on `main` and on both jobs above

Trunk is pinned by the `TRUNK_VERSION` env var and downloaded straight from the
`trunk-rs/trunk` GitHub release, rather than via a third-party action or a slow
`cargo install`. Bump the version there.

The output-tree assertion exists because these failure modes are invisible until someone
loads the site: a route without its own `index.html` 404s on Pages, and a page whose
markup did not get spliced in looks fine to the build but empty to a reader.

## Not done yet

**Refreshing the Readwise cache.** `content/cache-processed.json` is committed, so builds
need no API token — but nothing fetches new documents. The Astro repo did this in
`src/content/readwise.ts` against the Readwise API, and CI committed the refreshed cache
back to `main`.

**Analytics.** `components/posthog.astro` is not ported.
