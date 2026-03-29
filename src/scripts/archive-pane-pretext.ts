import { layout, prepare } from "@chenglou/pretext";

import {
	getContentBoxWidth,
	pretextReady,
} from "../lib/pretext";

function parsePx(value: string): number {
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? n : 0;
}

function getFontFromStyles(styles: CSSStyleDeclaration): string {
	if (styles.font.length > 0) {
		return styles.font;
	}
	return `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} / ${styles.lineHeight} ${styles.fontFamily}`;
}

function measureHighlightGroupBlockHeight(
	activeGroup: HTMLElement,
	textColumnWidth: number
): number {
	let total = 0;
	const parent = activeGroup.parentElement;
	const heading = parent?.querySelector(".archive_highlights_heading");
	if (heading) {
		total += heading.getBoundingClientRect().height;
	}

	const blockquotes = activeGroup.querySelectorAll("li blockquote");
	let index = 0;
	for (const bq of Array.from(blockquotes)) {
		const t = bq.textContent?.trim() ?? "";
		if (t) {
			const styles = getComputedStyle(bq);
			const font = getFontFromStyles(styles);
			const lineHeight = parsePx(styles.lineHeight);
			total += layout(prepare(t, font), textColumnWidth, lineHeight).height;
		}
		if (index > 0) {
			total += 6;
		}
		index += 1;
	}

	return total;
}

let paneAbort: AbortController | null = null;

export async function initArchivePagePretext(): Promise<void> {
	await pretextReady();

	const wrapper = document.getElementById("archive-wrapper");
	const pane = document.getElementById("archive-highlights-pane");
	if (!wrapper || !pane) {
		return;
	}

	paneAbort?.abort();
	paneAbort = new AbortController();
	const { signal } = paneAbort;

	const groups = Array.from(
		pane.querySelectorAll<HTMLElement>("[data-highlight-group]")
	);
	const items = Array.from(wrapper.querySelectorAll<HTMLElement>(".feed-item"));
	let activeItem: HTMLElement | null = null;
	let activeId: string | null = null;

	const hidePane = () => {
		activeItem = null;
		activeId = null;
		pane.removeAttribute("data-visible");
		pane.style.removeProperty("top");
		for (const group of groups) {
			group.removeAttribute("data-active");
		}
	};

	const setPaneTop = (item: HTMLElement) => {
		const wrapperRect = wrapper.getBoundingClientRect();
		const itemRect = item.getBoundingClientRect();
		let top = Math.max(itemRect.top - wrapperRect.top, 0);

		const activeGroup = groups.find(
			(g) => g.dataset["highlightGroup"] === activeId
		);
		const contentEl = pane.querySelector(".archive_highlights_content");
		const columnWidth = contentEl
			? getContentBoxWidth(contentEl)
			: getContentBoxWidth(pane);

		if (activeGroup && columnWidth > 0) {
			const paneHeight = measureHighlightGroupBlockHeight(
				activeGroup,
				columnWidth
			);
			const paneTopViewport = wrapperRect.top + top;
			const margin = 8;
			if (paneTopViewport + paneHeight > window.innerHeight - margin) {
				const newTopViewport = window.innerHeight - margin - paneHeight;
				top = Math.max(0, newTopViewport - wrapperRect.top);
			}
		}

		pane.style.top = `${top}px`;
	};

	const showPane = (id: string, item: HTMLElement) => {
		let hasActiveGroup = false;
		for (const group of groups) {
			if (group.dataset["highlightGroup"] === id) {
				group.setAttribute("data-active", "true");
				hasActiveGroup = true;
			} else {
				group.removeAttribute("data-active");
			}
		}

		if (!hasActiveGroup) {
			hidePane();
			return;
		}

		activeItem = item;
		activeId = id;
		pane.setAttribute("data-visible", "true");
		setPaneTop(item);
	};

	const refreshPanePosition = () => {
		if (!activeItem || !activeId) {
			return;
		}
		showPane(activeId, activeItem);
	};

	let resizeTimer: ReturnType<typeof setTimeout> | undefined;
	const onResize = () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			refreshPanePosition();
		}, 100);
	};

	for (const item of items) {
		const activate = () => {
			const highlightId = item.dataset["highlightId"];
			if (!highlightId) {
				hidePane();
				return;
			}
			showPane(highlightId, item);
		};

		item.addEventListener("mouseenter", activate, { signal });
		item.addEventListener("focusin", activate, { signal });
	}

	wrapper.addEventListener("mouseleave", hidePane, { signal });
	wrapper.addEventListener(
		"focusout",
		(event) => {
			const nextFocus = event.relatedTarget;
			if (nextFocus instanceof Node && wrapper.contains(nextFocus)) {
				return;
			}
			hidePane();
		},
		{ signal }
	);
	window.addEventListener("scroll", refreshPanePosition, { passive: true, signal });
	window.addEventListener("resize", onResize, { passive: true, signal });
}
