//! The site's views, shared by the prerenderer and the browser bundle.
//!
//! This is a library rather than part of the binary so it can be compiled twice: once
//! for the host with `leptos/ssr`, where `prerender` turns each route into HTML, and
//! once for wasm. The feature is chosen by whichever binary depends on it, never here.

pub mod carousel;
pub mod components;
pub mod feed;
pub mod layout;
pub mod pages;
pub mod photos;
pub mod router;
