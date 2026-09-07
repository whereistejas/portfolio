//! Markdown rendering, replacing the `unified()` pipeline in `lib/feed.ts` and the
//! `remark`/`rehype` plugins configured in `astro.config.mjs`.

use pulldown_cmark::{Options, Parser, html};
use pulldown_latex::{RenderConfig, Storage, mathml};

/// Renders markdown to HTML with the GFM extensions `remark-gfm` provided, then converts
/// any `$...$` spans to MathML.
///
/// The Astro site loaded KaTeX's stylesheet from a CDN and rendered maths into its own
/// markup. MathML needs no stylesheet and no JavaScript, so that `<link>` is gone.
pub fn to_html(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_SMART_PUNCTUATION);
    options.insert(Options::ENABLE_MATH);

    let mut rendered = String::new();
    html::push_html(&mut rendered, MathEvents::new(Parser::new_ext(markdown, options)));
    rendered
}

/// Strips markup to leave readable text, replacing `markdownToPlainText`.
pub fn to_plain_text(markdown: &str) -> String {
    let html = to_html(markdown);
    let mut text = String::with_capacity(html.len());
    let mut depth = 0usize;

    for character in html.chars() {
        match character {
            '<' => depth += 1,
            '>' => depth = depth.saturating_sub(1),
            _ if depth == 0 => text.push(character),
            _ => (),
        }
    }

    decode_entities(&text).split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Rewrites `pulldown-cmark`'s math events into MathML, passing everything else through.
struct MathEvents<'a, I> {
    inner: I,
    storage: Storage,
    marker: std::marker::PhantomData<&'a ()>,
}

impl<'a, I> MathEvents<'a, I> {
    fn new(inner: I) -> Self {
        Self {
            inner,
            storage: Storage::new(),
            marker: std::marker::PhantomData,
        }
    }
}

impl<'a, I> Iterator for MathEvents<'a, I>
where
    I: Iterator<Item = pulldown_cmark::Event<'a>>,
{
    type Item = pulldown_cmark::Event<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        use pulldown_cmark::{CowStr, Event};

        let (latex, display) = match self.inner.next()? {
            Event::InlineMath(latex) => (latex, false),
            Event::DisplayMath(latex) => (latex, true),
            other => return Some(other),
        };

        let config = RenderConfig {
            display_mode: match display {
                true => pulldown_latex::config::DisplayMode::Block,
                false => pulldown_latex::config::DisplayMode::Inline,
            },
            ..RenderConfig::default()
        };

        let parser = pulldown_latex::Parser::new(&latex, &self.storage);
        let mut rendered = String::new();

        // Fall back to the literal source when the maths cannot be parsed, which is what
        // a reader would rather see than nothing.
        match mathml::push_mathml(&mut rendered, parser, config) {
            Ok(()) => Some(Event::InlineHtml(CowStr::from(rendered))),
            Err(_) => Some(Event::Text(latex)),
        }
    }
}

/// Undoes the entity escaping the HTML renderer applies, for the plain-text path only.
fn decode_entities(text: &str) -> String {
    text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}
