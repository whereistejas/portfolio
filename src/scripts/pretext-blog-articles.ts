import {
	initAllBlogArticleMeasurements,
	pretextReady,
} from "../lib/pretext";

let proseResizeAbort: AbortController | null = null;

export async function initBlogArticlePretext(): Promise<void> {
	await pretextReady();
	initAllBlogArticleMeasurements();

	proseResizeAbort?.abort();
	proseResizeAbort = new AbortController();
	const { signal } = proseResizeAbort;

	let proseResizeTimer: ReturnType<typeof setTimeout> | undefined;
	const onResize = () => {
		clearTimeout(proseResizeTimer);
		proseResizeTimer = setTimeout(() => {
			initAllBlogArticleMeasurements();
		}, 100);
	};
	window.addEventListener("resize", onResize, { passive: true, signal });
}
