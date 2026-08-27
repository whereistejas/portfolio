import { unified } from "unified";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";

const markdownProcessor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype)
	.use(rehypeStringify);

export async function renderHighlightsHtml(
	items: { readwise_id: string; highlights: string[] }[]
): Promise<Map<string, string[]>> {
	const byId = new Map<string, string[]>();
	for (const entry of items) {
		if (entry.highlights.length === 0) continue;
		const html = await Promise.all(
			entry.highlights.map(async (highlight) =>
				String(await markdownProcessor.process(highlight))
			)
		);
		byId.set(entry.readwise_id, html);
	}
	return byId;
}

const HTML_TAG = /<[^>]*>/g;
const HTML_ENTITY = /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g;
const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

function decodeEntity(
	match: string,
	dec: string | undefined,
	hex: string | undefined,
	name: string | undefined
): string {
	if (dec) return String.fromCodePoint(Number(dec));
	if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
	if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? match;
	return match;
}

export async function markdownToPlainText(markdown: string): Promise<string> {
	if (!markdown.trim()) return "";
	const html = String(await markdownProcessor.process(markdown));
	return html
		.replace(HTML_TAG, "")
		.replace(HTML_ENTITY, decodeEntity)
		.replace(/\s+/g, " ")
		.trim();
}

export function parseAuthors(raw: string): string[] {
	return [
		...new Set(
			raw
				.split(/\s*[,&]\s*/)
				.map((a) => a.trim())
				.filter(
					(a) =>
						a &&
						a.toLowerCase() !== "unknown" &&
						!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(a)
				)
		),
	];
}

export function displayCategory(category: string): string {
	return category === "epub" ? "book" : category;
}
