//! Ported from `pages/index.astro`.

use leptos::prelude::*;

use crate::carousel::carousel;
use crate::layout::{shell, textorlink};

pub fn view() -> impl IntoView {
    shell(
        (
            textorlink("INBOX", Some("/inbox")),
            textorlink("BLOG", Some("/blog")),
        ),
        carousel(),
        (
            textorlink("ARCHIVE", Some("/archive")),
            textorlink("INFO", Some("/info")),
        ),
    )
}
