//! Ported from `pages/archive.astro`.

use leptos::prelude::*;

use crate::components::feed_list::feed_list;
use crate::feed::{Item, Kind};
use crate::layout::{shell, textorlink};

pub fn view(items: Vec<Item>) -> impl IntoView {
    shell(
        textorlink("READING ARCHIVE", None),
        feed_list(Kind::Archive, items),
        (),
    )
}
