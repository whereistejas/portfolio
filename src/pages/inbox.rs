//! Ported from `pages/inbox.astro`.

use leptos::prelude::*;

use crate::components::feed_list::feed_list;
use crate::feed::Kind;
use crate::layout::{shell, textorlink};

pub fn view() -> impl IntoView {
    shell(
        textorlink("READING INBOX", None),
        feed_list(Kind::Inbox),
        (),
    )
}
