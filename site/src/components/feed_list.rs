//! The shared body of the inbox and archive pages, standing in for the `getCollection`
//! call each Astro page made plus `components/FeedItem.astro`.
//!
//! Like Astro, this has the data in hand while rendering: the prerenderer reads
//! `feed.json` and passes the list straight in, so there is no loading state.

use leptos::either::Either;
use leptos::html;
use leptos::prelude::*;

use crate::components::feed_card::Card;
use crate::components::highlights;
use crate::feed::{Item, Kind};

pub fn feed_list(kind: Kind, items: Vec<Item>) -> impl IntoView {
    let rows = items
        .into_iter()
        .map(|item| row(item, kind))
        .collect::<Vec<_>>();

    let feed = html::div().class("feed").child(rows);

    // The archive page nests the feed in a positioning wrapper; the inbox does not.
    match kind {
        Kind::Archive => Either::Left(
            html::div()
                .class("archive_wrapper")
                .id("archive-wrapper")
                .child(feed),
        ),
        Kind::Inbox => Either::Right(feed),
    }
}

/// An item with highlights becomes an accordion, everything else a plain card. This is
/// the `hasHighlights` branch from `FeedItem.astro`.
///
/// Takes the item by value: under edition 2024 an `impl Trait` return captures every
/// input lifetime, so borrowing here would stop the view outliving the resource guard the
/// items were read from.
fn row(item: Item, kind: Kind) -> impl IntoView {
    match item.highlights.is_empty() {
        false => Either::Left(highlights::view(item, kind.prefix())),
        true => Either::Right(
            Card {
                title: item.title,
                href: item.url,
                summary: item.summary,
                category: item.category,
                meta: item.meta,
                link_whole_card: false,
            }
            .into_view(),
        ),
    }
}
