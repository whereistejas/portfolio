//! Static preview server that mimics GitHub Pages semantics, so what you see locally
//! matches what gets deployed. Deliberately dumber than `trunk serve`: no autoreload, no
//! SPA fallback, no directory listings.
//!
//! Behaviours copied from Pages:
//!
//! - an exact file match wins
//! - `/foo` redirects to `/foo/` (301) when `foo/index.html` exists
//! - `/foo/` serves `foo/index.html`
//! - anything else serves `404.html` with a real 404 status, or a plain 404 if absent
//! - gzip for compressible types, never brotli, because Pages does not serve brotli

use std::error::Error;
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use axum::Router;
use axum::body::Body;
use axum::http::header::{
    ACCEPT_ENCODING, CACHE_CONTROL, CONTENT_ENCODING, CONTENT_TYPE, LOCATION, VARY,
};
use axum::http::{HeaderMap, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use flate2::Compression;
use flate2::write::GzEncoder;
use mime_guess::Mime;
use mime_guess::mime::TEXT;
use percent_encoding::percent_decode_str;
use tokio::net::TcpListener;
use tokio::runtime::Builder;

fn main() -> Result<(), Box<dyn Error>> {
    Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(serve())
}

async fn serve() -> Result<(), Box<dyn Error>> {
    let port = std::env::var("PORT")
        .ok()
        .and_then(|port| port.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    let listener = TcpListener::bind(("127.0.0.1", port)).await?;
    println!("GitHub Pages preview: http://localhost:{port}/");

    axum::serve(listener, Router::new().fallback(handle)).await?;
    Ok(())
}

/// Resolves one request against `dist/`, applying the Pages rules documented above.
async fn handle(uri: Uri, headers: HeaderMap) -> Response {
    let path = uri.path();
    let Some(relative) = resolve(path) else {
        return (StatusCode::BAD_REQUEST, "400 Bad Request").into_response();
    };

    // A trailing slash addresses a directory, which only ever resolves to its index.
    if path.ends_with('/') {
        return match read(&relative.join("index.html"), &headers).await {
            Some(response) => response,
            None => not_found().await,
        };
    }

    if let Some(response) = read(&relative, &headers).await {
        return response;
    }

    if Path::new(DIST).join(&relative).join("index.html").is_file() {
        return Response::builder()
            .status(StatusCode::MOVED_PERMANENTLY)
            .header(LOCATION, format!("{path}/"))
            .body(Body::empty())
            .map_or_else(
                |_| StatusCode::INTERNAL_SERVER_ERROR.into_response(),
                Response::from,
            );
    }

    not_found().await
}

/// Reads a file under `dist/`, returning `None` when it is missing or is a directory.
async fn read(relative: &Path, headers: &HeaderMap) -> Option<Response> {
    let bytes = tokio::fs::read(Path::new(DIST).join(relative)).await.ok()?;
    let mime = mime_guess::from_path(relative).first_or_octet_stream();

    let content_type = match mime.type_() {
        TEXT => format!("{mime}; charset=utf-8"),
        _ => mime.to_string(),
    };

    let builder = Response::builder()
        .header(CONTENT_TYPE, content_type)
        // Pages sets a short cache on user content; mirror it so caching bugs surface here.
        .header(CACHE_CONTROL, "max-age=600");

    let response = match accepts_gzip(headers) && compressible(&mime) {
        true => builder
            .header(CONTENT_ENCODING, "gzip")
            .header(VARY, "accept-encoding")
            .body(Body::from(gzip(&bytes))),
        false => builder.body(Body::from(bytes)),
    };

    Some(response.map_or_else(
        |_| StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        Response::from,
    ))
}

async fn not_found() -> Response {
    match tokio::fs::read(Path::new(DIST).join("404.html")).await {
        Ok(bytes) => (
            StatusCode::NOT_FOUND,
            [(CONTENT_TYPE, "text/html; charset=utf-8")],
            bytes,
        )
            .into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "404 Not Found").into_response(),
    }
}

/// Turns a request path into a relative path under `dist/`, rejecting anything that is not
/// a plain sequence of names so that `..` and absolute paths cannot escape the directory.
fn resolve(path: &str) -> Option<PathBuf> {
    let decoded = percent_decode_str(path.trim_start_matches('/'))
        .decode_utf8()
        .ok()?;
    let candidate = Path::new(decoded.as_ref());

    candidate
        .components()
        .all(|component| matches!(component, Component::Normal(_)))
        .then(|| candidate.to_path_buf())
}

fn accepts_gzip(headers: &HeaderMap) -> bool {
    headers
        .get(ACCEPT_ENCODING)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.contains("gzip"))
}

fn compressible(mime: &Mime) -> bool {
    mime.type_() == TEXT || COMPRESSIBLE.contains(&mime.essence_str())
}

fn gzip(bytes: &[u8]) -> Vec<u8> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());

    // The sink is a `Vec`, which never fails to accept a write, so neither call can error.
    encoder
        .write_all(bytes)
        .expect("writing gzip into a Vec cannot fail");
    encoder
        .finish()
        .expect("finishing gzip into a Vec cannot fail")
}

const DIST: &str = "dist";
const DEFAULT_PORT: u16 = 4321;
const COMPRESSIBLE: [&str; 5] = [
    "application/javascript",
    "application/json",
    "application/wasm",
    "application/xml",
    "image/svg+xml",
];
