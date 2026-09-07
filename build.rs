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
    for input in ["assets", "content", "build.rs", "build"] {
        println!("cargo::rerun-if-changed={input}");
    }

    let out_dir = PathBuf::from(std::env::var("OUT_DIR")?);
    let output_dir = Path::new(OUTPUT_DIR);

    photos::generate()?;
    feed::generate(output_dir)?;
    posts::generate(output_dir, &out_dir)?;

    Ok(())
}

/// Trunk copies this directory to the root of `dist/`, so paths here are also URLs.
const OUTPUT_DIR: &str = "public";
