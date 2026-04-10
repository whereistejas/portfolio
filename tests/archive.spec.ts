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

	test("archive items are ordered newest to oldest", async ({ page }) => {
		const metaTexts = await page.locator(".feed-item .feed-meta").allTextContents();

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
			expect(dates[i].getTime()).toBeLessThanOrEqual(dates[i - 1].getTime());
		}
	});

	test("hovered item adjacent to expanded item has proper gap", async ({
		page,
	}) => {
		// Find the first highlight item and expand it
		const highlightItems = page.locator(".feed-item--with-highlights");
		const firstHL = highlightItems.nth(0);
		await firstHL.locator(".feed-highlight-btn").click();
		await page.waitForTimeout(600);
		await expect(firstHL.locator(".feed-highlights-body")).toBeVisible();

		// Find the feed-item immediately after the expanded one in the DOM
		const expandedCard = firstHL.locator(".feed-item-card");
		const nextItem = firstHL.locator("~ .feed-item").first();
		await expect(nextItem).toBeVisible();

		// Hover the next item to trigger hover background
		await nextItem.hover();
		await page.waitForTimeout(100);

		const expandedBox = await expandedCard.boundingBox();
		// For non-highlight items there's no .feed-item-card, use the item itself
		const nextHasCard = (await nextItem.locator(".feed-item-card").count()) > 0;
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
			if (await item.locator(".feed-highlight-btn").count() > 0) {
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
		await page.waitForTimeout(100);

		const prevHasCard = (await prevItem.locator(".feed-item-card").count()) > 0;
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

	test("highlight button has a chevron that rotates when expanded", async ({
		page,
	}) => {
		const firstCard = page.locator(".feed-item--with-highlights").first();
		const chevron = firstCard.locator(".feed-highlight-chevron");

		// Chevron should exist
		await expect(chevron).toBeVisible();

		// Get initial rotation (should be 0)
		const getRotation = async () => {
			return chevron.evaluate((el) => {
				const transform = window.getComputedStyle(el).transform;
				if (!transform || transform === "none") return 0;
				// matrix(a, b, c, d, tx, ty) — rotation = atan2(b, a)
				const match = transform.match(/matrix\(([^)]+)\)/);
				if (!match) return 0;
				const [a, b] = match[1].split(",").map(Number);
				return Math.round(Math.atan2(b, a) * (180 / Math.PI));
			});
		};

		expect(await getRotation()).toBe(0);

		// Expand
		await firstCard.locator(".feed-highlight-btn").click();
		await page.waitForTimeout(600);

		// Should be rotated 180 degrees
		expect(await getRotation()).toBe(180);

		// Collapse
		await firstCard.locator(".feed-highlight-btn").click();
		await page.waitForTimeout(600);

		// Should be back to 0
		expect(await getRotation()).toBe(0);
	});
});
