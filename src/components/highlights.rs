//! Ported from `components/HighlightsAccordion.tsx`.
//!
//! The original drove three animations through framer-motion: the pane's height, a
//! staggered fade of each highlight, and the summary growing from its two-line clamp.
//! All three are CSS here, keyed off `data-open` and `data-expanded`, so no animation
//! runtime ships. See the `feed-highlights-*` rules in `styles/tailwind.css`.
//!
//! The React version climbed the DOM with `closest(".feed-item")` to mark the expanded
//! row. This owns that element, so the attribute is bound directly instead.
//!
//! Every helper takes owned data. Borrowing would tie the returned `impl IntoView` to
//! that borrow under edition 2024's lifetime capture rules, and the views have to outlive
//! the resource guard the items were read from.

use leptos::html;
use leptos::prelude::*;

use crate::components::feed_card::{meta_parts, separator};
use crate::feed::Item;

/// A feed row whose highlights can be expanded.
pub fn view(item: Item, prefix: &str) -> impl IntoView {
    let pane_id = format!("{prefix}-highlights-{}", item.id);
    let open = RwSignal::new(false);

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
        .child(summary_view(summary, open))
        .child(control(
            category,
            meta,
            pane_id.clone(),
            highlights.len(),
            open,
        ))
        .child(pane(highlights, pane_id, open));

    html::div()
        .class("feed-item feed-item--with-highlights")
        .attr("data-highlight-id", id)
        .attr("data-expanded", move || open.get().then_some("true"))
        .child(card)
}

/// The summary. Expanding lifts the two-line clamp; the original measured both heights in
/// a layout effect to animate between them, which CSS can now do with `grid-template-rows`.
fn summary_view(summary: String, open: RwSignal<bool>) -> impl IntoView {
    (!summary.is_empty()).then(|| {
        html::div()
            .class("feed-desc-wrapper")
            .attr("data-open", move || open.get().then_some("true"))
            .child(html::span().class("feed-desc").child(summary))
    })
}

/// The metadata line, ending in the button that toggles the pane.
fn control(
    category: String,
    meta: Vec<String>,
    pane_id: String,
    count: usize,
    open: RwSignal<bool>,
) -> impl IntoView {
    let label = match count {
        1 => format!("{count} highlight"),
        _ => format!("{count} highlights"),
    };

    let button = html::button()
        .r#type("button")
        .class("feed-highlight-btn")
        .attr("aria-expanded", move || open.get().to_string())
        .attr("aria-controls", pane_id)
        .on(leptos::ev::click, move |_| {
            open.update(|state| *state = !*state)
        })
        .child(label);

    html::span()
        .class("feed-meta")
        .child(meta_parts(category, meta))
        .child(separator())
        .child(button)
}

/// The collapsible pane. It stays mounted so CSS can transition it, where the React
/// version relied on `AnimatePresence` to animate an unmount.
fn pane(highlights: Vec<String>, pane_id: String, open: RwSignal<bool>) -> impl IntoView {
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
        .attr("data-open", move || open.get().then_some("true"))
        .child(html::ul().class("feed-highlights-list").child(entries))
}
