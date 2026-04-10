import { defineConfig } from "astro/config";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	site: "https://whereistejas.xyz",
	base: "",
	output: "static",
	markdown: {
		remarkPlugins: [remarkMath],
		rehypePlugins: [rehypeKatex],
		remarkRehype: {
			footnoteLabel: " ",
			footnoteLabelTagName: "hr",
			footnoteLabelProperties: { className: [""] },
		},
	},
	vite: {
		plugins: [tailwindcss()],
		build: {
			cssMinify: "lightningcss",
		},
	},
	compressHTML: true,
});
