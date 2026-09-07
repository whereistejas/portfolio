# AGENTS.md

Rust rewrite of the Astro site in `../portfolio`. Leptos CSR + Trunk, static output
destined for GitHub Pages.

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
cargo clippy -p portfolio --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo clippy -p preview --all-targets -- -D warnings
```

The two clippy invocations are not interchangeable. `portfolio` must be checked against
`wasm32-unknown-unknown`, since the host target compiles a different feature set and will
not catch what CI catches. `preview` must be checked against the **host** target, because
`tokio`'s networking does not build for wasm at all. Never use `--workspace` here.

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
commit, `cargo fmt` and `clippy` clean at each step. Never push; leave commits local for
review. See the commit-history rules in [`STYLE.md`](./STYLE.md#commit-history).

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
| `build/feed.rs` | `content/readwise.ts`, `lib/feed.ts` | `public/feed.json` |
| `build/posts.rs` | `import.meta.glob` over `pages/posts/*.md` | `public/posts/*.html` + `$OUT_DIR/posts.rs` |

Rules that follow from this:

- **Everything derivable is derived at build time** — sorting, author parsing, category
  naming, date formatting, markdown. The bundle has no markdown parser; do not add one
- **Generated Rust tables are `include!`d**, not committed: `src/photos.rs` and
  `src/pages/blog.rs` pull in `$OUT_DIR/*.rs`. The `Photo`/`Post` structs they populate are
  declared next to the `include!`
- **`public/` is both an output directory and a URL namespace.** Trunk copies it to the
  root of `dist/`, so `public/feed.json` is served at `/feed.json`. Generated entries are
  gitignored; committed assets (fonts, favicons) are not
- **Maths becomes MathML** via `pulldown-latex`. The Astro site loaded KaTeX's stylesheet
  from a CDN; that `<link>` is deliberately gone
- Input sources are committed under `content/`: `cache-processed.json` and `posts/*.md`

`src/feed.rs` reads `feed.json` at runtime through the browser's own `JSON.parse` and
`js_sys::Reflect`, **not** `serde`. The payload is ~600 KB and a Rust parser plus derived
deserialisers would be dead weight for work the engine already does natively.

## Routing

There is no `leptos_router`. Its `Route` components can only be instantiated through
`view!` or by hand-building `TypedChildren`, which the no-macro rule rules out, and five
static routes do not need a matcher.

- `src/router.rs` matches `location.pathname` and returns the page view
- It **percent-decodes** the path first: post slugs come from filenames and contain spaces
- `scripts/emit-routes.sh` runs as a Trunk `post_build` hook and copies the built
  `index.html` to each route directory plus `404.html`, because Pages has no rewrites
- Adding a route means touching `Route`, `router::view`, *and* the hook's route list
- Navigation is a full document load, as it was in Astro; the wasm comes from cache

## Payload budget

GitHub Pages serves gzip but **not brotli**, so wasm ships close to its gzipped size.
Re-measure `dist/` after any dependency addition and flag regressions.

| Asset | Hello world | Now |
| --- | --- | --- |
| wasm | 52 KB | 235 KB |
| JS glue | 23 KB | 37 KB |
| CSS | 6 KB | 55 KB |
| `feed.json` | — | 598 KB (222 KB gzipped) |

This is what the no-macro/no-`into_any` discipline is protecting.

## Views take owned data

Under edition 2024 an `impl Trait` return captures **every** input lifetime, and adding
`+ 'static` does not undo that — the opaque type still carries the lifetime. A view built
from a borrowed item therefore cannot outlive the resource guard it was read from.

So: components take `String`/`Vec<String>`/`Item` by value and destructure them, rather
than taking `&Item`. If you hit `E0515` in a view function, this is why.

## Porting reference

The Astro original is `../portfolio`. Every ported file names its source in a module
doc comment, so `rg -n "[Pp]orted from" src build` is the fastest way to map the two.

- `astro.config.mjs` — `site: "https://whereistejas.xyz"`, apex domain, so no
  base-path handling is needed
- `src/content/cache-processed.json` — upstream of `content/cache-processed.json` here.
  One item has a `null` summary despite `processedItemSchema` declaring a plain string;
  `build/feed.rs` tolerates it

Still outstanding: the site is CSR only, so crawlers and link-preview bots get an empty
`<body>`. Prerendering is the remaining structural work — see "Not done yet" in
`README.md`. Also unported: the Readwise API fetch itself (the cache is committed, so
builds work without a token, but nothing refreshes it) and `components/posthog.astro`.
