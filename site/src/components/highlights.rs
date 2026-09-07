//! Ported from `components/HighlightsAccordion.tsx`.
//!
//! The original drove three animations through framer-motion: the pane's height, a
//! staggered fade of each highlight, and the summary growing from its two-line clamp.
//! All three are CSS here, keyed off `data-open` and `data-expanded`, so no animation
//! runtime ships. See the `feed-highlights-*` rules in `styles/tailwind.css`.
//!
//! The markup renders collapsed. Toggling those attributes is the browser bundle's job;
//! it finds the pane through `aria-controls` and the row through `closest(".feed-item")`,
//! which is what the React version did to mark the expanded row.
//!
//! Every helper takes owned data, because under edition 2024 an `impl Trait` return
//! captures every input lifetime and a borrowed item would pin the view to it.

use leptos::html;
use leptos::prelude::*;

use crate::components::feed_card::{meta_parts, separator};
use crate::feed::Item;

/// A feed row whose highlights can be expanded.
pub fn view(item: Item, prefix: &str) -> impl IntoView {
    let pane_id = format!("{prefix}-highlights-{}", item.id);

    let Item {
        id,
        title,
        url,
        summary,
        category,
        meta,
        highlights,
    } = item;

    let card = html::div()
        .class("feed-item-card")
        .child(
            html::a()
                .href(url)
                .target("_blank")
                .rel("noopener noreferrer")
                .class("feed-title")
                .child(title),
        )
        .child(summary_view(summary))
        .child(control(category, meta, pane_id.clone(), highlights.len()))
        .child(pane(highlights, pane_id));

    html::div()
        .class("feed-item feed-item--with-highlights")
        .attr("data-highlight-id", id)
        .child(card)
}

/// The summary. Expanding lifts the two-line clamp; the original measured both heights in
/// a layout effect to animate between them, which CSS can now do with `grid-template-rows`.
fn summary_view(summary: String) -> impl IntoView {
    (!summary.is_empty()).then(|| {
        html::div()
            .class("feed-desc-wrapper")
            .child(html::span().class("feed-desc").child(summary))
    })
}

/// The metadata line, ending in the button that toggles the pane.
fn control(category: String, meta: Vec<String>, pane_id: String, count: usize) -> impl IntoView {
    let label = match count {
        1 => format!("{count} highlight"),
        _ => format!("{count} highlights"),
    };

    let button = html::button()
        .r#type("button")
        .class("feed-highlight-btn")
        .attr("aria-expanded", "false")
        .attr("aria-controls", pane_id)
        .child(label);

    html::span()
        .class("feed-meta")
        .child(meta_parts(category, meta))
        .child(separator())
        .child(button)
}

/// The collapsible pane. It is always present so CSS can transition it, where the React
/// version relied on `AnimatePresence` to animate an unmount.
fn pane(highlights: Vec<String>, pane_id: String) -> impl IntoView {
    let entries = highlights
        .into_iter()
        .enumerate()
        .map(|(index, highlight)| {
            html::li()
                // Drives the stagger that `staggerChildren` used to.
                .style(("--index", index.to_string()))
                .child(html::blockquote().inner_html(highlight))
        })
        .collect::<Vec<_>>();

    html::div()
        .id(pane_id)
        .class("feed-highlights-body")
        .child(html::ul().class("feed-highlights-list").child(entries))
}
