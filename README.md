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

## How the build is wired

Four files do the work:

**`Cargo.toml`** — `leptos` with the `csr` feature (client-side rendering; no server, no
hydration). The release profile is tuned for payload rather than speed: `opt-level = "z"`,
`lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`.

**`index.html`** — Trunk's entry point, not a template. Trunk scans it for `data-trunk`
link tags, runs each through an asset pipeline, and rewrites the tag to point at the
content-hashed output. Here that's one tag:

```html
<link data-trunk rel="css" href="styles/generated.css" />
```

Trunk finds the Rust binary on its own from `Cargo.toml` — there is no `rel="rust"` tag.
`<body>` is empty because `mount_to_body` fills it at runtime.

**`Trunk.toml`** — sets `dist/` as the output and, importantly, declares the Tailwind
hook:

```toml
[[hooks]]
stage = "pre_build"
command = "bun"
command_arguments = ["run", "css"]
```

`pre_build` runs before the asset pipeline, so `styles/generated.css` exists by the time
Trunk goes looking for it. This is why you never run Tailwind by hand.

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
bun run css                  # one-shot Tailwind build
bun run css:watch            # Tailwind in watch mode
cargo fmt --all
cargo clippy --target wasm32-unknown-unknown --all-targets -- -D warnings
```

Always pass `--target wasm32-unknown-unknown` to clippy. The default host target compiles
a different set of features and will miss things CI catches.

## What a release build produces

```
dist/
├── index.html
├── generated-<hash>.css
├── portfolio-<hash>.js          # wasm-bindgen glue
└── portfolio-<hash>_bg.wasm
```

Current hello-world size: **52 KB wasm + 23 KB JS**. Worth re-checking after adding
dependencies — GitHub Pages serves gzip but not brotli, so the wire size stays close to
the gzipped size.

## CI

`.github/workflows/ci.yml`, two jobs:

- **`lint`** — `cargo fmt --all --check`, then clippy with `-D warnings`
- **`build`** — installs Bun and Trunk, runs `trunk build --release`, uploads `dist/`

Trunk is pinned by the `TRUNK_VERSION` env var and downloaded straight from the
`trunk-rs/trunk` GitHub release, rather than via a third-party action or a slow
`cargo install`. Bump the version there.

## Not done yet

This is CSR only, which means crawlers and link-preview bots get an empty
`<body>`. Before this replaces the Astro site it needs prerendering via
`SsrMode::Static` + `leptos_axum`'s `StaticRouteGenerator`, driven by a small binary
that boots the Leptos config, generates, and exits — Leptos has no `--ssg` flag.

Also outstanding: the Readwise build-time pipeline, the five routes, and the highlights
accordion. See the porting notes in `AGENTS.md`.
