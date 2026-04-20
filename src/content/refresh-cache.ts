import { refreshProcessedCache } from "./readwise.ts";

const token = process.env["READWISE_TOKEN"];
if (!token) {
	console.error("[readwise] READWISE_TOKEN is required to refresh the cache");
	process.exit(1);
}

await refreshProcessedCache(token);
