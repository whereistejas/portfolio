import { layout, prepare } from "@chenglou/pretext";

export async function pretextReady(): Promise<void> {
	if (typeof document === "undefined") {
		return;
	}
	await document.fonts?.ready;
}

function parsePx(value: string): number {
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? n : 0;
}

/** Read the browser's computed font shorthand — same approach the Pretext demos use. */
function getFontFromStyles(styles: CSSStyleDeclaration): string {
	if (styles.font.length > 0) {
		return styles.font;
	}
	return `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} / ${styles.lineHeight} ${styles.fontFamily}`;
}

export function getContentBoxWidth(el: Element): number {
	const rect = el.getBoundingClientRect();
	const style = getComputedStyle(el);
	const pl = parsePx(style.paddingLeft);
	const pr = parsePx(style.paddingRight);
	return Math.max(0, rect.width - pl - pr);
}

/** Record Pretext layout stats on `<p>` nodes for future anchoring / virtualization. */
export function annotateProseParagraphHeights(root: HTMLElement): void {
	for (const p of Array.from(root.querySelectorAll("p"))) {
		const text = p.textContent?.trim() ?? "";
		if (!text) {
			continue;
		}
		const styles = getComputedStyle(p);
		const font = getFontFromStyles(styles);
		const lineHeight = parsePx(styles.lineHeight);
		const width = p.getBoundingClientRect().width;
		if (width <= 0) {
			continue;
		}

		const prepared = prepare(text, font);
		const { height, lineCount } = layout(prepared, width, lineHeight);
		p.dataset["pretextHeight"] = String(Math.round(height));
		p.dataset["pretextLineCount"] = String(lineCount);
	}
}

export function initAllBlogArticleMeasurements(): void {
	for (const article of Array.from(
		document.querySelectorAll<HTMLElement>("article.blog-article")
	)) {
		try {
			annotateProseParagraphHeights(article);
		} catch {
			/* ignore */
		}
	}
}
