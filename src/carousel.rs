//! The photo carousel, ported from `components/carousel.astro`.
//!
//! The Astro version shipped a `<script>` that mutated a `--current-slide` custom
//! property. Here the index is a signal, and the same custom property is bound to it, so
//! the CSS transform driving the slide transition is unchanged.

use leptos::ev;
use leptos::html;
use leptos::prelude::*;

use crate::photos::{PHOTOS, Photo};

pub fn carousel() -> impl IntoView {
    let current = RwSignal::new(0usize);
    let count = PHOTOS.len();

    // Wrapping arithmetic, so the ends of the carousel join up as they did before.
    let step = move |delta: isize| {
        current.update(|slide| {
            let count = isize::try_from(count).unwrap_or(1).max(1);
            let next = (isize::try_from(*slide).unwrap_or(0) + delta).rem_euclid(count);
            *slide = usize::try_from(next).unwrap_or(0);
        });
    };

    let on_key = move |event: ev::KeyboardEvent| match event.key().as_str() {
        "ArrowLeft" => {
            event.prevent_default();
            step(-1);
        }
        "ArrowRight" => {
            event.prevent_default();
            step(1);
        }
        _ => (),
    };

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
        .style(("--current-slide", move || current.get().to_string()))
        .tabindex("0")
        .on(ev::keydown, on_key)
        .child(edge(
            "left",
            "Previous slide",
            "cursor-w-resize",
            move || step(-1),
        ))
        .child(edge("right", "Next slide", "cursor-e-resize", move || {
            step(1)
        }))
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

/// An invisible half-width click target, shown only where a pointer exists.
fn edge(
    id: &'static str,
    label: &'static str,
    cursor: &'static str,
    on_click: impl Fn() + 'static,
) -> impl IntoView {
    let side = if id == "left" { "left-0" } else { "right-0" };

    html::button()
        .id(id)
        .aria_label(label)
        .class(format!(
            "absolute {side} z-10 hidden h-[calc(100%-1lh-0.5rem)] w-1/2 {cursor} \
             border-none bg-transparent md:block md:h-[calc(100%-1lh-0.625rem)]"
        ))
        .on(ev::click, move |event: ev::MouseEvent| {
            event.prevent_default();
            on_click();
        })
}
