# AGENTS.md

Rust rewrite of the Astro site in `../portfolio`. Leptos renders every route to static
HTML at build time; Trunk builds a small behaviour-only wasm bundle. Deployed to GitHub
Pages.

Four workspace members:

| Package | Target | Role |
| --- | --- | --- |
| `site/` | host + wasm | the views, as a library so they compile for both |
| `prerender/` | host | renders each route to a complete HTML file |
| `readwise/` | host | refreshes the committed Readwise cache from the API |
| `portfolio` (root) | wasm | behaviour only: carousel index, accordion toggles |
| `preview/` | host | static file server imitating GitHub Pages |

Code style is a separate document: **[`STYLE.md`](./STYLE.md)** — read it before writing
Rust here. Setup and build mechanics are in [`README.md`](./README.md).

## Hard rule: no macros in this crate

Crate code uses **zero macros** — neither `view!`/`rsx!` (function-like proc macros) nor
`#[component]` / `#[server]` (attribute proc macros).

- Build the view tree with the tachys builder API: `leptos::html::div()`, `.child(x)`,
  `.class(…)`, `.style(…)`, `.on(ev::click, …)`
- The traits behind those methods (`ElementChild`, `ClassAttribute`, `StyleAttribute`,
  `OnAttribute`, `GlobalAttributes`, `AriaAttributes`, `CustomAttribute`) all come from
  `leptos::prelude::*`, which re-exports `tachys::prelude::*`
- `leptos::html` is a re-export of `tachys::html::element`; import it explicitly, it is
  **not** in the prelude
- Components are plain functions: `fn thing(args) -> impl IntoView`. No generated props
  struct, so no `#[prop(into)]` / `#[prop(optional)]` — use ordinary arguments or
  hand-written structs
- Branches and lists need explicit type erasure: prefer `Either` / `EitherOf3` over
  `.into_any()`, since `into_any()` boxes and inflates the wasm payload

Note the terminology: `macro_rules!` is a *declarative* macro; `view!` is a *procedural*
one. Tachys itself generates its element functions with `macro_rules!` internally — that
is in the dependency, not our code, and is fine.

## Toolchain: Bun for JS, Cargo for Rust

Never use `npm`, `yarn`, `pnpm`, `npx`, or `node`. JS tooling exists only to run Tailwind.

- `bun install` — install the CSS toolchain
- `bun run css` — one-shot Tailwind build → `styles/generated.css` (gitignored)
- `bun run css:watch` — watch mode
- `trunk serve` — dev server on `:8080`
- `trunk build --release` — production build into `dist/`

`rust-toolchain.toml` pins stable and auto-installs the `wasm32-unknown-unknown` target.
If `bun` is missing from `PATH`, fall back to `/opt/homebrew/bin/bun`.

## Check after every edit

Run both before declaring work done. There is no test suite yet.

```bash
cargo fmt --all
cargo clippy -p site --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo clippy -p portfolio --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo clippy -p prerender --all-targets -- -D warnings
cargo clippy -p preview --all-targets -- -D warnings
cargo clippy -p readwise --all-targets -- -D warnings
cargo test -p readwise
```

`readwise` is the only package with tests; `cargo test -p readwise` checks its date and
author formatting against all 601 items in the committed cache, which needs no token.

These are not interchangeable, and **`--workspace` must never be used**. `site` and
`portfolio` are checked for wasm; `prerender` and `preview` only build for the host,
because `tokio`'s networking and `leptos/ssr` have no wasm support. More importantly,
`site` carries no `leptos` feature of its own: `portfolio` selects `csr` and `prerender`
selects `ssr`, and they stay separate only because they are separate build roots.
`--workspace` unifies them and turns both on at once.

## How Tailwind is wired

`Trunk.toml` declares a `pre_build` hook that shells out to `bun run css`, so
`trunk build` and `trunk serve` regenerate CSS on their own. `index.html` picks the
result up via `<link data-trunk rel="css" href="styles/generated.css" />` and Trunk
content-hashes it into `dist/`.

