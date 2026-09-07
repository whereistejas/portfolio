//! Ported from `components/FeedCard.astro`.

use leptos::either::Either;
use leptos::html;
use leptos::prelude::*;

/// A feed row. `link_whole_card` swaps which element carries the link: the Astro version
/// picked its wrapper and title tags dynamically, which is the same decision made here.
pub struct Card {
    pub title: String,
    pub href: String,
    pub summary: String,
    pub category: String,
    pub meta: Vec<String>,
    pub link_whole_card: bool,
}

impl Card {
    pub fn into_view(self) -> impl IntoView {
        let Self {
            title,
            href,
            summary,
            category,
            meta,
            link_whole_card,
        } = self;

        let body = (
            title_view(title, href.clone(), link_whole_card),
            (!summary.is_empty()).then(|| html::span().class("feed-desc").child(summary)),
            meta_view(category, meta),
        );

        match link_whole_card {
            true => Either::Left(html::a().class("feed-item").href(href).child(body)),
            false => Either::Right(html::div().class("feed-item").child(body)),
        }
    }
}

/// When the whole card is a link the title must not be one too, so it degrades to a span.
fn title_view(title: String, href: String, link_whole_card: bool) -> impl IntoView {
    match link_whole_card {
        true => Either::Left(html::span().class("feed-title").child(title)),
        false => Either::Right(
            html::a()
                .class("feed-title")
                .href(href)
                .target("_blank")
                .rel("noopener noreferrer")
                .child(title),
        ),
    }
}

/// The metadata line, wrapped. Callers that need to append their own trailing content
/// use [`meta_parts`] and supply the wrapper themselves.
pub fn meta_view(category: String, meta: Vec<String>) -> impl IntoView {
    html::span()
        .class("feed-meta")
        .child(meta_parts(category, meta))
}

/// An optional category, then each part separated by a glyph.
pub fn meta_parts(category: String, meta: Vec<String>) -> impl IntoView {
    let category = (!category.is_empty()).then(|| {
        (
            html::span()
                .class("hidden items-center md:inline-flex")
                .child(category),
            html::span()
                .class("hidden items-center md:inline-flex")
                .child(separator()),
        )
    });

    let parts = meta
        .into_iter()
        .enumerate()
        .map(|(index, part)| ((index > 0).then(separator), html::span().child(part)))
        .collect::<Vec<_>>();

    (category, parts)
}

pub fn separator() -> impl IntoView {
    html::span().class("feed-separator").child(SEPARATOR)
}

const SEPARATOR: &str = "\u{2726}";
