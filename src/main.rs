use leptos::html;
use leptos::prelude::*;

fn app() -> impl IntoView {
    html::main()
        .class("flex min-h-dvh items-center justify-center bg-neutral-950 text-neutral-100")
        .child(
            html::div()
                .class("space-y-3 text-center")
                .child(
                    html::h1()
                        .class("text-4xl font-semibold tracking-tight")
                        .child("Hello, world!"),
                )
                .child(
                    html::p()
                        .class("text-sm text-neutral-400")
                        .child("Leptos + Trunk + Tailwind, with no macros in this crate."),
                ),
        )
}

fn main() {
    console_error_panic_hook::set_once();
    leptos::mount::mount_to_body(app);
}
