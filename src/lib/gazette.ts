import type { ReadwiseArchiveItem } from "../content/types";

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

export interface Issue {
	number: number;
	weekStart: Date;
	weekEnd: Date;
	lead: GazetteItem;
	rest: GazetteItem[];
}

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

export function withoutItems(
	issue: Issue,
	taken: Set<GazetteItem>
): Issue | undefined {
	const [lead, ...rest] = [issue.lead, ...issue.rest].filter(
		(item) => !taken.has(item)
	);
	return lead && { ...issue, lead, rest };
}
