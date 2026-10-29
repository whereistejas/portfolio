import { refreshProcessedCache } from "./readwise.ts";

const token = process.env["MATTER_TOKEN"];
if (!token) {
	console.error("[matter] MATTER_TOKEN is required to refresh the cache");
	process.exit(1);
}

await refreshProcessedCache(token);
