import { defineCollection } from "astro:content";
import { loadReadwiseArchive, loadReadwiseQueue } from "./readwise.ts";
import {
	readwiseArchiveSchema,
	readwiseQueueSchema,
} from "./types.ts";

export const collections = {
	"readwise-archive": defineCollection({
		loader: loadReadwiseArchive,
		schema: readwiseArchiveSchema,
	}),
	"readwise-queue": defineCollection({
		loader: loadReadwiseQueue,
		schema: readwiseQueueSchema,
	}),
};
