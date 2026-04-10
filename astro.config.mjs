import { defineConfig } from "astro/config";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	site: "https://whereistejas.xyz",
	base: "",
	output: "static",
	integrations: [react()],
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
		resolve: {
			dedupe: ["react", "react-dom"],
		},
		optimizeDeps: {
			exclude: ["framer-motion"],
		},
	},
	compressHTML: true,
});
