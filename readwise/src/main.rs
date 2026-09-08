//! Refreshes `content/cache-processed.json` from the Readwise API, ported from
//! `refreshProcessedCache` in `content/readwise.ts`.
//!
//! Nothing in the build talks to Readwise: the cache is committed, so a checkout builds
//! without a token and the API is only contacted when this is run deliberately. That is
//! the same split the Astro site used, where loaders read the cache and `bun run
//! build:queue` refreshed it.
//!
//! Run with `READWISE_TOKEN` set:
//!
//! ```text
//! READWISE_TOKEN=… cargo run -p readwise
//! ```
//!
//! Two endpoints are involved. `v3/list` has the documents but no highlight text;
//! `v2/export` has the highlights but keys them by source URL rather than document id, so
//! the two are joined on a normalised URL.

use std::collections::BTreeMap;
use std::error::Error;
use std::fs;
use std::path::Path;
use std::thread::sleep;
use std::time::Duration;

use serde::Deserialize;
use serde_json::{Value, json};
use url::Url;

fn main() -> Result<(), Box<dyn Error>> {
    let token = std::env::var("READWISE_TOKEN")
        .map_err(|_| "READWISE_TOKEN is not set; refusing to fetch without a token")?;

    let client = Client::new(token);

    println!("[readwise] fetching archive + queue documents and highlights");
    let archive = client.documents("archive")?;
    let queue = client.documents("new")?;
    let highlights = client.highlights()?;

    // Keyed by id, so a document appearing in both responses is stored once. A BTreeMap
    // also gives the output a stable order, which keeps the committed diff readable.
    let mut merged = BTreeMap::new();
    for document in archive.iter().chain(queue.iter()) {
        merged.insert(document.id.clone(), document.to_processed(&highlights));
    }

    let items = merged.into_values().collect::<Vec<_>>();
    write_cache(Path::new(CACHE), &items)?;

    println!(
        "[readwise] cached {} archive + {} queue documents ({} total, {} with highlights)",
        archive.len(),
        queue.len(),
        items.len(),
        items
            .iter()
            .filter(|item| item["highlights"].as_array().is_some_and(|a| !a.is_empty()))
            .count(),
    );

    Ok(())
}

/// A Readwise API client that retries when rate limited.
struct Client {
    agent: ureq::Agent,
    token: String,
}

impl Client {
    fn new(token: String) -> Self {
        let agent = ureq::Agent::config_builder()
            // 429 has to arrive as a response, not an error, so `retry-after` is readable.
            .http_status_as_error(false)
            .build()
            .into();

        Self { agent, token }
    }

    /// Every document at one location, following `nextPageCursor` to the end.
    fn documents(&self, location: &str) -> Result<Vec<Document>, Box<dyn Error>> {
        let mut documents = Vec::new();
        let mut cursor: Option<String> = None;

        loop {
            let mut url = Url::parse(LIST_ENDPOINT)?;
            url.query_pairs_mut().append_pair("location", location);
            if let Some(cursor) = &cursor {
                url.query_pairs_mut().append_pair("pageCursor", cursor);
            }

            let page = self.get::<ListPage>(url.as_str())?;
            documents.extend(page.results);
            cursor = page.next_page_cursor.filter(|cursor| !cursor.is_empty());

            if cursor.is_none() {
                break;
            }
        }

        // Newest first, matching the sort the original applied before merging.
        documents.sort_by(|a, b| b.last_moved_at.cmp(&a.last_moved_at));
        Ok(documents)
    }

    /// Highlight text for every book, grouped by normalised source URL.
    fn highlights(&self) -> Result<BTreeMap<String, Highlights>, Box<dyn Error>> {
        let mut grouped: BTreeMap<String, Highlights> = BTreeMap::new();
        let mut cursor: Option<String> = None;

        loop {
            let mut url = Url::parse(EXPORT_ENDPOINT)?;
            if let Some(cursor) = &cursor {
                url.query_pairs_mut().append_pair("pageCursor", cursor);
            }

            let page = self.get::<ExportPage>(url.as_str())?;

            for book in page.results {
                let Some(source_url) = book.source_url.filter(|_| !book.is_deleted) else {
                    continue;
                };

                let live = book
                    .highlights
                    .iter()
                    .filter(|highlight| !highlight.is_deleted);
                let texts = live
                    .clone()
                    .map(|highlight| highlight.text.clone())
                    .filter(|text| !text.is_empty())
                    .collect::<Vec<_>>();

                if texts.is_empty() {
                    continue;
                }

                let last = live.fold(None, |latest, highlight| {
                    pick_latest(latest, highlight.highlighted_at.clone())
                });

                // Several books can share a source URL, so merge rather than replace.
                let entry = grouped.entry(normalize_url(&source_url)).or_default();
                entry.texts.extend(texts);
                entry.last_highlighted_at = pick_latest(entry.last_highlighted_at.take(), last);
            }

            cursor = page.next_page_cursor.filter(|cursor| !cursor.is_empty());
            if cursor.is_none() {
                break;
            }
        }

        Ok(grouped)
    }

