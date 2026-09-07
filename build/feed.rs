//! Turns the committed Readwise cache into a compact asset the app fetches at runtime,
//! replacing the loaders in `content/readwise.ts` and the helpers in `lib/feed.ts`.
//!
//! Everything derivable is derived here — sorting, author parsing, category naming, and
//! markdown rendering — so the wasm bundle carries no markdown parser and the pages only
//! walk a list. The cache is 696 KB of JSON; embedding it in the binary would cost more
//! than fetching a trimmed copy.

use std::collections::BTreeSet;
use std::error::Error;
use std::fs;
use std::path::Path;

use serde::Deserialize;
use serde_json::{Value, json};

use crate::markdown;

pub fn generate(output_dir: &Path) -> Result<(), Box<dyn Error>> {
    let raw = fs::read_to_string(CACHE)?;
    let items = serde_json::from_str::<Vec<CacheItem>>(&raw)?;

    let (mut archive, mut inbox): (Vec<_>, Vec<_>) = items
        .into_iter()
        .partition(|item| item.location == "archive");

    // The archive orders by when an item was filed; the queue prefers when it was last
    // highlighted, matching the two sort comparators in the Astro pages.
    archive.sort_by(|a, b| b.last_moved_at.cmp(&a.last_moved_at));
    inbox.sort_by(|a, b| b.queue_order().cmp(a.queue_order()));

    let feed = json!({
        "inbox": inbox.iter().map(CacheItem::to_json).collect::<Vec<_>>(),
        "archive": archive.iter().map(CacheItem::to_json).collect::<Vec<_>>(),
    });

    fs::write(output_dir.join("feed.json"), serde_json::to_string(&feed)?)?;
    Ok(())
}

/// One entry of `cache-processed.json`, mirroring `processedItemSchema`.
#[derive(Deserialize)]
struct CacheItem {
    readwise_id: String,
    title: String,
    url: String,
    category: String,
    location: String,
    last_moved_at: String,
    #[serde(default)]
    last_highlighted_at: Option<String>,
    date_group: String,
    highlights: Vec<String>,
    // One cached item has a null summary, even though `processedItemSchema` declares it a
    // plain string. Zod never saw it, because the archive loader trusts the cache.
    #[serde(default)]
    summary: Option<String>,
    author: String,
}

impl CacheItem {
    fn to_json(&self) -> Value {
        let meta = std::iter::once(self.date_group.clone())
            .chain(authors(&self.author))
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>();

        json!({
            "id": self.readwise_id,
            "title": self.title,
            "url": self.url,
            "summary": self.summary.as_deref().unwrap_or_default(),
            "category": category(&self.category),
            "meta": meta,
            "highlights": self
                .highlights
                .iter()
                .map(|highlight| markdown::to_html(highlight))
                .collect::<Vec<_>>(),
        })
    }

    fn queue_order(&self) -> &str {
        self.last_highlighted_at
            .as_deref()
            .unwrap_or(&self.last_moved_at)
    }
}

/// Splits a Readwise author string into distinct names, dropping placeholders and bare
/// domains. Ported from `parseAuthors`; a `BTreeSet` both de-duplicates and keeps the
/// output stable, where the original relied on `Set` insertion order.
fn authors(raw: &str) -> Vec<String> {
    raw.split(['&', ','])
        .map(str::trim)
        .filter(|name| !name.is_empty() && !name.eq_ignore_ascii_case("unknown"))
        .filter(|name| !looks_like_domain(name))
        .map(str::to_owned)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

/// Matches the `/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i` test the original used to reject feed
/// names that are really hostnames.
fn looks_like_domain(name: &str) -> bool {
    let labelled = |label: &str| {
        !label.is_empty()
            && label
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '-')
    };

    name.contains('.') && name.split('.').all(labelled)
}

/// `displayCategory`: Readwise calls books "epub".
fn category(category: &str) -> &str {
    match category {
        "epub" => "book",
        other => other,
    }
}

const CACHE: &str = "content/cache-processed.json";
