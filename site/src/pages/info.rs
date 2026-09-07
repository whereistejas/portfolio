//! Ported from `pages/info.astro`.
//!
//! Prose written with the builder API is wordy, so the paragraphs are assembled from two
//! helpers: [`link`] for anchors and [`text`] for the runs between them.

use leptos::html;
use leptos::prelude::*;

use crate::layout::{shell, textorlink};

pub fn view() -> impl IntoView {
    let article = html::article()
        .class("blog-article")
        .child((profile(), beliefs()))
        .child((work(), university(), socials()));

    shell(textorlink("INFO", None), article, ())
}

fn profile() -> impl IntoView {
    (
        heading("Profile"),
        html::p().child((
            text(
                "My name is Tejas Sanap and this is my home on the internet. I live in \
                 London (arguably, one of the best cities in the world). Apart from \
                 software and functional programming, I'm also an amateur street \
                 photographer. I am an avid reader and am currently reading ",
            ),
            html::span().class("text-nowrap italic").child(ulink(
                "https://www.goodreads.com/book/show/7601847-green-mars",
                "Green Mars",
            )),
            text(" by Kim Stanley Robinson."),
        )),
    )
}

fn beliefs() -> impl IntoView {
    (
        heading("Beliefs"),
        html::p().child(text(
            "We are here to make the world a better place either by: solving new \
             problems or improving existing solutions.",
        )),
        html::p().child(text(
            "Most problems can only be solved if there is enough justification for \
             someone to invest in them. The likelihood of investment can be understood \
             in terms of \"difficulty of solving\" and \"benefits from solving\".",
        )),
        html::p().child(text(
            "We can justify solving problems with no clear solutions if there are \
             enough benefits. We can also justify solving problems with little benefits \
             because of how easy they are to solve. We can describe these two categories \
             as the investor's comfort zone. However, our society has evolved to \
             disincentivize investment in problems outside this comfort zone.",
        )),
        html::p().child((
            text("Somewhere in our single-minded pursuit of \"sexy\" problems to create infinite "),
            ulink(
                "https://openai.com/index/planning-for-agi-and-beyond/",
                "abundance",
            ),
            text(" or move back to being "),
            ulink(
                "https://en.wikipedia.org/wiki/Degrowth",
                "hunter-gatherer tribes",
            ),
            text(
                ", we have forgotten that for most people the experience of living \
                 through their routine lives is far from optimal and must be improved.",
            ),
        )),
        html::p().child((
            text(
                "The problems outside the comfort zone are often \"not sexy\", they \
                 won't 10x the GDP nor will they create a future so abundant that none \
                 of us will have to work or worry again. We need to start thinking about \
                 these problems in terms of improving the human experience (HX). We can ",
            ),
            link(
                "https://www.nngroup.com/articles/what-is-user-experience/",
                "define",
            ),
            text(
                " HX as the holistic relationship \u{2014} encompassing aspirations, \
                 struggles and successes \u{2014} between a person and their lived life.",
            ),
        )),
        html::p().child(text(
            "Some examples of good HX would be accessible healthcare, cheap credit, \
             reliable public transport, shorter commute times, simplified governmental \
             services, clean air and water, access to green spaces.",
        )),
        html::p().child((
            text("If this resonates with you, feel free to reach out at "),
            ulink("mailto:email@whereistejas.xyz", "email@whereistejas.xyz"),
            text(
                " \u{2014} especially if you're building in a mid-sized, \
                 revenue-generating company.",
            ),
        )),
    )
}

fn work() -> impl IntoView {
    (
        heading("Work"),
        html::p().child((
            link("https://cwan.com", "CWAN"),
            text(", 2026 \u{2014} Present"),
            html::br(),
            link("https://tably.com", "Tably"),
            text(", 2021 \u{2014} 2026"),
            html::br(),
            link("https://wipro.com", "Wipro"),
            text(", 2019 \u{2014} 2021"),
        )),
    )
}

fn university() -> impl IntoView {
    (
        heading("University"),
        html::p().child((
            text("Bachelors in Mechanical Engineering, "),
            link("https://www.unipune.ac.in", "SPPU"),
            text(", 2016 \u{2014} 2019"),
        )),
    )
}

fn socials() -> impl IntoView {
    let links = SOCIALS
        .iter()
        .enumerate()
        .map(|(index, (href, label))| ((index > 0).then(|| text(", ")), link(href, label)))
        .collect::<Vec<_>>();

    (heading("Socials"), html::p().child(links))
}

fn heading(title: &'static str) -> impl IntoView {
    html::h3().child(title)
}

fn link(href: &'static str, label: &'static str) -> impl IntoView {
    html::a().href(href).child(label)
}

/// The underlined variant. Two helpers rather than one taking a class, so neither has to
/// name the builder's concrete type or erase it with `into_any`.
fn ulink(href: &'static str, label: &'static str) -> impl IntoView {
    html::a().href(href).class("underline").child(label)
}

fn text(content: &'static str) -> &'static str {
    content
}

const SOCIALS: [(&str, &str); 8] = [
    ("https://www.github.com/whereistejas", "Github"),
    ("https://www.goodreads.com/whereistejas", "Goodreads"),
    ("https://www.are.na/whereistejas", "Are.na"),
    ("https://www.x.com/whereistejas", "X"),
    (
        "https://bsky.app/profile/whereistejas.bsky.social",
        "Bluesky",
    ),
    ("https://hachyderm.io/@whereistejas", "Mastodon"),
    ("https://www.instagram.com/whereistejas", "Instagram"),
    ("https://www.linkedin.com/in/whereistejas", "Linkedin"),
];
