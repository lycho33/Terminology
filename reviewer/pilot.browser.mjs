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
  const page = await browser.newPage({ viewport: { width: 853, height: 802 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let submitted;
  await page.route("**/api/prs/14/send", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { id: 123, url: "https://github.com/lycho33/Terminology/pull/14#simulated-review" } });
  });
  const releaseList = Promise.withResolvers();
  await page.route("**/api/prs", async (route) => {
    await releaseList.promise;
    await route.continue();
  });

  await page.goto(url);
  const map = page.getByRole("region", { name: "Architecture map" });
  await map.waitFor();
  for (const name of ["Frontend", "API", "Knowledge graph"]) {
    assert.ok(await map.getByRole("heading", { name, exact: true }).isVisible());
  }
  assert.equal(await page.locator(".board > *").first().getAttribute("id"), "board-map");
  assert.equal(await map.locator(".region-changed").count(), 0);
  releaseList.resolve();

  const picker = page.getByRole("combobox", { name: "Pull request" });
  await picker.locator('option[value="14"]').waitFor({ state: "attached" });
  const options = await picker.locator("option[value]:not([value=''])").allTextContents();
  assert.ok(options.some((text) => text.includes("#14") && text.includes("Draft")));
  assert.ok(options.every((text) => / · (Draft|Open) · /.test(text)));
  await page.screenshot({ path: root + "/01-architecture-map.png" });

  await picker.selectOption("14");
  const sidebar = page.getByRole("complementary", { name: "Review sidebar" });
  await sidebar.getByRole("heading", { name: "Behaviors", exact: true }).waitFor();
  await sidebar.getByText("PR #14 · Draft", { exact: true }).click();
  assert.ok(await page.getByText("No related test found", { exact: true }).count() >= 1);
  assert.ok(await page.getByText("PR description", { exact: true }).isVisible());
  for (const region of ["frontend", "api"]) {
    assert.ok(await map.locator('[data-region="' + region + '"].region-changed').count());
  }
  assert.ok(await map.locator('[data-region="graph"]').getByText("No direct changes").isVisible());
  assert.ok(await map.getByText("Other changed areas", { exact: false }).isVisible());
  await page.screenshot({ path: root + "/01-architecture-pr14.png" });

  const editorChanges = map.locator("details.map-module").filter({
    has: page.getByText("Term editor", { exact: true }),
  });
  await editorChanges.locator("summary").click();
  const file = editorChanges.getByRole("link", { name: "DiagramField.tsx", exact: true });
  assert.ok(await file.isVisible());
  assert.match(await file.getAttribute("href"), /\/blob\/cfc2d1054619f4bcd0fbb6afa278f2985fa5891c\/frontend\/src\/diagram\/DiagramField\.tsx#L1$/);
  assert.ok((await editorChanges.getByRole("link").allTextContents()).every((label) => !label.includes("/")));
  await map.screenshot({ path: root + "/01-changed-file-names.png" });

  const editTest = sidebar.getByRole("button", { name: /SC-6 SVG: edit, cancel/ });
  assert.equal(await editTest.isVisible(), false);
  await sidebar.getByText("Preview, cancel, or save an edit", { exact: true }).click();
  await editTest.click();
  assert.equal(await editTest.getAttribute("aria-pressed"), "true");
  const walkthrough = page.getByRole("region", { name: "Test walkthrough" });
  await walkthrough.waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  const code = walkthrough.getByRole("region", { name: "Implementation code" });
  const values = walkthrough.getByRole("region", { name: "Test values" });
  const chooseStep = async (title) => {
    const picker = walkthrough.getByRole("combobox", { name: "Walkthrough step" });
    const labels = await picker.locator("option").allTextContents();
    const label = labels.find((item) => item.endsWith(" · " + title));
    assert.ok(label, "Missing walkthrough step " + title);
    await picker.selectOption({ label });
  };
  assert.equal(await map.locator(".region-on-route").count(), 3);
  assert.equal(await map.locator(".region-active").getAttribute("data-region"), "frontend");
  assert.ok(await map.getByText("Saved SVG · Client", { exact: true }).isVisible());
  const sidebarBounds = await sidebar.boundingBox();
  const mapBounds = await map.boundingBox();
  assert.ok(sidebarBounds.x + sidebarBounds.width < mapBounds.x);
  await code.getByText("const [newDiagram, setNewDiagram]", { exact: false }).waitFor();
  assert.match(await values.innerText(), /exampleSvg contains <title>Client<\/title>/);
  assert.equal(await map.locator("[data-current-file]").getAttribute("data-current-file"), "frontend/src/terms/Term.tsx");
  await code.getByRole("button", { name: /Show connected-shapes.svg/ }).click();
  assert.equal(await map.locator("[data-current-file]").getAttribute("data-current-file"), "docs/skill-graph/examples/connected-shapes.svg");
  await walkthrough.getByRole("button", { name: "Next", exact: true }).click();
  assert.ok(await map.getByText("Draft SVG · Browser", { exact: true }).isVisible());
  assert.match(await values.innerText(), /<title>Browser<\/title>/);
  await walkthrough.getByRole("button", { name: "Previous", exact: true }).click();
  assert.ok(await map.getByText("Saved SVG · Client", { exact: true }).isVisible());
  const fresh = page.waitForResponse((response) => response.url().endsWith("/api/prs/14/capture"), { timeout: 180_000 });
  await page.getByRole("button", { name: "Run browser test", exact: true }).click();
  const response = await fresh;
  const capture = await response.json();
  assert.ok(response.ok(), JSON.stringify(capture));
  assert.equal(capture.result, "passed");
  assert.deepEqual(Object.keys(capture.images), ["review-preview", "review-cancel", "edited-diagram"]);
  await page.getByText("Chromium passed", { exact: true }).waitFor();

  for (const [button, label] of [["Preview the draft", "Browser"], ["Cancel", "Client"], ["Refresh the saved view", "Browser"]]) {
    await chooseStep(button);
    assert.match(await values.innerText(), new RegExp(label));
    const image = page.getByRole("img", { name: button + " from the Chromium browser test" });
    await image.waitFor();
    await page.waitForFunction(() => document.querySelector(".capture img")?.naturalWidth > 0);
  }
  await chooseStep("Send an update");
  assert.ok(await map.getByText("PATCH carries Browser SVG", { exact: true }).isVisible());
  await code.getByText('method: "PATCH"', { exact: false }).waitFor();
  assert.match(await values.innerText(), /JSON body diagram = changed/);
  await chooseStep("Validate the update");
  assert.equal(await map.locator(".region-active").getAttribute("data-region"), "api");
  assert.equal(await map.locator(".active-edge").count(), 1);
  await chooseStep("Store the updated SVG");
  assert.equal(await map.locator(".region-active").getAttribute("data-region"), "graph");
  assert.ok(await map.getByText("Stored SVG · Browser", { exact: true }).isVisible());
  await page.locator("#board-map").scrollIntoViewIfNeeded();
  await page.screenshot({ path: root + "/02-test-walkthrough.png" });
  await code.getByText("t.diagram = CASE WHEN", { exact: false }).waitFor();
  assert.match(await values.innerText(), /Stored SVG contains <title>Browser<\/title>/);
  await chooseStep("Refresh the saved view");
  assert.equal(await map.locator(".region-active").getAttribute("data-region"), "frontend");
  assert.equal(await map.locator('[data-direction="return"]').count(), 2);


  await walkthrough.getByText("Add review note", { exact: true }).click();
  await walkthrough.getByRole("textbox", { name: "Review note" }).fill("Selected verification note");
  await walkthrough.getByRole("button", { name: "Save draft" }).click();
  const gap = sidebar.locator(".behavior").filter({ hasText: "Invalidate other cached term details after a save" });
  await gap.locator("summary").first().click();
  await gap.getByRole("button", { name: "Add behavior note" }).click();
  const behaviorNote = page.getByRole("dialog", { name: "Behavior note" });
  await behaviorNote.getByRole("textbox", { name: "Review note" }).fill("Unselected verification note");
  await behaviorNote.getByRole("button", { name: "Save draft" }).click();
  await behaviorNote.getByRole("button", { name: "Close walkthrough" }).click();
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

  await sidebar.getByText("Preview and save supported SVG without interaction metadata", { exact: true }).click();
  await sidebar.getByRole("button", { name: "SC-1 SVG: paste and preview before saving", exact: true }).click();
  const replay = walkthrough.getByRole("region", { name: "Workflow replay" });
  await replay.getByText("Paste SVG code here.", { exact: true }).waitFor();
  const selector = await walkthrough.getByRole("combobox", { name: "Walkthrough step" }).boundingBox();
  assert.ok(selector.width > 115);
  const verifyNextKeepsViewport = async (captureViewport = false) => {
    await chooseStep("Open the Create term form");
    await code.getByText("Initialize the create form", { exact: true }).waitFor();
    const next = walkthrough.getByRole("button", { name: "Next", exact: true });
    await next.evaluate((button) => window.scrollBy(0, button.getBoundingClientRect().top - 96));
    const offset = () => page.evaluate(() => [window.scrollX, window.scrollY]);
    const before = await offset();
    assert.ok(before[1] > 0);
    if (captureViewport) await page.screenshot({ path: root + "/02-before-next.png" });
    await next.click();
    await code.getByText("Forward the textarea value", { exact: true }).waitFor();
    assert.deepEqual(await offset(), before, "Next must keep the viewport coordinates");
    if (captureViewport) await page.screenshot({ path: root + "/02-after-next.png", animations: "disabled" });
  };
  await verifyNextKeepsViewport(true);
  await chooseStep("Open the Create term form");
  await walkthrough.getByRole("button", { name: "Play workflow", exact: true }).click();
  const activeReplayNode = replay.locator('[aria-current="step"]');
  const replayState = replay.locator(".replay-state");
  const highlightedLine = code.locator(".current-code-line");

  await replay.locator('[data-stage="paste"] pre').waitFor();
  assert.match(await replay.locator("pre").textContent(), /data-diagram-version="1"/);
  assert.equal(await activeReplayNode.getAttribute("data-node"), "field");
  assert.equal(await replay.locator(".replay-edge-active").count(), 1);

  await replay.locator('[data-stage="store"]').waitFor();
  assert.equal(await activeReplayNode.getAttribute("data-node"), "form");
  assert.equal(await replay.locator(".replay-edge-active").getAttribute("data-direction"), "return");
  assert.match(await replayState.innerText(), /newDiagram\s+exampleSvg[\s\S]+mode\s+code/);
  await highlightedLine.filter({ hasText: "setNewDiagram(value)" }).waitFor();

  await replay.locator('[data-stage="parse"]').waitFor();
  assert.equal(await activeReplayNode.getAttribute("data-node"), "field");
  assert.match(await activeReplayNode.innerText(), /value=\{exampleSvg\}/);
  assert.match(await replayState.innerText(), /parsed\.diagram\s+Client → Server[\s\S]+mode\s+code/);
  await code.locator('.current-code-line[data-line="311"]').waitFor();

  await replay.locator('[data-stage="mode"]').waitFor();
  assert.match(await replayState.innerText(), /mode\s+preview/);
  assert.equal(await replay.locator(".replay-diagram").count(), 0);
  await code.locator('.current-code-line[data-line="350"]').waitFor();

  const diagram = replay.getByLabel("Diagram preview", { exact: true });
  await diagram.getByText("Server", { exact: true }).waitFor();
  assert.ok(await diagram.getByText("Client", { exact: true }).isVisible());
  assert.equal(await activeReplayNode.getAttribute("data-node"), "viewer");
  await code.locator('.current-code-line[data-line="375"]').getByText("diagram={parsed.diagram}", { exact: false }).waitFor();
  const currentFile = map.locator("[data-current-file]");
  assert.equal(await currentFile.getAttribute("data-current-file"), "frontend/src/diagram/DiagramField.tsx");
  assert.match(await currentFile.getByRole("link").getAttribute("href"), /#L375$/);
  assert.match(await values.innerText(), /POST count = 0/);
  await page.locator("#board-map").scrollIntoViewIfNeeded();
  await page.screenshot({ path: root + "/02-create-preview-replay.png", fullPage: true, animations: "disabled" });

  const createCapture = page.waitForResponse((response) => response.url().endsWith("/api/prs/14/capture"), { timeout: 180_000 });
  await walkthrough.getByRole("button", { name: "Run browser test", exact: true }).click();
  const createResult = await (await createCapture).json();
  assert.equal(createResult.result, "passed");
  assert.ok(createResult.images["preview-before-save"]);
  await walkthrough.getByRole("img", { name: /^Display DiagramViewer from the Chromium browser test$/ }).waitFor();
  assert.equal(await map.locator(".region-on-route").count(), 1);
  assert.equal(await map.locator(".region-active").getAttribute("data-region"), "frontend");
  assert.equal(await editTest.getAttribute("aria-pressed"), "false");

  await page.setViewportSize({ width: 390, height: 850 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await replay.evaluate((node) => node.scrollWidth <= node.clientWidth));
  await chooseStep("Run handleDiagramChange");
  assert.ok(await replay.evaluate((node) => node.scrollWidth <= node.clientWidth));
  await verifyNextKeepsViewport();
  await editTest.click();
  await walkthrough.waitFor();
  assert.ok(await walkthrough.evaluate((item) => item.scrollWidth <= item.clientWidth));
  await code.getByText("const [newDiagram, setNewDiagram]", { exact: false }).waitFor();
  const excerptsFit = await code.locator("pre").evaluateAll((items) =>
    items.every((item) => item.scrollWidth <= item.clientWidth));
  assert.ok(excerptsFit);
  await walkthrough.screenshot({ path: root + "/02-test-walkthrough-narrow.png" });
  assert.deepEqual(errors, []);
  console.log("Verified the PR #14 browser walkthrough. Note submission was simulated.");
  console.log("Evidence: " + root);
} finally {
  await browser.close();
}
