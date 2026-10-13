import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("loads the editor and accepts graph input", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "GraphCanvas" })).toBeVisible();
  await expect(page.locator("#emptyState")).toBeVisible();

  await expect(page.getByRole("textbox", { name: "Edges", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Edge editor mode", exact: true })).toHaveCount(0);
  await expect(page.locator("#edgeList, #addEdgeButton")).toHaveCount(0);
  await page.locator("#edgeEditor").fill("A B\nB C");

  await expect(page.locator("#nodeCount")).toHaveText("3");
  await expect(page.locator("#edgeCount")).toHaveText("2");
  await expect(page.locator("#emptyState")).toBeHidden();
});

test("persists graph input after a refresh", async ({ page }) => {
  await page.locator("#edgeEditor").fill("A B\nB C");
  await expect(page.locator("#edgeCount")).toHaveText("2");

  await page.reload();

  await expect(page.locator("#edgeEditor")).toHaveValue("A B\nB C");
  await expect(page.locator("#nodeCount")).toHaveText("3");
  await expect(page.locator("#edgeCount")).toHaveText("2");
});

test("persists boundary and group editor modes after a refresh", async ({ page }) => {
  await page.locator("#boundaryTextModeButton").click();

  await page.reload();

  await expect(page.locator("#edgeEditor")).toBeVisible();
  await expect(page.locator("#boundaryEditor")).toHaveClass(/is-text/);
  await expect(page.locator("#groupEditor")).not.toHaveClass(/is-text/);
  await expect(page.locator("#boundaryTextModeButton")).toHaveAttribute("aria-pressed", "true");

  await page.locator("#groupTextModeButton").click();
  await page.locator("#boundaryVisualModeButton").click();
  await page.reload();
  await expect(page.locator("#boundaryEditor")).not.toHaveClass(/is-text/);
  await expect(page.locator("#groupEditor")).toHaveClass(/is-text/);
  await expect(page.locator("#groupTextModeButton")).toHaveAttribute("aria-pressed", "true");
});

for (const mode of ["visual", "raw"]) {
  test(`ignores the legacy ${mode} edge mode without changing saved text`, async ({ page }) => {
    const source = '"Node A" B blue,dashed,backup\nstandalone';
    await page.evaluate(({ mode, source }) => {
      localStorage.setItem("graph-editor:editor-modes", JSON.stringify({
        edges: mode, boundaries: "text", groups: "visual",
      }));
      sessionStorage.setItem("graph-editor:edges", source);
    }, { mode, source });
    await page.reload();

    await expect(page.getByRole("textbox", { name: "Edges", exact: true })).toBeVisible();
    await expect(page.locator("#edgeEditor")).toHaveValue(source);
    await expect(page.locator("#nodeCount")).toHaveText("3");
    await expect(page.locator("#edgeCount")).toHaveText("1");
    await expect(page.locator("#graph .edge-line.blue.dashed")).toHaveCount(1);
    await expect(page.locator("#graph .edge-label")).toHaveText("backup");
    await expect(page.locator("#boundaryEditor")).toHaveClass(/is-text/);
    await expect(page.locator("#groupEditor")).not.toHaveClass(/is-text/);
  });
}

test("validates edge colors and restores valid text", async ({ page }) => {
  await page.locator("#edgeEditor").fill("A B blue,red");
  await expect(page.locator("#statusText")).toHaveText("Error: choose only one color per edge");
  await expect(page.locator("#edgeErrors .editor-error")).toHaveCount(1);
  await expect(page.locator("#graph .edge-line")).toHaveCount(0);

  await page.locator("#edgeEditor").fill("A B blue");
  await expect(page.locator("#statusText")).toHaveText("No issues");
  await expect(page.locator("#edgeErrors .editor-error")).toHaveCount(0);
  await expect(page.locator("#graph .edge-line.blue")).toHaveCount(1);
});

test("loads and clears a template in the text-only Edges editor", async ({ page }) => {
  await page.locator("#templateButton").click();
  await page.locator('.template-option[data-template="30-node"]').click();

  await expect(page.locator("#edgeEditor")).toBeVisible();
  await expect(page.locator("#edgeEditor")).toHaveValue(/^1 2 blue\n[\s\S]*25 30 dashed$/);
  await expect(page.locator("#nodeCount")).toHaveText("30");
  await expect(page.locator("#edgeCount")).toHaveText("33");
  await expect(page.locator("#boundaryList .boundary-row")).toHaveCount(3);

  await page.getByRole("button", { name: "Collapse Edges section", exact: true }).click();
  await expect(page.locator("#edgeEditor")).toBeHidden();
  await page.getByRole("button", { name: "Expand Edges section", exact: true }).click();
  await expect(page.locator("#edgeEditor")).toBeVisible();

  await page.locator("#clearButton").click();
  await expect(page.locator("#edgeEditor")).toHaveValue("");
  await expect(page.locator("#nodeCount")).toHaveText("0");
  await expect(page.locator("#edgeCount")).toHaveText("0");
  await page.reload();
  await expect(page.locator("#edgeEditor")).toHaveValue("");
  await expect(page.locator("#emptyState")).toBeVisible();
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
  await expect(page.locator("#graph .edge-line.blue")).toHaveCount(1);
  await expect(page.locator("#graph .edge-line.green")).toHaveCount(1);
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
  await expect(page.locator("#graph .edge-label")).toHaveText(["4", "5", "6"]);
});

test("keeps the current graph and pasted text when a string list is invalid", async ({ page }) => {
  await page.locator("#edgeEditor").fill("A B");
  await expect(page.locator("#edgeCount")).toHaveText("1");
  await page.locator("#importButton").click();
  await page.locator("#importText").fill('"1 2", 42');
  await page.locator("#importButton").click();

  await page.locator("label").filter({ has: page.locator("#directedToggle") }).click();
  await expect(page.locator("#importError")).toHaveText(
    "Couldn't import graph: Import list must contain only strings.",
  );
  await expect(page.locator("#importError")).toBeVisible();
  await expect(page.locator("#importText")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#importText")).toHaveAttribute("aria-describedby", "importError");
  await expect(page.locator("#statusText")).toHaveText("No issues");
  await expect(page.locator("#edgeEditor")).toHaveValue("A B");
  await expect(page.locator("#importText")).toHaveValue('"1 2", 42');
  await expect(page.locator("#importText")).toBeVisible();

  await page.locator("#importText").fill('"1 2", "3 4"');
  await page.locator("#importButton").click();
  await expect(page.locator("#edgeEditor")).toHaveValue("1 2\n3 4");
  await expect(page.locator("#edgeCount")).toHaveText("2");
  await expect(page.locator("#statusText")).toHaveText("No issues");
  await expect(page.locator("#importError")).toBeEmpty();
  await expect(page.locator("#importText")).toHaveAttribute("aria-invalid", "false");
});

test("clears an import error when the pasted text changes", async ({ page }) => {
  await page.locator("#importButton").click();
  await page.locator("#importText").fill('"1 2", 42');
  await page.locator("#importButton").click();
  await expect(page.locator("#importError")).toHaveText(
    "Couldn't import graph: Import list must contain only strings.",
  );

  await page.locator("#clearButton").click();
  await expect(page.locator("#statusText")).toHaveText("Ready to draw");
  await expect(page.locator("#importError")).toHaveText(
    "Couldn't import graph: Import list must contain only strings.",
  );

  await page.locator("#importText").fill('"1 2", "3 4"');
  await expect(page.locator("#importError")).toBeEmpty();
  await expect(page.locator("#importText")).toHaveAttribute("aria-invalid", "false");
});

test("keeps the current graph when importing only comments", async ({ page }) => {
  await page.locator("#edgeEditor").fill("A B");
  await page.locator("#importButton").click();
  await page.locator("#importText").fill("# this is a comment, hello!");
  await page.locator("#importButton").click();

  await expect(page.locator("#edgeEditor")).toHaveValue("A B");
  await expect(page.locator("#importText")).toHaveValue("# this is a comment, hello!");
  await expect(page.locator("#importText")).toBeVisible();
});

test("exports graph data as a text file", async ({ page }) => {
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
