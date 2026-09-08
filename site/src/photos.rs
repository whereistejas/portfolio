//! The carousel slide table, produced by `build.rs` from `assets/*.jpg`.

/// One carousel slide: two pre-resized JPEGs and the caption read from IPTC metadata.
pub struct Photo {
    pub small: &'static str,
    pub large: &'static str,
    pub caption: &'static str,
}

include!(concat!(env!("OUT_DIR"), "/photos.rs"));
