mod carousel;
mod layout;
mod photos;

use leptos::prelude::*;

use crate::carousel::carousel;
use crate::layout::{shell, textorlink};

fn main() {
    console_error_panic_hook::set_once();
    leptos::mount::mount_to_body(home);
}

/// The landing page, ported from `pages/index.astro`.
fn home() -> impl IntoView {
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
