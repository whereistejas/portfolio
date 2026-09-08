//! Build-time content pipeline, standing in for everything Astro did before serving a
//! request: image processing, markdown rendering, and reading the Readwise cache.
//!
//! It runs on the host even though the crate targets wasm, so it can use an image decoder
//! and a markdown parser without either reaching the browser.

#[path = "build/feed.rs"]
mod feed;
#[path = "build/markdown.rs"]
mod markdown;
#[path = "build/photos.rs"]
mod photos;
#[path = "build/posts.rs"]
mod posts;

use std::error::Error;
use std::path::{Path, PathBuf};

fn main() -> Result<(), Box<dyn Error>> {
    // Sources and outputs live at the workspace root, not in this package: `assets/`
    // and `content/` are inputs, and `public/` is what Trunk copies into `dist/`.
    // Paths in rerun-if-changed are resolved against the package directory.
    for input in ["../assets", "../content", "build.rs", "build"] {
        println!("cargo::rerun-if-changed={input}");
    }

    let out_dir = PathBuf::from(std::env::var("OUT_DIR")?);

    // Every path below is relative to the workspace root, so move there once rather
    // than threading a base directory through each module.
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR")?);
    let root = manifest.parent().ok_or("package has no parent directory")?;
    std::env::set_current_dir(root)?;

    let generated = Path::new(GENERATED_DIR);

    // Only the photos are served directly; the feed and post bodies are consumed by
    // later build steps and never reach `dist/`.
    photos::generate()?;
    feed::generate(generated)?;
    posts::generate(generated, &out_dir)?;

    Ok(())
}

/// Build intermediates: read by later build steps, never served.
const GENERATED_DIR: &str = "generated";
