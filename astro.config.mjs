import { defineConfig } from "astro/config";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import tailwindcss from "@tailwindcss/vite";

function remarkMathFrontmatter() {
	const hasMath = (node) =>
		node.type === "math" ||
		node.type === "inlineMath" ||
		(node.children ?? []).some(hasMath);

	return (tree, file) => {
		if (hasMath(tree)) file.data.astro.frontmatter.math = true;
	};
}

export default defineConfig({
	site: "https://whereistejas.xyz",
	base: "",
	output: "static",
	redirects: {
		"/inbox": "/tbr",
		"/archive": "/gazette",
	},
	markdown: {
		remarkPlugins: [remarkMath, remarkMathFrontmatter],
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
