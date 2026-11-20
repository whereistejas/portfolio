import type { ReadwiseArchiveItem } from "../content/types";
import { parseAuthors } from "./feed";

export type GazetteItem = Pick<
	ReadwiseArchiveItem,
	| "readwise_id"
	| "title"
	| "url"
	| "summary"
	| "author"
	| "highlights"
	| "last_moved_at"
>;

export interface Sibling {
	href: string;
	label: string;
}

export interface Issue {
	number: number;
	weekStart: Date;
	weekEnd: Date;
	lead: GazetteItem;
	rest: GazetteItem[];
}

export const GAZETTE_FONTS = [
	"economist-serif-roman.woff2",
	"economist-serif-italic.woff2",
];

export const GAZETTE_PREFETCH_FONTS = [
	"NebulaSans-Book.woff2",
	"NebulaSans-BookItalic.woff2",
	"NebulaSans-Bold.woff2",
	"NebulaSans-BoldItalic.woff2",
];

const DAY_MS = 24 * 60 * 60 * 1000;
const MARGIN_NOTE_THRESHOLD = 4;

export function wantsMarginNote(highlightCount: number): boolean {
	return highlightCount > MARGIN_NOTE_THRESHOLD;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

const longDateFormat = new Intl.DateTimeFormat("en-GB", {
	weekday: "long",
	day: "numeric",
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

export function formatVolume(number: number): string {
	return `Vol. ${number}`;
}

export function volumeSlug(number: number): string {
	return `vol-${number}`;
}

export function volumePath(number: number): string {
	return `/gazette/${volumeSlug(number)}`;
}

export function itemPath(number: number, slug: string): string {
	return `${volumePath(number)}/${slug}`;
}

/** Maps each piece in an issue, by Readwise id, to the path of its own page. */
export function itemPathsOf(issue: Issue): Map<string, string> {
	return new Map(
		[...anchorsOf(issue)].map(([id, slug]) => [
			id,
			itemPath(issue.number, slug),
		])
	);
}

function slugify(title: string): string {
	return title
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.trim()
		.replace(/\s+/g, "-");
}

/**
 * Gives each piece in an issue an anchor slugged from its title, the way
 * Markdown headings get theirs, numbering repeats so every anchor is unique.
 */
export function anchorsOf(issue: Issue): Map<string, string> {
	const anchors = new Map<string, string>();
	const used = new Set<string>();
	for (const item of [issue.lead, ...issue.rest]) {
		const base = slugify(item.title) || "item";
		let anchor = base;
		for (let repeat = 1; used.has(anchor); repeat++) {
			anchor = `${base}-${repeat}`;
		}
		used.add(anchor);
		anchors.set(item.readwise_id, anchor);
	}
	return anchors;
}

export function formatDate(date: Date): string {
	return dateFormat.format(date);
}

export function formatLongDate(date: Date): string {
	return longDateFormat.format(date);
}

function startOfWeek(date: Date): Date {
	const day = Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate()
	);
	const sinceMonday = (date.getUTCDay() + 6) % 7;
	return new Date(day - sinceMonday * DAY_MS);
}

/**
 * Splits a week's other pieces into fixed columns, in reading order, so that
 * expanding one piece's highlights only lengthens its own column. CSS
 * multi-column layout would rebalance the columns on every animation frame.
 */
export function splitIntoColumns<T>(
	items: T[],
	columns: number,
	leadWeight: number,
	weightOf: (item: T) => number
): T[][] {
	const total =
		leadWeight + items.reduce((sum, item) => sum + weightOf(item), 0);
	const perColumn = total / columns;

	const result: T[][] = Array.from({ length: columns }, () => []);
	let column = 0;
	let filled = leadWeight;
	for (const item of items) {
		const weight = weightOf(item);
		if (
			column < columns - 1 &&
			filled > 0 &&
			filled + weight / 2 > perColumn * (column + 1)
		) {
			column++;
		}
		result[column]!.push(item);
		filled += weight;
	}
	return result;
}

export function byRecency(a: GazetteItem, b: GazetteItem): number {
	return b.last_moved_at.getTime() - a.last_moved_at.getTime();
}

function byProminence(a: GazetteItem, b: GazetteItem): number {
	return b.highlights.length - a.highlights.length || byRecency(a, b);
}

export function groupIntoIssues(items: GazetteItem[]): Issue[] {
	const weeks = new Map<number, GazetteItem[]>();
	for (const item of items) {
		const key = startOfWeek(item.last_moved_at).getTime();
		const week = weeks.get(key);
		if (week) week.push(item);
		else weeks.set(key, [item]);
	}

	const oldestFirst = [...weeks.entries()].sort(([a], [b]) => a - b);

	return oldestFirst
		.map(([start, week], index) => {
			const [lead, ...rest] = [...week].sort(byProminence);
			if (!lead) throw new Error("a week in the map always has an item");

			return {
				number: index + 1,
				weekStart: new Date(start),
				weekEnd: new Date(start + 6 * DAY_MS),
				lead,
				rest,
			};
		})
		.reverse();
}

/** Keeps the pieces of an issue that pass `keep`, in rank order. */
export function filterIssue(
	issue: Issue,
	keep: (item: GazetteItem) => boolean
): Issue | undefined {
	const [lead, ...rest] = [issue.lead, ...issue.rest].filter(keep);
	return lead && { ...issue, lead, rest };
}

export function withoutItems(
	issue: Issue,
	taken: Set<GazetteItem>
): Issue | undefined {
	return filterIssue(issue, (item) => !taken.has(item));
}

/**
 * Slugs an author's name for the path of their page. Spellings that differ
 * only in case or accents share a slug, and so a page.
 */
export function authorSlug(name: string): string {
	return slugify(name);
}

export function authorPath(name: string): string | undefined {
	const slug = authorSlug(name);
	return slug ? `/gazette/authors/${slug}` : undefined;
}

export interface Author {
	slug: string;
	name: string;
	items: GazetteItem[];
}

/**
 * Groups pieces by author, splitting co-authored bylines. Spellings that
 * share a slug share an author, named by the spelling used most often.
 */
export function authorsOf(items: GazetteItem[]): Author[] {
	const bySlug = new Map<
		string,
		{ spellings: Map<string, number>; items: Set<GazetteItem> }
	>();
	for (const item of items) {
		for (const name of parseAuthors(item.author)) {
			const slug = authorSlug(name);
			if (!slug) continue;

			const author = bySlug.get(slug) ?? {
				spellings: new Map<string, number>(),
				items: new Set<GazetteItem>(),
			};
			author.spellings.set(name, (author.spellings.get(name) ?? 0) + 1);
			author.items.add(item);
			bySlug.set(slug, author);
		}
	}

	return [...bySlug].map(([slug, { spellings, items }]) => ({
		slug,
		name: [...spellings].reduce((best, next) =>
			next[1] > best[1] ? next : best
		)[0],
		items: [...items],
	}));
}
