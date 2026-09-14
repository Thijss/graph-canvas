import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("loads the editor and accepts graph input", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "GraphCanvas" })).toBeVisible();
  await expect(page.locator("#emptyState")).toBeVisible();

  await page.locator("#rawEdgeModeButton").click();
  await page.locator("#edgeEditor").fill("A B\nB C");

  await expect(page.locator("#nodeCount")).toHaveText("3");
  await expect(page.locator("#edgeCount")).toHaveText("2");
  await expect(page.locator("#emptyState")).toBeHidden();
});

test("persists graph input after a refresh", async ({ page }) => {
  await page.locator("#rawEdgeModeButton").click();
  await page.locator("#edgeEditor").fill("A B\nB C");
  await expect(page.locator("#edgeCount")).toHaveText("2");

  await page.reload();

  await expect(page.locator("#edgeEditor")).toHaveValue("A B\nB C");
  await expect(page.locator("#nodeCount")).toHaveText("3");
  await expect(page.locator("#edgeCount")).toHaveText("2");
});

test("persists each editor mode after a refresh", async ({ page }) => {
  await page.locator("#rawEdgeModeButton").click();
  await page.locator("#boundaryTextModeButton").click();

  await page.reload();

  await expect(page.locator("#edgeEditor")).toHaveClass(/is-raw/);
  await expect(page.locator("#boundaryEditor")).toHaveClass(/is-text/);
  await expect(page.locator("#groupEditor")).not.toHaveClass(/is-text/);
  await expect(page.locator("#rawEdgeModeButton")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#boundaryTextModeButton")).toHaveAttribute("aria-pressed", "true");
});

test("exports graph data as a text file", async ({ page }) => {
  await page.locator("#rawEdgeModeButton").click();
  await page.locator("#edgeEditor").fill("A B");
  await expect(page.locator("#edgeCount")).toHaveText("1");

  await page.locator("#saveButton").click();
  await page.locator("#exportTxtButton").click();

  const downloadPromise = page.waitForEvent("download");
  await page.locator('#saveForm button[type="submit"]').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("graph.txt");
  await expect(page.locator("#saveDialog")).toBeHidden();
});
