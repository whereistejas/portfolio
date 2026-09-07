//! The page shell, ported from `layouts/page.astro`.
//!
//! Astro filled three named slots; here the equivalent is three arguments. Everything
//! that layout used to do in `<head>` is static markup in `index.html` instead, since
//! there is only one HTML file.

use leptos::either::Either;
use leptos::html;
use leptos::prelude::*;

/// Wraps the three landmark regions. Their styling lives in `styles/tailwind.css`, keyed
/// off the element names, so no classes are needed here.
pub fn shell(
    header: impl IntoView + 'static,
    main: impl IntoView + 'static,
    footer: impl IntoView + 'static,
) -> impl IntoView {
    (
        html::header().child(header),
        html::main().child(main),
        html::footer().child(footer),
    )
}

/// A navigation label that becomes a link when given a target, ported from
/// `components/textorlink.astro`.
pub fn textorlink(content: &'static str, href: Option<&'static str>) -> impl IntoView {
    let inner = match href {
        Some(href) => Either::Left(html::a().href(href).child(content)),
        None => Either::Right(content),
    };

    html::div()
        .class("inline-block")
        .child(html::h4().child(inner))
}
