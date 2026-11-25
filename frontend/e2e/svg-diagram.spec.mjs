import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  API,
  exampleSvg,
  newName,
  savedTerm,
  readTerm,
  showTerm,
  openCreate,
  openEdit,
  termUrl,
} from "./support/helpers.mjs";

const sourceInput = (page) =>
  page.getByRole("textbox", { name: "Diagram", exact: true });
const shape = (page, id) => page.locator(`[data-shape-id="${id}"]`);
const connection = (page) => page.locator('line[data-source="client"]');
const evidence = async (page, info, name) => {
  await page.locator(".diagram").scrollIntoViewIfNeeded();
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
};
async function drag(page, element, dx, dy) {
  await element.scrollIntoViewIfNeeded();
  const box = await element.boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}
async function geometry(page) {
  return connection(page).evaluate((el) =>
    ["x1", "y1", "x2", "y2"].map((k) => Number(el.getAttribute(k))),
  );
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("SC-1 SVG: paste and preview before saving", async ({ page }, info) => {
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().startsWith(`${API}/terms/`)) writes++;
  });
  await openCreate(page, "SVG preview example");
  await sourceInput(page).fill(exampleSvg);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(shape(page, "client")).toBeVisible();
  await expect(shape(page, "server")).toBeVisible();
  await expect(connection(page)).toHaveAttribute(
    "marker-end",
    /url\(#.+-arrow\)/,
  );
  expect(writes).toBe(0);
  await evidence(page, info, "preview-before-save");
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(sourceInput(page)).toHaveValue(exampleSvg);
});

test("SC-2 SVG: save, reopen, and copy exact source", async ({
  page,
  request,
}, info) => {
  const name = newName("SVG source");
  const source = `\n  ${exampleSvg.replace("Client</title>", "Client café &amp; tea</title>")}\n`;
  await openCreate(page, name);
  await sourceInput(page).fill(source);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(shape(page, "client")).toBeVisible();
  const saved = await readTerm(request, name);
  expect(saved.diagram).toBe(source);
  await page.reload();
  await showTerm(page, saved);
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(sourceInput(page)).toHaveValue(source);
  await expect(sourceInput(page)).toHaveAttribute("readonly", "");
  // Capture the clipboard boundary deterministically in both browser engines.
  await page.evaluate(() => {
    globalThis.copiedSvg = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          globalThis.copiedSvg = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy SVG", exact: true }).click();
  expect(await page.evaluate(() => globalThis.copiedSvg)).toBe(source);
  await expect(page.getByRole("status")).toHaveText("SVG copied.");
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Denied");
    };
  });
  await page.getByRole("button", { name: "Copy SVG", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("copy it manually");
  await expect(sourceInput(page)).toHaveValue(source);
  await evidence(page, info, "saved-source");
});

test("SC-3 SVG: zoom, pan, reset, and narrow layout", async ({
  page,
  request,
}, info) => {
  const term = await savedTerm(request, "SVG view", { diagram: exampleSvg });
  await showTerm(page, term);
  await page.getByRole("button", { name: "Zoom in", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-viewport]")).toHaveAttribute(
    "transform",
    /scale\(1.25\)/,
  );
  await page.locator(".diagram__canvas").scrollIntoViewIfNeeded();
  const canvas = await page.locator(".diagram__canvas").boundingBox();
  await page.mouse.move(canvas.x + 10, canvas.y + 10);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 35, canvas.y + 25);
  await page.mouse.up();
  await expect(page.locator("[data-viewport]")).not.toHaveAttribute(
    "transform",
    "translate(0 0) scale(1.25)",
  );
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect(page.locator("[data-viewport]")).toHaveAttribute(
    "transform",
    "translate(0 0) scale(1)",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  await expect(shape(page, "client")).toBeVisible();
  await evidence(page, info, "narrow-diagram");
});

test("SC-4 SVG: temporary shape movement keeps connections after zoom and pan", async ({
  page,
  request,
}, info) => {
  const term = await savedTerm(request, "SVG drag", { diagram: exampleSvg });
  await showTerm(page, term);
  const before = await geometry(page);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.locator(".diagram__canvas").scrollIntoViewIfNeeded();
  const canvas = await page.locator(".diagram__canvas").boundingBox();
  await page.mouse.move(canvas.x + 10, canvas.y + 10);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 20, canvas.y + 15);
  await page.mouse.up();
  await drag(page, shape(page, "client"), 30, 20);
  const after = await geometry(page);
  expect(after[0]).toBeGreaterThan(before[0]);
  expect(after[1]).toBeGreaterThan(before[1]);
  expect(after.slice(2)).toEqual(before.slice(2));
  const translate = await shape(page, "client").getAttribute("transform");
  const values = translate.match(/[-\d.]+/g).map(Number);
  expect(after[0] - before[0]).toBeCloseTo(values[0] - 30, 5);
  expect(after[1] - before[1]).toBeCloseTo(values[1] - 60, 5);
  await expect(page.getByRole("region", { name: "Shape details" })).toHaveCount(
    0,
  );
  await shape(page, "server").focus();
  await page.keyboard.press("ArrowLeft");
  const movedTarget = await geometry(page);
  expect(movedTarget[2]).toBe(before[2] - 10);
  await evidence(page, info, "moved-with-connection");
  expect((await readTerm(request, term.name)).diagram).toBe(exampleSvg);
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(sourceInput(page)).toHaveValue(exampleSvg);
  await page.reload();
  await showTerm(page, term);
  expect(await geometry(page)).toEqual(before);
  await openEdit(page, term);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await drag(page, shape(page, "client"), 20, 10);
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Update", exact: true }),
  ).toHaveCount(0);
  expect((await readTerm(request, term.name)).diagram).toBe(exampleSvg);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  expect(await geometry(page)).toEqual(before);
});

