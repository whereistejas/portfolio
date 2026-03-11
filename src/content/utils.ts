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
