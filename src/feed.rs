//! Reads `feed.json`, the asset `build/feed.rs` writes.
//!
//! Parsing goes through the browser's own `JSON.parse` rather than `serde_json`, because
//! the payload is ~600 KB and a Rust parser plus derived deserialisers would be dead
//! weight in the bundle for work the engine already does natively.

use js_sys::{Array, JSON, Reflect};
use wasm_bindgen::JsValue;

/// One feed entry, already sorted and formatted by the build.
#[derive(Clone, Debug, Default)]
pub struct Item {
    pub id: String,
    pub title: String,
    pub url: String,
    pub summary: String,
    pub category: String,
    pub meta: Vec<String>,
    pub highlights: Vec<String>,
}

impl Item {
    fn from_js(value: &JsValue) -> Self {
        Self {
            id: string(value, "id"),
            title: string(value, "title"),
            url: string(value, "url"),
            summary: string(value, "summary"),
            category: string(value, "category"),
            meta: strings(value, "meta"),
            highlights: strings(value, "highlights"),
        }
    }
}

/// Which of the two lists in `feed.json` to read.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Inbox,
    Archive,
}

impl Kind {
    /// The `paneIdPrefix` the Astro components used to namespace pane ids.
    pub fn prefix(self) -> &'static str {
        match self {
            Self::Inbox => "inbox",
            Self::Archive => "archive",
        }
    }

    fn key(self) -> &'static str {
        match self {
            Self::Inbox => "inbox",
            Self::Archive => "archive",
        }
    }
}

/// Fetches the feed and returns one of its lists. Errors surface as an empty list, since
/// a missing asset should not blank the page.
pub async fn load(kind: Kind) -> Vec<Item> {
    let Some(root) = fetch_json().await else {
        return Vec::new();
    };

    let Ok(list) = Reflect::get(&root, &JsValue::from_str(kind.key())) else {
        return Vec::new();
    };

    Array::from(&list)
        .iter()
        .map(|item| Item::from_js(&item))
        .collect()
}

async fn fetch_json() -> Option<JsValue> {
    let response = gloo_net::http::Request::get(SOURCE).send().await.ok()?;
    let body = response.text().await.ok()?;
    JSON::parse(&body).ok()
}

fn string(value: &JsValue, key: &str) -> String {
    Reflect::get(value, &JsValue::from_str(key))
        .ok()
        .and_then(|field| field.as_string())
        .unwrap_or_default()
}

fn strings(value: &JsValue, key: &str) -> Vec<String> {
    let Ok(field) = Reflect::get(value, &JsValue::from_str(key)) else {
        return Vec::new();
    };

    Array::from(&field)
        .iter()
        .filter_map(|entry| entry.as_string())
        .collect()
}

const SOURCE: &str = "/feed.json";
