import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	use: {
		baseURL: "http://localhost:4321",
		screenshot: "only-on-failure",
	},
	webServer: {
		command: "bun run preview --port 4321",
		port: 4321,
		reuseExistingServer: true,
	},
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
		},
	],
});
