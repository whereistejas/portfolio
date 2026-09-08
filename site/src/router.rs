//! The set of routes, and the metadata the prerenderer needs for each.
//!
//! There is no runtime dispatch any more. Every route is rendered to its own HTML file at
//! build time, and the browser bundle only attaches behaviour to what is already there.
//! `leptos_router` never appears: its `Route` components can only be instantiated through
//! `view!` or by hand-building `TypedChildren`, and static routes need no matcher.

use crate::pages::blog::POSTS;

/// A page the site serves.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Route {
    Home,
    Blog,
    Inbox,
    Archive,
    Info,
    Post(&'static str),
    /// Rendered into `404.html`, which Pages serves for unknown paths.
    Missing,
}

impl Route {
    /// Every route that gets a file of its own.
    ///
    /// Posts are appended from the generated table, so adding a markdown file is enough
    /// to get a route; the fixed pages have to be listed here by hand.
    pub fn all() -> Vec<Self> {
        let fixed = [
            Self::Home,
            Self::Blog,
            Self::Inbox,
            Self::Archive,
            Self::Info,
        ];
        let posts = POSTS.iter().map(|post| Self::Post(post.slug));

        fixed.into_iter().chain(posts).collect()
    }

    /// The URL path, which is also where the file goes.
    pub fn path(self) -> String {
        match self {
            Self::Home => "/".to_owned(),
            Self::Blog => "/blog".to_owned(),
            Self::Inbox => "/inbox".to_owned(),
            Self::Archive => "/archive".to_owned(),
            Self::Info => "/info".to_owned(),
            Self::Post(slug) => format!("/posts/{slug}"),
            Self::Missing => "/404".to_owned(),
        }
    }

    /// The document title, matching the `title` prop each Astro page passed to its layout.
    pub fn title(self) -> String {
        let page = match self {
            Self::Home => return SITE.to_owned(),
            Self::Blog => "Blog",
            Self::Inbox => "Reading Inbox",
            Self::Archive => "Reading Archive",
            Self::Info => "Info",
            Self::Post(slug) => {
                return format!("{} | {SITE}", crate::pages::blog::post_title(slug));
            }
            Self::Missing => "Not Found",
        };

        format!("{page} | {SITE}")
    }
}

const SITE: &str = "Tejas Sanap";
