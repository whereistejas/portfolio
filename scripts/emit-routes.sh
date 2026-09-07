#!/bin/sh
# Fans the single HTML file Trunk builds out to one file per route.
#
# GitHub Pages has no rewrite rules, so /inbox only works if dist/inbox/index.html
# exists. 404.html gets the same shell, which lets an unknown path still boot the app
# and render its own not-found page (Pages returns a 404 status with it, which is
# correct).
set -eu

dist="${TRUNK_STAGING_DIR:-dist}"

for route in blog inbox archive info; do
	mkdir -p "$dist/$route"
	cp "$dist/index.html" "$dist/$route/index.html"
done

# Blog posts live one level down, so each needs its own directory too.
for slug in $(cat "$dist/post-slugs.txt" 2>/dev/null || true); do
	mkdir -p "$dist/posts/$slug"
	cp "$dist/index.html" "$dist/posts/$slug/index.html"
done

cp "$dist/index.html" "$dist/404.html"
