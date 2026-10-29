/**
 * One-off: saves every Readwise inbox item (`location: "new"` in the frozen
 * Readwise cache) to the Matter queue, so the inbox lives in Matter alone.
 *
 * Dry run by default; pass `--apply` to save. URLs already anywhere in the
 * Matter library are skipped, so the script is safe to re-run.
 *
 *   bun src/content/migrate-inbox-to-matter.ts [--apply]
 */
import { z } from "astro/zod";

import { MatterClient } from "./matter.ts";
import { normalizeUrlForJoin, READWISE_FROZEN_PATH } from "./utils.ts";

// Documents uploaded to Readwise are served from behind a Readwise login, so
// Matter cannot fetch them.
const READWISE_UPLOAD =
	/^https:\/\/readwise\.io\/reader\/document_raw_content\//;

const apply = process.argv.includes("--apply");

const token = process.env["MATTER_TOKEN"];
if (!token) {
	console.error("[migrate] MATTER_TOKEN is required");
	process.exit(1);
}

// Only the fields needed here, so items the site's loader rejects (one has a
// null summary) still migrate.
const inboxItemSchema = z.object({
	title: z.string(),
	url: z.string(),
	location: z.string(),
});
type InboxItem = z.infer<typeof inboxItemSchema>;

const frozen = inboxItemSchema
	.array()
	.parse(await Bun.file(READWISE_FROZEN_PATH).json());

const inbox = new Map<string, InboxItem>();
for (const item of frozen) {
	if (item.location !== "new") continue;
	const key = normalizeUrlForJoin(item.url);
	if (!inbox.has(key)) inbox.set(key, item);
}

const client = new MatterClient(token);
await client.checkAccess();

const library = await client.listItems("all");
const inMatter = new Set(library.map((item) => normalizeUrlForJoin(item.url)));

const uploads: InboxItem[] = [];
const present: InboxItem[] = [];
const toSave: InboxItem[] = [];
for (const [key, item] of inbox) {
	if (READWISE_UPLOAD.test(item.url)) uploads.push(item);
	else if (inMatter.has(key)) present.push(item);
	else toSave.push(item);
}

console.log(
	`[migrate] ${inbox.size} Readwise inbox items; Matter library has ${library.length} items`
);
console.log(`[migrate] ${present.length} already in Matter, skipped`);
console.log(
	`[migrate] ${uploads.length} are Readwise uploads Matter cannot fetch, skipped:`
);
for (const item of uploads) console.log(`  - ${item.title} (${item.url})`);
console.log(`[migrate] ${toSave.length} to save to the Matter queue:`);
for (const item of toSave) console.log(`  - ${item.title} (${item.url})`);

if (!apply) {
	console.log("[migrate] dry run; pass --apply to save");
	process.exit(0);
}

const failures: { item: InboxItem; error: string }[] = [];
for (const [index, item] of toSave.entries()) {
	const progress = `${index + 1}/${toSave.length}`;
	try {
		const id = await client.saveToQueue(item.url);
		console.log(`[migrate] ${progress} saved ${id} ${item.url}`);
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		failures.push({ item, error });
		console.log(`[migrate] ${progress} FAILED ${item.url}: ${error}`);
	}
}

console.log(
	`[migrate] saved ${toSave.length - failures.length}, failed ${failures.length}`
);
for (const { item, error } of failures) {
	console.log(`  - ${item.url}: ${error}`);
}
process.exit(failures.length === 0 ? 0 : 1);
