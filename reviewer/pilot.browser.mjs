import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workspace = resolve(process.env.TERMINOLOGY_REPO ?? process.cwd());
const playwright = pathToFileURL(join(workspace, "frontend", "node_modules", "@playwright", "test", "index.mjs"));
const { chromium } = await import(playwright.href);
const url = process.env.REVIEWER_URL;
if (!url || new URL(url).hostname !== "127.0.0.1") throw new Error("Set REVIEWER_URL to the local reviewer URL.");
const root = process.env.REVIEWER_VERIFY_DIR ?? await mkdtemp(join(tmpdir(), "terminology-reviewer-verify-"));
await mkdir(root, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 940, height: 950 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let submitted;
  await page.route("**/api/prs/14/send", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { id: 123, url: "https://github.com/lycho33/Terminology/pull/14#simulated-review" } });
  });
  await page.goto(url);
  await page.getByRole("heading", { name: "Open pull requests" }).waitFor();
  const list = await page.locator(".pull-list li").allTextContents();
  assert.ok(list.some((text) => text.includes("#14") && text.includes("Draft")));
  assert.ok(list.every((text) => text.includes("Draft") || text.includes("Open")));
  await page.screenshot({ path: root + "/01-open-pull-requests.png", fullPage: true });

  await page.getByRole("button", { name: /#14.*SVG/ }).click();
  await page.getByRole("heading", { name: "Behaviors", exact: true }).waitFor();
  assert.ok(await page.getByText("No related test found", { exact: true }).count() >= 1);
  assert.ok(await page.getByText("PR description", { exact: true }).isVisible());
  assert.ok(await page.locator(".component.changed").count() >= 5);
  await page.getByText("Preview, cancel, or save an edit", { exact: true }).click();
  await page.getByRole("button", { name: /SC-6 SVG: edit, cancel/ }).click();
  const fresh = page.waitForResponse((response) => response.url().endsWith("/api/prs/14/capture"), { timeout: 180_000 });
  await page.getByRole("button", { name: "Run browser test", exact: true }).click();
  const response = await fresh;
  const capture = await response.json();
  assert.ok(response.ok(), JSON.stringify(capture));
  assert.equal(capture.result, "passed");
  assert.deepEqual(Object.keys(capture.images), ["review-preview", "review-cancel", "edited-diagram"]);
  await page.getByText("Chromium passed", { exact: true }).waitFor();


  for (const [button, label] of [["Preview the draft", "Browser"], ["Cancel", "Client"], ["Refresh the saved view", "Browser"]]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    assert.equal(await page.locator(".checkpoint code").textContent(), label);
    const image = page.getByRole("img", { name: button + " from the Chromium browser test" });
    await image.waitFor();
    await page.waitForFunction(() => document.querySelector(".capture img")?.naturalWidth > 0);
  }
  await page.locator(".inspect-col").screenshot({ path: root + "/02-test-walkthrough.png" });

  await page.getByRole("textbox", { name: "Review note" }).fill("Selected verification note");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Invalidate other cached term details after a save", { exact: true }).click();
  await page.locator(".behavior").filter({ hasText: "Invalidate other cached term details after a save" })
    .getByRole("button", { name: "Add behavior note" }).click();
  await page.getByRole("textbox", { name: "Review note" }).fill("Unselected verification note");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("checkbox", { name: /Selected verification note/ }).check();
  await page.getByRole("button", { name: "Preview selected notes" }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.getByRole("dialog").getByText("Unselected verification note").count(), 0);
  await page.getByRole("dialog").screenshot({ path: root + "/03-preview-selected-notes.png" });
  await page.getByRole("button", { name: "Send to GitHub" }).click();
  await page.getByText("Selected notes sent.", { exact: true }).waitFor();
  assert.deepEqual(submitted.notes.map((note) => note.text), ["Selected verification note"]);
  assert.ok(await page.getByText("Unselected verification note", { exact: true }).isVisible());
  await writeFile(root + "/simulated-submission.json", JSON.stringify(submitted, null, 2));
  await page.setViewportSize({ width: 390, height: 850 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log("Verified the PR #14 browser walkthrough. Note submission was simulated.");
  console.log("Evidence: " + root);
} finally {
  await browser.close();
}
