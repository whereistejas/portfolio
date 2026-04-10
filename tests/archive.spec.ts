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
});
