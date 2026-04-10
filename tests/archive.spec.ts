import { test, expect } from "@playwright/test";

test.describe("Archive page – highlights accordion", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/archive");
		await page.waitForLoadState("networkidle");
	});

	test("highlight button is inline with meta text, not on a new line", async ({
		page,
	}) => {
		const firstCard = page.locator(".feed-item--with-highlights").first();
		await expect(firstCard).toBeVisible();

		const metaSpan = firstCard.locator(".feed-meta").first();
		const highlightBtn = firstCard.locator(".feed-highlight-btn").first();

		await expect(metaSpan).toBeVisible();
		await expect(highlightBtn).toBeVisible();

		const metaBox = await metaSpan.boundingBox();
		const btnBox = await highlightBtn.boundingBox();

		expect(metaBox).not.toBeNull();
		expect(btnBox).not.toBeNull();

		// Same vertical line — top values within 5px
		expect(Math.abs(metaBox!.y - btnBox!.y)).toBeLessThan(5);
	});

	test("two expanded accordions have visible gap between items", async ({
		page,
	}) => {
		const items = page.locator(".feed-item--with-highlights");
		const count = await items.count();
		expect(count).toBeGreaterThanOrEqual(2);

		const first = items.nth(0);
		const second = items.nth(1);

		// Open both
		await first.locator(".feed-highlight-btn").click();
		await page.waitForTimeout(600);
		await second.locator(".feed-highlight-btn").click();
		await page.waitForTimeout(600);

		// Both should have highlight bodies visible
		await expect(first.locator(".feed-highlights-body")).toBeVisible();
		await expect(second.locator(".feed-highlights-body")).toBeVisible();

		const firstCard = first.locator(".feed-item-card");
		const secondCard = second.locator(".feed-item-card");
		const firstBox = await firstCard.boundingBox();
		const secondBox = await secondCard.boundingBox();

		expect(firstBox).not.toBeNull();
		expect(secondBox).not.toBeNull();

		const gap = secondBox!.y - (firstBox!.y + firstBox!.height);
		// Should have meaningful gap (at least 4px of spacing between items)
		expect(gap).toBeGreaterThanOrEqual(4);
	});

	test("expanded accordion shows highlight content", async ({ page }) => {
		const firstCard = page.locator(".feed-item--with-highlights").first();
		const btn = firstCard.locator(".feed-highlight-btn");

		await btn.click();
		await page.waitForTimeout(600);

		const body = firstCard.locator(".feed-highlights-body");
		await expect(body).toBeVisible();

		// Should have at least one blockquote
		const quotes = body.locator("blockquote");
		expect(await quotes.count()).toBeGreaterThan(0);
	});

	test("accordion collapses when clicked again", async ({ page }) => {
		const firstCard = page.locator(".feed-item--with-highlights").first();
		const btn = firstCard.locator(".feed-highlight-btn");

		// Open
		await btn.click();
		await page.waitForTimeout(600);
		await expect(firstCard.locator(".feed-highlights-body")).toBeVisible();

		// Close
		await btn.click();
		await page.waitForTimeout(600);
		await expect(firstCard.locator(".feed-highlights-body")).not.toBeVisible();
	});

	test("description text expands when accordion is opened", async ({
		page,
	}) => {
		// Find a highlight card whose description is clamped
		const items = page.locator(".feed-item--with-highlights");
		const count = await items.count();
		let targetItem = null;
		let collapsedWrapperH = 0;

		for (let i = 0; i < count; i++) {
			const item = items.nth(i);
			const wrapper = item.locator(".feed-desc-wrapper");
			if ((await wrapper.count()) === 0) continue;

			const box = await wrapper.boundingBox();
			if (!box) continue;

			targetItem = item;
			collapsedWrapperH = box.height;
			break;
		}

		if (!targetItem) return; // no clamped descriptions

		await targetItem.locator(".feed-highlight-btn").click();
		await page.waitForTimeout(800);

		const wrapper = targetItem.locator(".feed-desc-wrapper");
		const expandedBox = await wrapper.boundingBox();
		expect(expandedBox).not.toBeNull();
		expect(expandedBox!.height).toBeGreaterThan(collapsedWrapperH);
	});

	test("archive items are ordered newest to oldest", async ({ page }) => {
		const metaTexts = await page
			.locator(".feed-item .feed-meta")
			.allTextContents();

		// Extract dates — format is like "article · 28 Mar 2026 · Author"
		const dateRegex = /(\d{1,2}\s+\w+\s+\d{4})/;
		const dates: Date[] = [];
		for (const text of metaTexts) {
			const match = text.match(dateRegex);
			if (match) {
				dates.push(new Date(match[1]));
			}
		}

		expect(dates.length).toBeGreaterThan(1);

		// Verify dates are in descending order (newest first)
		for (let i = 1; i < dates.length; i++) {
			expect(dates[i].getTime()).toBeLessThanOrEqual(
				dates[i - 1].getTime(),
			);
		}
	});

	test("hovered item adjacent to expanded item has proper gap", async ({
		page,
	}) => {
		const highlightItems = page.locator(".feed-item--with-highlights");
		const firstHL = highlightItems.nth(0);
		await firstHL.locator(".feed-highlight-btn").click();
		await page.waitForTimeout(600);
		await expect(firstHL.locator(".feed-highlights-body")).toBeVisible();

		const expandedCard = firstHL.locator(".feed-item-card");
		const nextItem = firstHL.locator("~ .feed-item").first();
		await expect(nextItem).toBeVisible();

		// Hover the next item to trigger hover background
		await nextItem.hover();
		// Wait for margin transition to complete
		await page.waitForTimeout(500);

		const expandedBox = await expandedCard.boundingBox();
		const nextHasCard =
			(await nextItem.locator(".feed-item-card").count()) > 0;
		const nextTarget = nextHasCard
			? nextItem.locator(".feed-item-card")
			: nextItem;
		const nextBox = await nextTarget.boundingBox();

		expect(expandedBox).not.toBeNull();
		expect(nextBox).not.toBeNull();

		const gap = nextBox!.y - (expandedBox!.y + expandedBox!.height);
		expect(gap).toBeGreaterThanOrEqual(4);
	});

	test("hovered item above expanded item has proper gap", async ({
		page,
	}) => {
		const allItems = page.locator(".feed-item");
		const allCount = await allItems.count();

		// Find a highlight item that isn't the first feed-item
		let hlIndex = -1;
		for (let i = 1; i < allCount; i++) {
			const item = allItems.nth(i);
			if ((await item.locator(".feed-highlight-btn").count()) > 0) {
				hlIndex = i;
				break;
			}
		}
		expect(hlIndex).toBeGreaterThan(0);

		const hlItem = allItems.nth(hlIndex);
		const prevItem = allItems.nth(hlIndex - 1);

		// Expand the highlight item
		await hlItem.locator(".feed-highlight-btn").click();
		await page.waitForTimeout(600);
		await expect(hlItem.locator(".feed-highlights-body")).toBeVisible();

		// Hover the item above
		await prevItem.hover();
		// Wait for margin transition to complete
		await page.waitForTimeout(500);

		const prevHasCard =
			(await prevItem.locator(".feed-item-card").count()) > 0;
		const prevTarget = prevHasCard
			? prevItem.locator(".feed-item-card")
			: prevItem;
		const prevBox = await prevTarget.boundingBox();

		const hlCard = hlItem.locator(".feed-item-card");
		const hlBox = await hlCard.boundingBox();

		expect(prevBox).not.toBeNull();
		expect(hlBox).not.toBeNull();

		const gap = hlBox!.y - (prevBox!.y + prevBox!.height);
		expect(gap).toBeGreaterThanOrEqual(4);
	});


	test("no sudden layout shift when expanding accordion", async ({
		page,
	}) => {
		// Use requestAnimationFrame to sample at render-frame rate
		const positions = await page.evaluate(async () => {
			const el = document.querySelector(
				".feed-item--with-highlights ~ .feed-item",
			) as HTMLElement;
			if (!el) return [];

			const samples: number[] = [el.getBoundingClientRect().y];

			const btn = document.querySelector(
				".feed-item--with-highlights .feed-highlight-btn",
			) as HTMLButtonElement;
			btn?.click();

			await new Promise<void>((resolve) => {
				const start = performance.now();
				function tick() {
					samples.push(el.getBoundingClientRect().y);
					if (performance.now() - start < 500) {
						requestAnimationFrame(tick);
					} else {
						resolve();
					}
				}
				requestAnimationFrame(tick);
			});

			return samples;
		});

		expect(positions.length).toBeGreaterThan(5);

		// No single render frame should jump more than 30px
		const MAX_PER_FRAME = 40;
		for (let i = 1; i < positions.length; i++) {
			const delta = Math.abs(positions[i] - positions[i - 1]);
			expect(
				delta,
				`Frame ${i}/${positions.length}: ${delta.toFixed(1)}px jump`,
			).toBeLessThanOrEqual(MAX_PER_FRAME);
		}
	});

	test("no sudden layout shift when collapsing accordion", async ({
		page,
	}) => {
		const firstHL = page.locator(".feed-item--with-highlights").first();

		// Expand first and let it settle
		await firstHL.locator(".feed-highlight-btn").click();
		await page.waitForTimeout(800);

		const positions = await page.evaluate(async () => {
			const el = document.querySelector(
				".feed-item--with-highlights ~ .feed-item",
			) as HTMLElement;
			if (!el) return [];

			const samples: number[] = [el.getBoundingClientRect().y];

			const btn = document.querySelector(
				".feed-item--with-highlights .feed-highlight-btn",
			) as HTMLButtonElement;
			btn?.click();

			await new Promise<void>((resolve) => {
				const start = performance.now();
				function tick() {
					samples.push(el.getBoundingClientRect().y);
					if (performance.now() - start < 500) {
						requestAnimationFrame(tick);
					} else {
						resolve();
					}
				}
				requestAnimationFrame(tick);
			});

			return samples;
		});

		expect(positions.length).toBeGreaterThan(5);

		const MAX_PER_FRAME = 40;
		for (let i = 1; i < positions.length; i++) {
			const delta = Math.abs(positions[i] - positions[i - 1]);
			expect(
				delta,
				`Frame ${i}/${positions.length}: ${delta.toFixed(1)}px jump`,
			).toBeLessThanOrEqual(MAX_PER_FRAME);
		}
	});

	test("separator glyphs are vertically centered with adjacent text", async ({
		page,
	}) => {
		const failures = await page.evaluate(() => {
			const containers = document.querySelectorAll(".feed-meta, .feed-tags");
			const errors: string[] = [];

			containers.forEach((container, ci) => {
				// Get all visible separators in this container
				const separators = Array.from(
					container.querySelectorAll(".feed-separator"),
				).filter((el) => {
					const r = el.getBoundingClientRect();
					return r.width > 0 && r.height > 0;
				});
				if (separators.length < 2) return;

				// Group separators by line (same top ± 5px)
				type Item = { el: Element; rect: DOMRect; center: number };
				const lines: Item[][] = [];
				for (const el of separators) {
					const rect = el.getBoundingClientRect();
					const center = rect.top + rect.height / 2;
					const existing = lines.find((line) =>
						Math.abs(line[0].rect.top - rect.top) < 5,
					);
					if (existing) {
						existing.push({ el, rect, center });
					} else {
						lines.push([{ el, rect, center }]);
					}
				}

				for (const line of lines) {
					if (line.length < 2) continue;

					// All separators on the same line must have the same height
					const heights = line.map((s) => s.rect.height);
					const hMin = Math.min(...heights);
					const hMax = Math.max(...heights);
					if (hMax - hMin > 1) {
						errors.push(
							`Container #${ci}: separator heights differ [${heights.map((h) => h.toFixed(1)).join(", ")}]`,
						);
					}

					// All separators on the same line must have the same center
					const centers = line.map((s) => s.center);
					const cMin = Math.min(...centers);
					const cMax = Math.max(...centers);
					if (cMax - cMin > 2) {
						errors.push(
							`Container #${ci}: separator centers differ [${centers.map((c) => c.toFixed(1)).join(", ")}]`,
						);
					}
				}
			});

			return errors;
		});

		expect(
			failures,
			`Misaligned separators:\n${failures.join("\n")}`,
		).toHaveLength(0);
	});
});
