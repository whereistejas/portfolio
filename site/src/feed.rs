//! The shape of `feed.json`, the asset `build/feed.rs` writes.
//!
//! `feed.json` is the source of truth for the two reading lists. The prerenderer reads it
//! and bakes the result into HTML, so the browser never fetches or parses it.

use serde::Deserialize;

/// One feed entry, already sorted and formatted by the build.
#[derive(Clone, Debug, Default, Deserialize)]
pub struct Item {
    pub id: String,
    pub title: String,
    pub url: String,
    pub summary: String,
    pub category: String,
    pub meta: Vec<String>,
    pub highlights: Vec<String>,
}

/// Which of the two lists in `feed.json` a page renders.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Archive,
    Inbox,
}

impl Kind {
    /// The `paneIdPrefix` the Astro components used to namespace pane ids.
    pub fn prefix(self) -> &'static str {
        match self {
            Self::Archive => "archive",
            Self::Inbox => "inbox",
        }
    }
}
