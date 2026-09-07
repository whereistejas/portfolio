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
cargo clippy --target wasm32-unknown-unknown --all-targets -- -D warnings
```

Pass `--target wasm32-unknown-unknown` to clippy — the default host target compiles a
different feature set and will not catch what CI catches.

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

- `lint` — `cargo fmt --all --check` and the clippy command above
- `build` — installs Bun and a pinned Trunk (`TRUNK_VERSION`, downloaded straight from
  the `trunk-rs/trunk` GitHub release), runs `trunk build --release`, uploads `dist/`

Trunk fetches `wasm-bindgen` itself at build time; do not install it separately. Bumping
Trunk means editing `TRUNK_VERSION` in the workflow.

## Payload budget

The reason for the no-macro/no-`into_any` discipline: hello world currently costs **52 KB
wasm + 23 KB JS glue**. GitHub Pages serves gzip but **not brotli**, so wasm ships close
to its gzipped size. Re-measure `dist/` after any dependency addition and flag
regressions.

## Porting reference

The Astro original is `../portfolio`. Relevant prior art there:

- `src/content/readwise.ts` — build-time Readwise fetch plus the committed
  `src/content/cache-processed.json` (696 KB) that lets CI build without an API token
- `src/components/HighlightsAccordion.tsx` — the only genuinely interactive component
- `src/pages/{index,blog,inbox,archive,info}.astro` — the five routes to reproduce
- `astro.config.mjs` — `site: "https://whereistejas.xyz"`, apex domain, so no
  base-path handling is needed

Open question, not yet decided: pure CSR (current setup) leaves crawlers an empty shell.
Prerendering via `SsrMode::Static` + `StaticRouteGenerator` from `leptos_axum` is the
intended fix, and requires a small binary that boots Leptos options, generates, and exits.