Class strings live inside `.class("…")` calls in `.rs` files, so `styles/tailwind.css`
declares `@source "../src/**/*.rs"`. **Adding a new source directory means adding a new
`@source` glob**, or those classes get tree-shaken away silently.

`prettier-plugin-tailwindcss` does not understand Rust and is not installed here; class
ordering is manual.

## Version control

Use `jj`, not `git` (the repo is colocated). Commit regularly — one logical change per
commit, `cargo fmt` and `clippy` clean at each step. See the commit-history rules in
[`STYLE.md`](./STYLE.md#commit-history).

**Never push to `main`.** `main` is what CI deploys to Pages; it only ever moves through a
reviewed merge, never from an agent. This holds even if asked in the moment — confirm the
target branch first. Other branches may be pushed, through `jj` rather than `git`:

- `jj bookmark set <name> -r <rev>`, then `jj git push --bookmark <name> --remote origin`
- add `--allow-new` for a branch the remote has not seen
- never `jj git push --all` or `--tracked`, which can carry `main` along with it
- never force-push or rewrite history that has already been pushed

Avoid interactive `jj` commands, since stdin is not a terminal:

- `jj squash --from <src> --into <dst> -u`, never bare `jj squash`
- `jj split <path> -m "…"`, never bare `jj split`

## CI

`.github/workflows/ci.yml` has two jobs:

- `lint` — `cargo fmt --all --check` and both clippy commands above
- `build` — installs Bun and a pinned Trunk (`TRUNK_VERSION`, downloaded straight from
  the `trunk-rs/trunk` GitHub release), runs `trunk build --release`, uploads `dist/`

Trunk fetches `wasm-bindgen` itself at build time; do not install it separately. Bumping
Trunk means editing `TRUNK_VERSION` in the workflow.

## The build-time content pipeline

`build.rs` does what Astro used to, and runs on the **host** even though the crate targets
wasm, so it can decode images and parse markdown without either reaching the browser. Its
modules live in `build/` and are wired in with `#[path]` attributes:

| Module | Replaces | Output |
| --- | --- | --- |
| `build/photos.rs` | `astro:assets`, `exifreader` | `public/photos/*.jpg` + `$OUT_DIR/photos.rs` |
| `build/markdown.rs` | the `unified()` pipeline, `remark-*`, `rehype-katex` | — |
| `build/feed.rs` | `content/readwise.ts`, `lib/feed.ts` | `generated/feed.json` |
| `build/posts.rs` | `import.meta.glob` over `pages/posts/*.md` | `generated/posts/*.html` + `$OUT_DIR/posts.rs` |

Rules that follow from this:

- **Everything derivable is derived at build time** — sorting, author parsing, category
  naming, date formatting, markdown. The bundle has no markdown parser; do not add one
- **Generated Rust tables are `include!`d**, not committed: `src/photos.rs` and
  `src/pages/blog.rs` pull in `$OUT_DIR/*.rs`. The `Photo`/`Post` structs they populate are
  declared next to the `include!`
- **`public/` is served, `generated/` is not.** Trunk copies `public/` to the root of
  `dist/`, so `public/photos/x.jpg` is served at `/photos/x.jpg`. Build intermediates that
  only later build steps read — `feed.json`, post bodies — go in `generated/`, which never
  reaches `dist/`. Putting them in `public/` would add ~600 KB to the deployment that
  nothing requests
- **Maths becomes MathML** via `pulldown-latex`. The Astro site loaded KaTeX's stylesheet
  from a CDN; that `<link>` is deliberately gone
- Input sources are committed under `content/`: `cache-processed.json` and `posts/*.md`

`generated/feed.json` is the source of truth for the two reading lists. `prerender` reads
it with `serde_json` and bakes the result into HTML, so the browser never fetches or parses
it. To change what the feed pages show, change `build/feed.rs` and re-render.

## Routing and prerendering

There is no `leptos_router`, and no runtime dispatch. Its `Route` components can only be
instantiated through `view!` or by hand-building `TypedChildren`, which the no-macro rule
rules out, and static routes need no matcher.

- `site/src/router.rs` holds the `Route` enum: `Route::all()`, `path()` and `title()`
- `prerender` walks `Route::all()`, renders each with `RenderHtml::to_html()`, and
  substitutes body and title into the shell Trunk built. It runs as a Trunk `post_build`
  hook, reading `TRUNK_STAGING_DIR` — Trunk stages the build and only moves it to `dist/`
  once the pipeline succeeds, so `dist/` does not exist yet when the hook runs
- Each route lands at `<path>/index.html`, plus `404.html`, because Pages has no rewrites
- **Post routes come from the generated `POSTS` table**, so adding a markdown file is
  enough. The five fixed pages are listed by hand in `Route::all()`
- Each render runs in its own `Owner`, or reactive state would leak between routes
- Navigation is a full document load, as it was in Astro

## The browser bundle has no framework

The root package deliberately does not depend on `leptos` — only `web-sys` and
`wasm-bindgen`. Pages arrive fully rendered, so nothing on the client builds markup; it
would double up if it did. What ships is the behaviour CSS cannot express:

- the carousel's slide index, read from and written to `--current-slide`
- the accordion toggles, through **one delegated listener** on `<body>` rather than one
  per row, because the archive has 251 of them

The contract between the two halves is markup, not code: `site` emits
`data-num-slides`, `aria-controls` and `aria-expanded`; the bundle reads them and toggles
`data-open` / `data-expanded`. **Change an attribute name on one side and you must change
it on the other** — nothing type-checks across that boundary.

## Payload budget

GitHub Pages serves gzip but **not brotli**, so wasm ships close to its gzipped size.
Re-measure `dist/` after any dependency addition and flag regressions.

| Asset | Hello world | CSR peak | Now |
| --- | --- | --- | --- |
| wasm | 52 KB | 235 KB | **28 KB** |
| JS glue | 23 KB | 37 KB | **16 KB** |
| CSS | 6 KB | 55 KB | 55 KB |
| feed data on the wire | — | 598 KB | **0** |

Prerendering removed the framework and the data fetch from the client. The largest page
is now the markup itself: `archive/index.html` is 847 KB, 220 KB gzipped — served as one
document with no round-trip, where CSR needed the bundle *plus* a 598 KB fetch first.

## Views take owned data

Under edition 2024 an `impl Trait` return captures **every** input lifetime, and adding
`+ 'static` does not undo that — the opaque type still carries the lifetime. A view built
from a borrowed item therefore cannot outlive the resource guard it was read from.

So: components take `String`/`Vec<String>`/`Item` by value and destructure them, rather
than taking `&Item`. If you hit `E0515` in a view function, this is why.

## Refreshing the Readwise cache

`content/cache-processed.json` is committed, so a checkout builds with no token and the
API is only contacted deliberately:

```bash
READWISE_TOKEN=… cargo run -p readwise
```

This is `refreshProcessedCache` from `content/readwise.ts`. Two endpoints are joined:
`v3/list` has the documents but no highlight text, `v2/export` has the highlights keyed by
source URL rather than document id, so they join on a **normalised URL** (fragment
removed, trailing slash dropped). Output is written through `serde_json::Value`, whose
maps are ordered, reproducing `writeJsonCache`'s sorted keys and 2-space indent so a
refresh yields a reviewable diff.

**Dates use "Sept", not "Sep".** Current CLDR abbreviates September with four letters in
en-GB, and the committed cache was produced by a runtime that did so; 19 entries depend on
it. Some ICU builds disagree, so this is a hand-written table in two places —
`readwise/src/main.rs` and `site/build/posts.rs` — that must stay in step.

## Porting reference

The Astro original is `../portfolio`. Every ported file names its source in a module
doc comment, so `rg -n "[Pp]orted from" src build` is the fastest way to map the two.

- `astro.config.mjs` — `site: "https://whereistejas.xyz"`, apex domain, so no
  base-path handling is needed
- `src/content/cache-processed.json` — upstream of `content/cache-processed.json` here.
  One item has a `null` summary despite `processedItemSchema` declaring a plain string;
  `build/feed.rs` tolerates it

`components/posthog.astro` is deliberately not ported: the analytics are being dropped.
