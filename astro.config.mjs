import { defineConfig } from "astro/config";

import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://whereistejas.xyz",
  base: "",
  output: "static",
  adapter: vercel(),
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
});
