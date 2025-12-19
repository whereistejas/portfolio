import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	site: "https://whereistejas.xyz",
	base: "",
	output: "static",
	markdown: {
		remarkRehype: {
			footnoteLabel: " ",
			footnoteLabelTagName: "hr",
			footnoteLabelProperties: { className: [""] },
		},
	},
	vite: {
		plugins: [tailwindcss()],
	},
	experimental: {
		headingIdCompat: true,
	},
});
