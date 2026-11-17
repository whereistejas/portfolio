import type { GazetteItem } from "./gazette";

export const GLANCE_HEADING = "This Week at a Glance";

interface Font {
	size: number;
	line: number;
	char: number;
}

const COLUMN = 976;
const GAP = 24;
const PULL_MAX = 640;
const META = 20;
const STACK_GAP = 4;
const LEAD_GAP = 8;
const RULE = 1;

const BODY: Font = { size: 16, line: 24.8, char: 0.46 };
const HEADLINE: Font = { size: 24, line: 28.8, char: 0.47 };
const LEAD_HEADLINE: Font = { size: 60, line: 63, char: 0.45 };
const PULL: Font = { size: 24, line: 28.8, char: 0.55 };

function lines(text: string, font: Font, width: number): number {
	const perLine = Math.floor(width / (font.size * font.char));
	let count = 0;
	let used = 0;
	for (const word of text.split(/\s+/).filter(Boolean)) {
		if (count > 0 && used + 1 + word.length <= perLine) {
			used += 1 + word.length;
		} else {
			count++;
			used = word.length;
		}
	}
	return count;
}

function block(text: string, font: Font, width: number, clamp = Infinity) {
	return Math.min(clamp, lines(text, font, width)) * font.line;
}

function stack(parts: number[], gap: number): number {
	const shown = parts.filter((part) => part > 0);
	return (
		shown.reduce((sum, part) => sum + part, 0) +
		gap * Math.max(0, shown.length - 1)
	);
}

function storyHeight(item: GazetteItem, width: number, clamp: number): number {
	return stack(
		[
			block(item.title, HEADLINE, width),
			item.author ? META : 0,
			block(item.summary, BODY, width, clamp),
			item.highlights.length > 0 ? META : 0,
		],
		STACK_GAP
	);
}

function glanceHeight(items: GazetteItem[], width: number): number {
	if (items.length === 0) return 0;

	const heading = block(GLANCE_HEADING, HEADLINE, width) + 12;
	const item = (it: GazetteItem) =>
		RULE + 16 + block(`${it.title} ${it.summary}`, BODY, width, 4) + 4 + META;
	return items.reduce((sum, it) => sum + item(it), heading);
}

function sideHeight(items: GazetteItem[], width: number): number {
	return items.reduce(
		(sum, item, i) =>
			sum + (i > 0 ? RULE + 16 : 0) + storyHeight(item, width, 4) + 16,
		0
	);
}

function leadHeight(item: GazetteItem, width: number): number {
	const pull = item.highlights.find(
		(text) => text.length >= 60 && text.length <= 400
	);
	const tucked = item.highlights.length - (pull ? 1 : 0);
	return stack(
		[
			block(item.title, LEAD_HEADLINE, width),
			item.author ? META : 0,
			block(item.summary, BODY, width),
			pull
				? 12 + 24 + 2 * RULE + block(pull, PULL, Math.min(width, PULL_MAX))
				: 0,
			tucked > 0 ? META : 0,
		],
		LEAD_GAP
	);
}

/**
 * Estimates, from text lengths, how many of the remaining stories fit in the
 * space the lead story leaves empty beside the glance and side columns. The
 * figures are pixels in the `lg` layout, where the 5xl column is 976px wide
 * whatever the viewport.
 */
export function aboveTheFold(
	glance: GazetteItem[],
	lead: GazetteItem,
	side: GazetteItem[],
	candidates: GazetteItem[]
): number {
	const columns = Number(glance.length > 0) + Number(side.length > 0);
	if (columns === 0) return 0;

	const fr = (COLUMN - GAP * columns) / (2 + columns);
	const narrow = fr - GAP - RULE;
	const wide = 2 * fr;
	const cell = (wide - GAP) / 2;

	let free =
		Math.max(glanceHeight(glance, narrow), sideHeight(side, narrow)) -
		leadHeight(lead, wide);
	let count = 0;
	while (count < candidates.length) {
		const row = candidates.slice(count, count + 2);
		const height =
			GAP +
			12 +
			RULE +
			Math.max(...row.map((item) => storyHeight(item, cell, 3)));
		if (height > free) break;

		free -= height;
		count += row.length;
	}
	return count;
}
