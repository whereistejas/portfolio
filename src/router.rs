//! Picks the page to render from the current URL.
//!
//! Astro produced one HTML file per page. Trunk produces exactly one, so `emit-routes.sh`
//! copies it to every route directory after the build and the app reads the path back at
//! startup. Navigation is therefore a normal document load, as it was in Astro; the wasm
//! comes from cache on subsequent pages.
//!
//! This is a placeholder for real prerendering. Once `SsrMode::Static` generates a file
//! per route, each of those files carries its own markup and this dispatch stays as the
//! hydration entry point.

use leptos::prelude::*;

use crate::pages;

/// The set of routes the site serves.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Route {
    Home,
    Blog,
    Inbox,
    Archive,
    Info,
    Post(&'static str),
    Missing,
}

impl Route {
    /// Matches a pathname, tolerating both `/blog` and `/blog/`.
    pub fn from_path(path: &str) -> Self {
        let trimmed = path.trim_matches('/');

        match trimmed {
            "" => Self::Home,
            "blog" => Self::Blog,
            "inbox" => Self::Inbox,
            "archive" => Self::Archive,
            "info" => Self::Info,
            _ => match trimmed.strip_prefix("posts/") {
                Some(slug) => pages::blog::find_post(slug).map_or(Self::Missing, Self::Post),
                None => Self::Missing,
            },
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
            Self::Post(slug) => return format!("{} | {SITE}", pages::blog::post_title(slug)),
            Self::Missing => "Not Found",
        };

        format!("{page} | {SITE}")
    }
}

/// Renders the page for the current location and sets the document title to match.
pub fn view() -> impl IntoView {
    let route = current();
    document().set_title(&route.title());

    match route {
        Route::Home => pages::home::view().into_any(),
        Route::Blog => pages::blog::view().into_any(),
        Route::Inbox => pages::inbox::view().into_any(),
        Route::Archive => pages::archive::view().into_any(),
        Route::Info => pages::info::view().into_any(),
        Route::Post(slug) => pages::blog::post_view(slug).into_any(),
        Route::Missing => pages::missing::view().into_any(),
    }
}

fn current() -> Route {
    Route::from_path(&window().location().pathname().unwrap_or_default())
}

const SITE: &str = "Tejas Sanap";
