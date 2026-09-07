//! The photo carousel, ported from `components/carousel.astro`.
//!
//! The markup is static: `--current-slide` starts at 0 and the behaviour layer in the
//! browser bundle mutates it, exactly as the `<script>` in `carousel.astro` did. Holding
//! the index in a signal here would be pointless, because this only ever runs at build
//! time.

use leptos::html;
use leptos::prelude::*;

use crate::photos::{PHOTOS, Photo};

pub fn carousel() -> impl IntoView {
    let count = PHOTOS.len();

    let slides = PHOTOS
        .iter()
        .enumerate()
        .map(|(index, photo)| slide(index, photo, count))
        .collect::<Vec<_>>();

    html::div()
        .id("carousel")
        .class(
            "relative flex h-full w-full max-w-full flex-col items-center gap-2 \
             select-none md:w-48",
        )
        .style(("--current-slide", "0"))
        // Read back by the behaviour layer, which owns the slide index at runtime.
        .attr("data-num-slides", count.to_string())
        .tabindex("0")
        .child(edge("left", "Previous slide", "cursor-w-resize"))
        .child(edge("right", "Next slide", "cursor-e-resize"))
        .child(
            html::div()
                .class(
                    "flex h-full w-full snap-x snap-mandatory items-center \
                     overflow-scroll scroll-smooth",
                )
                .child(slides),
        )
}

/// One slide. `order` is set as an inline style rather than an `order-*` utility, because
/// Tailwind only emits classes it can find as literal strings in the sources.
fn slide(index: usize, photo: &'static Photo, count: usize) -> impl IntoView {
    let first = index == 0;

    html::div()
        .class(
            "flex shrink-0 grow-0 flex-col items-center justify-center gap-1 \
             md:gap-1.25 scroll-snap h-full w-full \
             translate-x-[calc(-100%*var(--current-slide))] snap-center \
             bg-neutral-50 transition-transform duration-500 dark:bg-neutral-900",
        )
        .style(("order", index.to_string()))
        .child(
            html::img()
                .class("mix-blend-multiply dark:mix-blend-normal")
                .src(photo.large)
                .srcset(format!("{} 400w, {} 800w", photo.small, photo.large))
                .sizes("(max-width: 400px) 400px, (max-width: 800px) 800px")
                .alt(photo.caption)
                .loading(if first { "eager" } else { "lazy" })
                .decoding(if first { "sync" } else { "async" })
                .fetchpriority(if first { "high" } else { "auto" }),
        )
        .child(
            html::div()
                .class("flex h-lh w-full justify-between")
                .child(html::span().child(photo.caption))
                .child(html::span().child(format!("{}/{count}", index + 1))),
        )
}

/// An invisible half-width click target, shown only where a pointer exists. The click
/// handler is attached by the browser bundle, which finds these by id.
fn edge(id: &'static str, label: &'static str, cursor: &'static str) -> impl IntoView {
    let side = if id == "left" { "left-0" } else { "right-0" };

    html::button().id(id).aria_label(label).class(format!(
        "absolute {side} z-10 hidden h-[calc(100%-1lh-0.5rem)] w-1/2 {cursor} \
             border-none bg-transparent md:block md:h-[calc(100%-1lh-0.625rem)]"
    ))
}
