# portfolio-rs

Rust rewrite of [whereistejas.xyz](https://whereistejas.xyz) — currently a Leptos
"hello world" wired up to Trunk and Tailwind v4. The Astro original lives in
`../portfolio`.

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

A two-member Cargo workspace:

- **`portfolio`** (repo root) — the Leptos app, compiled to `wasm32-unknown-unknown`
- **`preview/`** — a native static file server that imitates GitHub Pages

They are split because Trunk compiles the root package for wasm, where `tokio`'s
networking does not build. Keep cargo commands package-scoped rather than using
`--workspace`.

`cargo run -p preview` serves `dist/` on `:4321` with Pages' quirks: exact-match files, a
301 to the trailing-slash form for directories holding an index, `404.html` with a real
404 status, and gzip but never brotli. Use it to check a release build; use `trunk serve`
while writing code.

## How the build is wired

Five files do the work:

**`Cargo.toml`** — `leptos` with the `csr` feature (client-side rendering; no server, no
hydration). The release profile is tuned for payload rather than speed: `opt-level = "z"`,
`lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`.

**`index.html`** — Trunk's entry point, not a template. Trunk scans it for `data-trunk`
link tags, runs each through an asset pipeline, and rewrites the tag to point at the
content-hashed output. Here that's one tag:

```html
<link data-trunk rel="css" href="styles/generated.css" />
```

plus a `copy-dir` tag that flattens `public/` onto the root of `dist/`, which is what makes
`/feed.json` and `/NebulaSans-Book.woff2` resolve.

Trunk finds the Rust binary on its own from `Cargo.toml` — there is no `rel="rust"` tag.
The `<body>` holds only the `rel="me"` link; `mount_to_body` fills in the rest at runtime.

**`Trunk.toml`** — sets `dist/` as the output and declares two hooks:

```toml
[[hooks]]
stage = "pre_build"
command = "bun"
command_arguments = ["run", "css"]

[[hooks]]
stage = "post_build"
command = "sh"
command_arguments = ["scripts/emit-routes.sh"]
```

`pre_build` runs before the asset pipeline, so `styles/generated.css` exists by the time
Trunk goes looking for it — which is why you never run Tailwind by hand. `post_build`
copies the finished HTML to one file per route, since Pages cannot rewrite `/inbox` onto
`index.html`.

**`build.rs`** — the content pipeline, standing in for everything Astro did at build
time. It runs on the host, so an image decoder and a markdown parser never reach the
browser:

| Module | Replaces | Output |
| --- | --- | --- |
| `build/photos.rs` | `astro:assets`, `exifreader` | resized JPEGs + caption table |
| `build/markdown.rs` | `unified()`, `remark-*`, `rehype-katex` | — |
| `build/feed.rs` | `content/readwise.ts`, `lib/feed.ts` | `feed.json` |
| `build/posts.rs` | `import.meta.glob` over `posts/*.md` | post HTML + listing table |

Sources live in `content/` and `assets/`; everything generated lands in `public/`, which
is gitignored per-entry. Maths is rendered to **MathML**, so the KaTeX CDN stylesheet the
Astro site loaded is gone.

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
cargo clippy -p portfolio --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo clippy -p preview --all-targets -- -D warnings
```

The two clippy lines are per-package on purpose. `portfolio` needs
`--target wasm32-unknown-unknown`, because the host target compiles a different set of
features and misses things CI catches. `preview` needs the host target, because `tokio`'s
networking does not build for wasm. `--workspace` cannot satisfy both.

## What a release build produces

```
dist/
├── index.html                    # and one copy per route, plus 404.html
├── blog/index.html
├── inbox/index.html
├── archive/index.html
├── info/index.html
├── posts/<slug>/index.html       # one directory per post
├── posts/<slug>.html             # the rendered body, fetched on demand
├── feed.json                     # the trimmed Readwise cache
├── photos/<name>-{400,800}.jpg
├── generated-<hash>.css
├── portfolio-<hash>.js           # wasm-bindgen glue
└── portfolio-<hash>_bg.wasm
```

| Asset | Hello world | Now |
| --- | --- | --- |
| wasm | 52 KB | 235 KB |
| JS glue | 23 KB | 37 KB |
| CSS | 6 KB | 55 KB |
| `feed.json` | — | 598 KB (222 KB gzipped) |

Worth re-checking after adding dependencies — GitHub Pages serves gzip but not brotli, so
the wire size stays close to the gzipped size.

## CI

`.github/workflows/ci.yml`, two jobs:

- **`lint`** — `cargo fmt --all --check`, then clippy for each package with `-D warnings`
- **`build`** — installs Bun and Trunk, runs `trunk build --release`, uploads `dist/`

Trunk is pinned by the `TRUNK_VERSION` env var and downloaded straight from the
`trunk-rs/trunk` GitHub release, rather than via a third-party action or a slow
`cargo install`. Bump the version there.

## Not done yet

**Prerendering.** This is CSR only, so crawlers and link-preview bots get an empty
`<body>`, and the feed pages show nothing until `feed.json` arrives. Fixing it means
rendering each route to HTML at build time and switching the client from `mount_to_body`
to `hydrate_body`.

**Refreshing the Readwise cache.** `content/cache-processed.json` is committed, so builds
need no API token — but nothing fetches new documents. The Astro repo did this in
`src/content/readwise.ts` against the Readwise API, and CI committed the refreshed cache
back to `main`.

**Analytics.** `components/posthog.astro` is not ported.
