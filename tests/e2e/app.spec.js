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

test("imports pasted TXT graph text from the Edges section", async ({ page }) => {
  const importButton = page.locator("#importButton");
  const importText = page.locator("#importText");
  const buttonWidth = await importButton.evaluate((button) => button.getBoundingClientRect().width);
  const rowWidth = await page.locator("#edgeImportRow").evaluate((row) => row.getBoundingClientRect().width);
  expect(buttonWidth).toBeLessThan(rowWidth / 2);
  await expect(importText).toHaveAttribute("rows", "1");
  await expect(importText).toHaveAttribute("wrap", "off");
  await expect(importText).toBeHidden();

  await importButton.click();
  await expect(importText).toBeVisible();
  await expect.poll(() => importButton.evaluate((button) => button.getBoundingClientRect().width)).toBe(buttonWidth);
  await importText.fill("A B\nB C");
  await importButton.click();

  await expect(page.locator("#edgeEditor")).toHaveValue("A B\nB C");
  await expect(page.locator("#nodeCount")).toHaveText("3");
  await expect(page.locator("#edgeCount")).toHaveText("2");
  await expect(importText).toHaveValue("");
  await expect(importText).toBeHidden();
});

test("normalizes PGM edge options only during TXT import", async ({ page }) => {
  const source = [
    "open transformer open",
    "transformer link transformer",
    "link A link",
    "-----BOUNDARIES-----",
    "open open,transformer link",
    "-----GROUPS-----",
    "transformer link,A",
  ].join("\n");
  await page.locator("#importButton").click();
  await page.locator("#importText").fill(source);
  await page.locator("#importButton").click();

  await expect(page.locator("#edgeEditor")).toHaveValue(
    "open transformer dashed\ntransformer link blue\nlink A green",
  );
  await expect(page.locator("#boundaryEditor")).toHaveValue("open open,transformer link");
  await expect(page.locator("#groupEditor")).toHaveValue("transformer link,A");
  await expect(page.locator("#nodeCount")).toHaveText("4");
  await expect(page.locator("#edgeCount")).toHaveText("3");
  const rows = page.locator("#edgeList .edge-row");
  await expect(rows.nth(0).getByRole("button", { name: "Style dashed line", exact: true })).toBeVisible();
  await expect(rows.nth(1).locator(".edge-color-control input")).toHaveValue("blue");
  await expect(rows.nth(2).locator(".edge-color-control input")).toHaveValue("green");
  const dashedEdge = page.locator("#graph .edge-line.dashed");
  await expect(dashedEdge).toHaveCount(1);
  await expect.poll(() => dashedEdge.evaluate((line) => (
    getComputedStyle(line).strokeDasharray.split(/[ ,]+/).map(parseFloat)
  ))).toEqual([6, 10]);
  await expect.poll(() => dashedEdge.evaluate((line) => getComputedStyle(line).strokeLinecap)).toBe("butt");

  await page.reload();
  await expect(page.locator("#edgeEditor")).toHaveValue(
    "open transformer dashed\ntransformer link blue\nlink A green",
  );
});

test("imports comma-separated strings through the normal TXT pipeline", async ({ page }) => {
  await page.locator("#importButton").click();
  await page.locator("#importText").fill([
    '"1 2", "3 4 open",',
    '"3 5 blue", "5 6 transformer,open", "6 7 link",',
    '"-----BOUNDARIES-----", "A 1,2 Example",',
    '"-----GROUPS-----", "Team 3,4"',
  ].join("\n"));
  await page.locator("#importButton").click();

  const expectedEdges = "1 2\n3 4 dashed\n3 5 blue\n5 6 blue,dashed\n6 7 green";
  await expect(page.locator("#edgeEditor")).toHaveValue(expectedEdges);
  await expect(page.locator("#boundaryEditor")).toHaveValue("A 1,2 Example");
  await expect(page.locator("#groupEditor")).toHaveValue("Team 3,4");
  await expect(page.locator("#nodeCount")).toHaveText("7");
  await expect(page.locator("#edgeCount")).toHaveText("5");
  await expect(page.locator("#importText")).toBeHidden();

  await page.reload();
  await expect(page.locator("#edgeEditor")).toHaveValue(expectedEdges);
});

test("ignores comments when importing a quoted string list", async ({ page }) => {
  await page.locator("#importButton").click();
  await page.locator("#importText").fill([
    "# Connections",
    '"S10 20 4,transformer", #asdasd',
    '  "20 30 5,transformer", "30 40 6,transformer" # last edge',
  ].join("\n"));
  await page.locator("#importButton").click();

  await expect(page.locator("#edgeEditor")).toHaveValue(
    "S10 20 4,blue\n20 30 5,blue\n30 40 6,blue",
  );
  await expect(page.locator("#nodeCount")).toHaveText("4");
  await expect(page.locator("#edgeCount")).toHaveText("3");
  const rows = page.locator("#edgeList .edge-row");
  await expect(rows.nth(0).locator(".edge-labels input")).toHaveValue("4");
  await expect(rows.nth(1).locator(".edge-labels input")).toHaveValue("5");
  await expect(rows.nth(2).locator(".edge-labels input")).toHaveValue("6");
});

test("keeps the current graph and pasted text when a string list is invalid", async ({ page }) => {
  await page.locator("#rawEdgeModeButton").click();
  await page.locator("#edgeEditor").fill("A B");
  await expect(page.locator("#edgeCount")).toHaveText("1");
  await page.locator("#importButton").click();
  await page.locator("#importText").fill('"1 2", 42');
  await page.locator("#importButton").click();

  await expect(page.locator("#statusText")).toHaveText(
    "Couldn't import graph: Import list must contain only strings.",
  );
  await expect(page.locator("#edgeEditor")).toHaveValue("A B");
  await expect(page.locator("#importText")).toHaveValue('"1 2", 42');
  await expect(page.locator("#importText")).toBeVisible();

  await page.locator("#importText").fill('"1 2", "3 4"');
  await page.locator("#importButton").click();
  await expect(page.locator("#edgeEditor")).toHaveValue("1 2\n3 4");
  await expect(page.locator("#edgeCount")).toHaveText("2");
});

test("keeps the current graph when importing only comments", async ({ page }) => {
  await page.locator("#rawEdgeModeButton").click();
  await page.locator("#edgeEditor").fill("A B");
  await page.locator("#importButton").click();
  await page.locator("#importText").fill("# this is a comment, hello!");
  await page.locator("#importButton").click();

  await expect(page.locator("#edgeEditor")).toHaveValue("A B");
  await expect(page.locator("#importText")).toHaveValue("# this is a comment, hello!");
  await expect(page.locator("#importText")).toBeVisible();
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
