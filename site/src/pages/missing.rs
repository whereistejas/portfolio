//! The page served for an unknown path. Astro had no equivalent; GitHub Pages returns
//! `404.html`, which boots the app and lands here.

use leptos::prelude::*;

use crate::layout::{shell, textorlink};

pub fn view() -> impl IntoView {
    shell(
        textorlink("NOT FOUND", None),
        textorlink("GO HOME", Some("/")),
        (),
    )
}
