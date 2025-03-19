import { defineConfig } from "astro/config";

import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { remarkWikilinks } from "./src/plugins/remarkWikilinks.mjs";

export default defineConfig({
  output: "static",
  adapter: vercel(),
  integrations: [
    mdx({
      remarkPlugins: [remarkWikilinks],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
