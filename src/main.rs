//! The browser bundle: behaviour only.
//!
//! Every page arrives fully rendered from `prerender`, so nothing here builds markup.
//! This attaches the two pieces of interactivity to the DOM that is already present —
//! the carousel's slide index and the highlight accordions — and touches nothing else.
//!
//! Consequently the bundle carries no framework: the components in `site` run at build
//! time, and what ships is the event handling they cannot express in CSS.

use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::Closure;
use web_sys::{Document, Element, Event, HtmlElement, KeyboardEvent, window};

fn main() {
    console_error_panic_hook::set_once();

    let Some(document) = window().and_then(|window| window.document()) else {
        return;
    };

    carousel(&document);
    accordions(&document);
}

/// Steps the carousel by setting `--current-slide`, which the CSS transform reads. Same
/// contract as the inline script in `carousel.astro`.
fn carousel(document: &Document) {
    let Some(root) = document.get_element_by_id("carousel") else {
        return;
    };

    let count = root
        .get_attribute("data-num-slides")
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or_default();

    if count == 0 {
        return;
    }

    let step = {
        let root = root.clone();
        move |delta: i32| {
            let Some(element) = root.dyn_ref::<HtmlElement>() else {
                return;
            };

            let current = element
                .style()
                .get_property_value("--current-slide")
                .ok()
                .and_then(|value| value.trim().parse::<i32>().ok())
                .unwrap_or_default();

            // rem_euclid so that stepping past either end wraps, as `modulo` did.
            let next = (current + delta).rem_euclid(count);
            let _ = element
                .style()
                .set_property("--current-slide", &next.to_string());
        }
    };

    for (id, delta) in [("left", -1), ("right", 1)] {
        let Some(button) = document.get_element_by_id(id) else {
            continue;
        };

        let step = step.clone();
        on(&button, "click", move |event: Event| {
            event.prevent_default();
            step(delta);
        });
    }

    on(&root, "keydown", move |event: Event| {
        let Ok(event) = event.dyn_into::<KeyboardEvent>() else {
            return;
        };

        let delta = match event.key().as_str() {
            "ArrowLeft" => -1,
            "ArrowRight" => 1,
            _ => return,
        };

        event.prevent_default();
        step(delta);
    });
}

/// Wires every highlight accordion through one delegated listener, rather than one per
/// row: the archive has 251 of them.
fn accordions(document: &Document) {
    let Some(body) = document.body() else {
        return;
    };

    on(&body, "click", move |event: Event| {
        let Some(button) = event
            .target()
            .and_then(|target| target.dyn_into::<Element>().ok())
            .and_then(|target| target.closest(".feed-highlight-btn").ok().flatten())
        else {
            return;
        };

        let open = button.get_attribute("aria-expanded").as_deref() == Some("true");
        let _ = button.set_attribute("aria-expanded", if open { "false" } else { "true" });

        // The pane the button controls, and the row that styles itself when expanded.
        let pane = button
            .get_attribute("aria-controls")
            .and_then(|id| document_of(&button).and_then(|doc| doc.get_element_by_id(&id)));
        let row = button.closest(".feed-item").ok().flatten();

        for (element, attribute) in [(pane, "data-open"), (row, "data-expanded")] {
            let Some(element) = element else {
                continue;
            };

            match open {
                true => element.remove_attribute(attribute).ok(),
                false => element.set_attribute(attribute, "true").ok(),
            };
        }
    });
}

fn document_of(element: &Element) -> Option<Document> {
    element.owner_document()
}

/// Registers a listener and leaks the closure, which is what keeps it alive for the life
/// of the page. There is nothing to unregister: these elements never unmount.
///
/// The handler takes `Event` rather than a specific type, because `Closure::new` needs a
/// concrete signature; callers wanting a subtype downcast inside.
fn on(target: &Element, event: &str, handler: impl FnMut(Event) + 'static) {
    let closure = Closure::<dyn FnMut(Event)>::new(handler);
    let _ = target.add_event_listener_with_callback(event, closure.as_ref().unchecked_ref());
    closure.forget();
}
