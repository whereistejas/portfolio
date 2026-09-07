//! Ported from `pages/blog.astro` and `layouts/blog.astro`.
//!
//! The listing metadata comes from the table `build/posts.rs` generates; post bodies are
//! fetched as pre-rendered HTML when a post is opened.

use leptos::html;
use leptos::prelude::*;

use crate::components::feed_card::Card;
use crate::layout::{shell, textorlink};

/// One entry of the generated `POSTS` table.
pub struct Post {
    pub slug: &'static str,
    pub title: &'static str,
    pub date: &'static str,
    pub summary: &'static str,
}

include!(concat!(env!("OUT_DIR"), "/posts.rs"));

pub fn view() -> impl IntoView {
    let cards = POSTS
        .iter()
        .map(|post| {
            Card {
                title: post.title.to_owned(),
                href: format!("/posts/{}", post.slug),
                summary: post.summary.to_owned(),
                category: String::new(),
                meta: vec![post.date.to_owned()],
                link_whole_card: true,
            }
            .into_view()
        })
        .collect::<Vec<_>>();

    shell(
        textorlink("BLOG", None),
        html::div().class("feed").child(cards),
        (),
    )
}

/// A single post. The heading is the title in caps, as `blog.astro` rendered it.
pub fn post_view(slug: &'static str) -> impl IntoView {
    let title = post_title(slug);
    let body = LocalResource::new(move || fetch_body(slug));

    let article = html::article()
        .class("blog-article")
        .child(move || body.get().map(|html| self::body(html.to_string())));

    shell(heading(title.to_uppercase()), article, ())
}

/// Looks a slug up in the generated table, returning the borrowed slug so that routing
/// can carry a `&'static str` rather than allocating.
pub fn find_post(slug: &str) -> Option<&'static str> {
    POSTS
        .iter()
        .find(|post| post.slug == slug)
        .map(|post| post.slug)
}

pub fn post_title(slug: &str) -> &'static str {
    POSTS
        .iter()
        .find(|post| post.slug == slug)
        .map_or("Blog", |post| post.title)
}

fn body(html: String) -> impl IntoView {
    html::div().inner_html(html)
}

/// The `fediverse:creator` tag `layouts/blog.astro` placed in the article body.
fn heading(title: String) -> impl IntoView {
    (
        html::meta()
            .name("fediverse:creator")
            .content("@whereistejas@hachyderm.io")
            .attr("hidden", true),
        textorlink_owned(title),
    )
}

/// `textorlink` takes a `&'static str`; post titles are static too, but the uppercase
/// form is computed, so this renders the same markup for an owned string.
fn textorlink_owned(content: String) -> impl IntoView {
    html::div()
        .class("inline-block")
        .child(html::h4().child(content))
}

async fn fetch_body(slug: &str) -> String {
    let url = format!("/posts/{slug}.html");

    match gloo_net::http::Request::get(&url).send().await {
        Ok(response) => response.text().await.unwrap_or_default(),
        Err(_) => String::new(),
    }
}
