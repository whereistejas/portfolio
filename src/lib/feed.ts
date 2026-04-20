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