    /// Performs one request, waiting and retrying while Readwise reports 429.
    fn get<T: for<'de> Deserialize<'de>>(&self, url: &str) -> Result<T, Box<dyn Error>> {
        for attempt in 1..=MAX_ATTEMPTS {
            let mut response = self
                .agent
                .get(url)
                .header("Authorization", &format!("Token {}", self.token))
                .call()?;

            let status = response.status().as_u16();

            if status == 429 && attempt < MAX_ATTEMPTS {
                let wait = response
                    .headers()
                    .get("retry-after")
                    .and_then(|value| value.to_str().ok())
                    .map_or(DEFAULT_RETRY, parse_retry_after);

                println!(
                    "[readwise] 429 rate limited, waiting {wait}s (attempt {attempt}/{MAX_ATTEMPTS})"
                );
                sleep(Duration::from_secs(wait));
                continue;
            }

            if !(200..300).contains(&status) {
                return Err(format!("{url} returned {status}").into());
            }

            return Ok(serde_json::from_str(
                &response.body_mut().read_to_string()?,
            )?);
        }

        Err(format!("{url} was still rate limited after {MAX_ATTEMPTS} attempts").into())
    }
}

/// One document from `v3/list`.
#[derive(Deserialize)]
struct Document {
    id: String,
    source_url: String,
    last_moved_at: String,
    title: String,
    summary: Option<String>,
    author: Option<String>,
    location: String,
    category: Option<String>,
}

impl Document {
    /// Builds one entry of `cache-processed.json`.
    ///
    /// The keys are emitted through `serde_json::Value`, whose maps are ordered, so the
    /// committed file sorts its keys exactly as `writeJsonCache` did.
    fn to_processed(&self, highlights: &BTreeMap<String, Highlights>) -> Value {
        let bundle = highlights.get(&normalize_url(&self.source_url));

        json!({
            "readwise_id": self.id,
            "title": self.title,
            "url": self.source_url,
            "category": self.category.as_deref().unwrap_or("article"),
            "location": self.location,
            "last_moved_at": self.last_moved_at,
            "last_highlighted_at": bundle.and_then(|b| b.last_highlighted_at.clone()),
            "date_group": date_group(&self.last_moved_at),
            "highlights": bundle.map(|b| b.texts.clone()).unwrap_or_default(),
            "summary": self.summary.as_deref().unwrap_or_default(),
            "author": clean_author(self.author.as_deref()),
        })
    }
}

#[derive(Deserialize)]
struct ListPage {
    results: Vec<Document>,
    #[serde(rename = "nextPageCursor")]
    next_page_cursor: Option<String>,
}

#[derive(Deserialize)]
struct ExportPage {
    results: Vec<Book>,
    #[serde(rename = "nextPageCursor")]
    next_page_cursor: Option<String>,
}

#[derive(Deserialize)]
struct Book {
    source_url: Option<String>,
    is_deleted: bool,
    highlights: Vec<Highlight>,
}

#[derive(Deserialize)]
struct Highlight {
    text: String,
    is_deleted: bool,
    highlighted_at: Option<String>,
}

/// Highlight text for one source URL.
#[derive(Default)]
struct Highlights {
    texts: Vec<String>,
    last_highlighted_at: Option<String>,
}

/// Writes the cache with sorted keys and two-space indentation, matching
/// `writeJsonCache` so a refresh produces a reviewable diff.
fn write_cache(path: &Path, items: &[Value]) -> Result<(), Box<dyn Error>> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(path, serde_json::to_string_pretty(items)?)?;
    Ok(())
}

/// Drops placeholder authors and bare hostnames, as `cleanAuthor` did.
fn clean_author(raw: Option<&str>) -> String {
    let trimmed = raw.unwrap_or_default().trim();

    let is_domain = trimmed.contains('.')
        && trimmed.split('.').all(|label| {
            !label.is_empty()
                && label
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
        });

    match trimmed.is_empty() || trimmed.eq_ignore_ascii_case("unknown") || is_domain {
        true => String::new(),
        false => trimmed.to_owned(),
    }
}

/// The join key between the two endpoints: fragment removed and any trailing slash
/// dropped, so the same article is recognised across both.
fn normalize_url(input: &str) -> String {
    let Ok(mut url) = Url::parse(input) else {
        return input.trim().to_owned();
    };

    url.set_fragment(None);

    let path = url.path().to_owned();
    if let Some(trimmed) = path.strip_suffix('/').filter(|_| path.len() > 1) {
        url.set_path(trimmed);
    }

    url.to_string()
}

/// ISO 8601 timestamps compare correctly as strings, so the later one is the greater.
fn pick_latest(a: Option<String>, b: Option<String>) -> Option<String> {
    match (a, b) {
        (Some(a), Some(b)) => Some(a.max(b)),
        (value, None) | (None, value) => value,
    }
}

