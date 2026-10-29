import { z } from "astro/zod";

import type { MatterAnnotation, MatterItem, MatterStatus } from "./types.ts";
import {
	matterAnnotationSchema,
	matterItemSchema,
	matterListSchema,
} from "./types.ts";

const savedItemSchema = z.object({ id: z.string() });

const BASE_URL = "https://api.getmatter.com/public/v1";
const PAGE_SIZE = "100";
const MAX_ATTEMPTS = 5;

// Matter allows 120 reads and 10 saves per minute, with a burst ceiling of
// 5 requests per second.
const READ_INTERVAL_MS = 500;
const SAVE_INTERVAL_MS = 6_500;

function parseRetryAfter(value: string): number {
	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) return seconds;
	const date = Date.parse(value);
	if (!Number.isNaN(date)) {
		return Math.max(0, Math.ceil((date - Date.now()) / 1000));
	}
	return 60;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MatterClient {
	readonly #token: string;
	#nextReadAt = 0;
	#nextSaveAt = 0;

	constructor(token: string) {
		this.#token = token;
	}

	async #request(
		method: "GET" | "POST",
		path: string,
		body?: unknown
	): Promise<Response> {
		const isSave = method === "POST";

		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			const now = Date.now();
			const readyAt = isSave ? this.#nextSaveAt : this.#nextReadAt;
			if (readyAt > now) await sleep(readyAt - now);
			if (isSave) this.#nextSaveAt = Date.now() + SAVE_INTERVAL_MS;
			this.#nextReadAt = Date.now() + READ_INTERVAL_MS;

			const response = await fetch(`${BASE_URL}${path}`, {
				method,
				headers: {
					Authorization: `Bearer ${this.#token}`,
					...(body === undefined ? {} : { "Content-Type": "application/json" }),
				},
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			});

			if (response.status !== 429 || attempt === MAX_ATTEMPTS) {
				return response;
			}

			const retryAfter = response.headers.get("retry-after");
			const waitSeconds = retryAfter ? parseRetryAfter(retryAfter) : 60;
			console.log(
				`[matter] 429 rate limited, waiting ${waitSeconds}s (attempt ${attempt}/${MAX_ATTEMPTS})`
			);
			await sleep(waitSeconds * 1000);
		}
		throw new Error("MatterClient: unreachable");
	}

	async #get<T extends z.ZodType>(
		path: string,
		schema: T
	): Promise<z.infer<T>> {
		const response = await this.#request("GET", path);
		if (!response.ok) {
			throw new Error(
				`[matter] GET ${path} failed: ${response.status} ${await response.text()}`
			);
		}
		return schema.parse(await response.json());
	}

	async #getAll<T extends z.ZodType>(
		path: string,
		params: URLSearchParams,
		schema: T
	): Promise<z.infer<T>[]> {
		const pageSchema = matterListSchema(schema);
		const results: z.infer<T>[] = [];
		params.set("limit", PAGE_SIZE);

		for (;;) {
			const page = await this.#get(`${path}?${params}`, pageSchema);
			results.push(...page.results);
			if (!page.has_more || !page.next_cursor) return results;
			params.set("cursor", page.next_cursor);
		}
	}

	async checkAccess(): Promise<void> {
		const response = await this.#request("GET", "/me");
		if (!response.ok) {
			throw new Error(
				`[matter] token rejected: ${response.status} ${await response.text()}`
			);
		}
	}

	listItems(statuses: MatterStatus[] | "all"): Promise<MatterItem[]> {
		const status = statuses === "all" ? "all" : statuses.join(",");
		return this.#getAll(
			"/items",
			new URLSearchParams({ status }),
			matterItemSchema
		);
	}

	listAnnotations(itemId: string): Promise<MatterAnnotation[]> {
		return this.#getAll(
			`/items/${encodeURIComponent(itemId)}/annotations`,
			new URLSearchParams(),
			matterAnnotationSchema
		);
	}

	async saveToQueue(url: string): Promise<string> {
		const response = await this.#request("POST", "/items", {
			url,
			status: "queue",
		});
		if (!response.ok) {
			throw new Error(`${response.status} ${await response.text()}`);
		}
		// The item is still being processed, so only its id is reliable yet.
		return savedItemSchema.parse(await response.json()).id;
	}
}
