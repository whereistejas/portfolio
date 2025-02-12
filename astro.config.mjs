import { defineConfig } from "astro/config";

import vercel from "@astrojs/vercel/static";
import mdx from "@astrojs/mdx";

export default defineConfig({
  output: "static",
  adapter: vercel(),
  integrations: [mdx()],
});
