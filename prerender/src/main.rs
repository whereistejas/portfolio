//! Renders every route to a complete HTML file, so that crawlers, link-preview bots and
//! readers without JavaScript get the real page.
//!
//! Runs after `trunk build`, taking the HTML Trunk produced as the shell: it already has
//! the hashed stylesheet and the module script that boots the bundle. This fills in the
//! body and writes one file per route, replacing `scripts/emit-routes.sh`.
//!
//! `feed.json` stays the source of truth for the reading lists. It is read here rather
//! than embedded in the binary, and the browser no longer fetches it.

use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

use leptos::prelude::*;
use site::feed::{Item, Kind};
use site::router::Route;

fn main() -> Result<(), Box<dyn Error>> {
    // Trunk builds into a staging directory and only moves it to `dist/` once the whole
    // pipeline succeeds, so a post_build hook has to be told where to look.
    let dist = std::env::var("TRUNK_STAGING_DIR")
        .ok()
        .or_else(|| std::env::args().nth(1))
        .map_or_else(|| PathBuf::from(DIST), PathBuf::from);

    let shell = fs::read_to_string(dist.join("index.html"))?;
    let feed = Feed::read(Path::new(FEED))?;

    for route in Route::all() {
        let page = render(route, &feed);
        write(&dist, &destination(route), &shell, route, &page)?;
    }

    // Pages serves 404.html for unknown paths, with a 404 status.
    let missing = render(Route::Missing, &feed);
    write(
        &dist,
        Path::new("404.html"),
        &shell,
        Route::Missing,
        &missing,
    )?;

    println!(
        "prerendered {} routes into {}",
        Route::all().len(),
        dist.display()
    );
    Ok(())
}

/// The two reading lists, as stored in `feed.json`.
#[derive(serde::Deserialize)]
struct Feed {
    inbox: Vec<Item>,
    archive: Vec<Item>,
}

impl Feed {
    fn read(path: &Path) -> Result<Self, Box<dyn Error>> {
        Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
    }

    fn list(&self, kind: Kind) -> Vec<Item> {
        match kind {
            Kind::Inbox => self.inbox.clone(),
            Kind::Archive => self.archive.clone(),
        }
    }
}

/// Renders one route's body markup.
///
/// Each call runs inside its own reactive owner. Without one, the signals the interactive
/// components create would outlive the render and leak between routes.
fn render(route: Route, feed: &Feed) -> String {
    let owner = Owner::new();

    owner.with(|| match route {
        Route::Home => site::pages::home::view().to_html(),
        Route::Blog => site::pages::blog::view().to_html(),
        Route::Inbox => site::pages::inbox::view(feed.list(Kind::Inbox)).to_html(),
        Route::Archive => site::pages::archive::view(feed.list(Kind::Archive)).to_html(),
        Route::Info => site::pages::info::view().to_html(),
        Route::Post(slug) => site::pages::blog::post_view(slug).to_html(),
        Route::Missing => site::pages::missing::view().to_html(),
    })
}

/// Substitutes the rendered body and title into Trunk's shell.
fn write(
    dist: &Path,
    destination: &Path,
    shell: &str,
    route: Route,
    body: &str,
) -> Result<(), Box<dyn Error>> {
    let html = shell
        .replace(
            TITLE_MARKER,
            &format!("<title>{}</title>", escape(&route.title())),
        )
        .replace(BODY_MARKER, &format!("{BODY_MARKER}\n{body}"));

    let path = dist.join(destination);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(path, html)?;
    Ok(())
}

/// Where a route's file goes. Nested routes become `<path>/index.html`, so that Pages
/// serves them without rewrites.
fn destination(route: Route) -> PathBuf {
    match route.path().trim_matches('/') {
        "" => PathBuf::from("index.html"),
        path => Path::new(path).join("index.html"),
    }
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

const DIST: &str = "dist";
/// Written by `site`'s build script; not part of the served output.
const FEED: &str = "generated/feed.json";
/// The placeholder `index.html` carries in place of a title.
const TITLE_MARKER: &str = "<title>Tejas Sanap</title>";
/// The comment marking where the body content belongs.
const BODY_MARKER: &str = "<!-- prerender -->";
