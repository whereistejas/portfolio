mod carousel;
mod components;
mod feed;
mod layout;
mod pages;
mod photos;
mod router;

fn main() {
    console_error_panic_hook::set_once();
    leptos::mount::mount_to_body(router::view);
}