test("SC-5 SVG: shape details come from pasted descriptions", async ({
  page,
  request,
}, info) => {
  const term = await savedTerm(request, "SVG details", { diagram: exampleSvg });
  await showTerm(page, term);
  await shape(page, "client").click();
  await expect(
    page.getByRole("region", { name: "Shape details" }),
  ).toContainText("The client sends a request to the server.");
  await shape(page, "server").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Shape details" }),
  ).toContainText("The server processes the request and returns a response.");
  await evidence(page, info, "selected-shape-details");
});

test("SC-6 SVG: edit, cancel, and save new source", async ({
  page,
  request,
}, info) => {
  const term = await savedTerm(request, "SVG edit", { diagram: exampleSvg });
  const changed = exampleSvg.replaceAll("Client", "Browser");
  await openEdit(page, term);
  await sourceInput(page).fill(changed);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show details for Browser" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel update", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Show details for Client" }),
  ).toBeVisible();
  expect((await readTerm(request, term.name)).diagram).toBe(exampleSvg);
  await openEdit(page, term);
  await sourceInput(page).fill(changed);
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show details for Browser" }),
  ).toBeVisible();
  expect((await readTerm(request, term.name)).diagram).toBe(changed);
  await evidence(page, info, "edited-diagram");
});

const cases = JSON.parse(
  readFileSync(
    new URL("../../tests/fixtures/svg-cases.json", import.meta.url),
    "utf8",
  ),
);
test("SC-7 SVG: invalid input is retained and can be corrected", async ({
  page,
  request,
}, info) => {
  const name = newName("SVG recovery");
  await openCreate(page, name);
  for (const item of cases) {
    await sourceInput(page).fill(item.source);
    if (item.valid) await expect(page.getByRole("alert")).toHaveCount(0);
    else {
      await expect(page.getByRole("alert")).toBeVisible();
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(sourceInput(page)).toHaveValue(item.source);
      const response = await request.post(`${API}/terms/`, {
        data: { name, diagram: item.source },
      });
      expect(response.status(), item.name).toBe(422);
    }
  }
  await sourceInput(page).fill(
    exampleSvg.replace('data-target="server"', 'data-target="missing"'),
  );
  await evidence(page, info, "broken-connection-error");
  await sourceInput(page).fill(exampleSvg);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(shape(page, "client")).toBeVisible();
});

test("SC-8 SVG: clear the optional diagram", async ({
  page,
  request,
}, info) => {
  const term = await savedTerm(request, "SVG clear", { diagram: exampleSvg });
  await openEdit(page, term);
  await sourceInput(page).fill("");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(
    page.getByText("No diagram saved yet.", { exact: true }),
  ).toBeVisible();
  expect((await readTerm(request, term.name)).diagram).toBe("");
  await evidence(page, info, "empty-diagram");
});

test("SC-9 SVG: simulated legacy read preserves old text for correction", async ({
  page,
  request,
}, info) => {
  const term = await savedTerm(request, "SVG legacy");
  await page.route(termUrl(term.name), async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { ...term, diagram: "Legacy plain text" } });
    return route.continue();
  });
  await showTerm(page, term);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(sourceInput(page)).toHaveValue("Legacy plain text");
  await page
    .getByRole("button", { name: `Edit ${term.name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(sourceInput(page)).toHaveValue("Legacy plain text");
  await evidence(page, info, "legacy-text-preserved");
  await page.unrouteAll({ behavior: "wait" });
  await sourceInput(page).fill(exampleSvg);
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(shape(page, "client")).toBeVisible();
  expect((await readTerm(request, term.name)).diagram).toBe(exampleSvg);
});
