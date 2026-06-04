import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const READWISE_CACHE_DIR = ".readwise-cache";
export const PROCESSED_CACHE_PATH = "src/content/cache-processed.json";
export const RAW_CACHE_PATH = `${READWISE_CACHE_DIR}/readwise-raw.json`;

export async function readJsonCache<T>(
	path: string,
	defaultValue: T
): Promise<T> {
	try {
		const data = await readFile(path, "utf-8");
		return JSON.parse(data);
	} catch (err) {
		if (err instanceof Error && "code" in err && err.code === "ENOENT") {
			return defaultValue;
		}
		console.error(`[cache] Failed to parse ${path}:`, err);
		throw err;
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
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, JSON.stringify(sortKeys(data), null, 2));
}