/// Formats `2026-08-26T13:20:51.477Z` as `26 Aug 2026`, the `en-GB` output the Astro
/// version produced with `toLocaleDateString`.
fn date_group(timestamp: &str) -> String {
    let date = timestamp.split('T').next().unwrap_or_default();
    let parts = date.split('-').collect::<Vec<_>>();

    let [year, month, day] = parts.as_slice() else {
        return timestamp.to_owned();
    };

    let named = month
        .parse::<usize>()
        .ok()
        .and_then(|month| MONTHS.get(month.wrapping_sub(1)))
        .copied();

    // Only rewrite something that really is a date; otherwise pass the input through
    // rather than emitting a rearrangement of it.
    match (named, year.parse::<u16>(), day.parse::<u8>()) {
        (Some(month), Ok(_), Ok(_)) => format!("{day} {month} {year}"),
        _ => timestamp.to_owned(),
    }
}

/// `retry-after` is either a number of seconds or an HTTP date. Only the numeric form is
/// honoured; a date falls back to the default, since parsing one would need a date
/// library for a header Readwise sends as seconds.
fn parse_retry_after(value: &str) -> u64 {
    value.trim().parse().unwrap_or(DEFAULT_RETRY)
}

const CACHE: &str = "content/cache-processed.json";
const LIST_ENDPOINT: &str = "https://readwise.io/api/v3/list/";
const EXPORT_ENDPOINT: &str = "https://readwise.io/api/v2/export/";
const MAX_ATTEMPTS: u32 = 5;
const DEFAULT_RETRY: u64 = 60;
/// Month abbreviations as en-GB renders them. Note **"Sept"**: current CLDR abbreviates
/// September with four letters in en-GB, and the committed cache was produced by a
/// runtime that did so. Using "Sep" would rewrite 19 existing entries on the next
/// refresh. Some older ICU builds (Bun's, at the time of writing) still say "Sep", so
/// this cannot be delegated to a date library without reintroducing the discrepancy.
const MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_dates_as_en_gb() {
        assert_eq!(date_group("2026-08-26T13:20:51.477Z"), "26 Aug 2026");
        // en-GB abbreviates September with four letters; see MONTHS.
        assert_eq!(date_group("2025-09-30T22:57:18.866Z"), "30 Sept 2025");
        assert_eq!(date_group("2025-01-02T00:00:00Z"), "02 Jan 2025");
        // Unparseable input is passed through rather than replaced with a wrong date.
        assert_eq!(date_group("not-a-date"), "not-a-date");
    }

    #[test]
    fn drops_placeholder_and_hostname_authors() {
        assert_eq!(clean_author(Some("Alex Chalmers")), "Alex Chalmers");
        assert_eq!(clean_author(Some("  Ben Southwood  ")), "Ben Southwood");
        assert_eq!(clean_author(Some("Unknown")), "");
        assert_eq!(clean_author(Some("unknown")), "");
        assert_eq!(clean_author(Some("worksinprogress.co")), "");
        assert_eq!(clean_author(Some("news.ycombinator.com")), "");
        assert_eq!(clean_author(None), "");
        // A name containing a dot is not a hostname.
        assert_eq!(clean_author(Some("J. R. R. Tolkien")), "J. R. R. Tolkien");
    }

    #[test]
    fn normalises_urls_for_joining() {
        let cases = [
            ("https://example.com/post/", "https://example.com/post"),
            (
                "https://example.com/post#section",
                "https://example.com/post",
            ),
            ("https://example.com/", "https://example.com/"),
            ("https://example.com/a?b=c", "https://example.com/a?b=c"),
        ];

        for (input, expected) in cases {
            assert_eq!(normalize_url(input), expected, "input: {input}");
        }
    }

    #[test]
    fn picks_the_later_timestamp() {
        let earlier = Some("2025-01-01T00:00:00Z".to_owned());
        let later = Some("2026-01-01T00:00:00Z".to_owned());

        assert_eq!(pick_latest(earlier.clone(), later.clone()), later);
        assert_eq!(pick_latest(later.clone(), earlier), later);
        assert_eq!(pick_latest(None, later.clone()), later);
        assert_eq!(pick_latest(later.clone(), None), later);
        assert_eq!(pick_latest(None, None), None);
    }

    /// Checks the port against the cache the Astro version actually produced: every
    /// `date_group` and `author` in it must be reproducible from the same inputs.
    #[test]
    fn reproduces_the_committed_cache() {
        let raw = fs::read_to_string("../content/cache-processed.json")
            .expect("the committed cache should be readable");
        let items = serde_json::from_str::<Vec<Value>>(&raw).expect("cache should be JSON");

        assert!(
            items.len() > 500,
            "expected the full cache, got {}",
            items.len()
        );

        for item in &items {
            let moved = item["last_moved_at"].as_str().unwrap_or_default();
            assert_eq!(
                date_group(moved),
                item["date_group"].as_str().unwrap_or_default(),
                "date_group mismatch for {moved}"
            );

            // Authors were already cleaned on the way in, so cleaning is a no-op.
            let author = item["author"].as_str().unwrap_or_default();
            assert_eq!(
                clean_author(Some(author)),
                author,
                "author changed: {author}"
            );
        }
    }
}
