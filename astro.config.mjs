import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: 'https://whereistejas.xyz',
  base: 'portfolio',

  integrations: [tailwind()]
})