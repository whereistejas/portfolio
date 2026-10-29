export const READWISE_CACHE_DIR = ".readwise-cache";
export const PROCESSED_CACHE_PATH = "src/content/cache-processed.json";
export const READWISE_FROZEN_PATH = "src/content/cache-readwise.json";
export const RAW_CACHE_PATH = `${READWISE_CACHE_DIR}/readwise-raw.json`;

export async function readJsonCache<T>(
	path: string,
	defaultValue: T
): Promise<T> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		return defaultValue;
	}
	try {
		const data = await file.text();
		return JSON.parse(data);
	} catch (err) {
		console.error(`[cache] Failed to parse ${path}:`, err);
		throw err;
	}
}

export function normalizeUrlForJoin(input: string): string {
	try {
		const url = new URL(input);
		url.hash = "";
		if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
			url.pathname = url.pathname.slice(0, -1);
		}
		return url.toString();
	} catch {
		return input.trim();
	}
}

export async function writeJsonCache<T>(path: string, data: T): Promise<void> {
	const sortKeys = (obj: unknown): unknown => {
		if (obj === null || typeof obj !== "object") return obj;
		if (Array.isArray(obj)) return obj.map(sortKeys);
		const record = obj as Record<string, unknown>;
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort()) {
			sorted[key] = sortKeys(record[key]);
		}
		return sorted;
	};
	await Bun.write(path, JSON.stringify(sortKeys(data), null, 2));
}
