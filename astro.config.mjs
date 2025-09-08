import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

export default defineConfig({
	site: 'https://whereistejas.xyz',
	base: '',
	output: 'static',
	markdown: {
		remarkRehype: {
			footnoteLabel: ' ',
			footnoteLabelTagName: 'hr',
			footnoteLabelProperties: { className: [''] },
		},
		remarkPlugins: [remarkMath],
		rehypePlugins: [rehypeKatex],
	},
	vite: {
		plugins: [tailwindcss()],
	},
	experimental: {
		headingIdCompat: true,
	},
})
