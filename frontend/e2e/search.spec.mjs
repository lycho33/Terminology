import { test, expect } from "@playwright/test";
import { API, savedTerm, newName, lookup, control, holdWrite } from "./support/helpers.mjs";

const searchInput = (page) => page.getByRole("textbox", { name: "Search Term", exact: true });
const searchRoute = (url) => url.origin === API && url.pathname === "/terms/" && url.searchParams.has("q");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("real-stack: partial search trims input, ignores case, and selects a matching term", async ({ page, request }) => {
  const fragment = newName("CAFÉ & ?# / graph");
  const first = await savedTerm(request, `${fragment} first`, { definition: "First result details" });
  const second = await savedTerm(request, `${fragment} second`);
  const input = `  ${fragment.toUpperCase()}  `;
  const responsePromise = page.waitForResponse((response) => searchRoute(new URL(response.url())));
  await lookup(page, input);
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(new URL(response.url()).searchParams.get("q")).toBe(input.trim());
  expect((await response.json()).map((term) => term.id).sort()).toEqual([first.id, second.id].sort());
  await expect(page.getByRole("button", { name: first.name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: second.name, exact: true })).toBeVisible();
  await expect(searchInput(page)).toHaveValue(input);
  await page.getByRole("button", { name: first.name, exact: true }).click();
  await expect(page.getByRole("button", { name: `Edit ${first.name}`, exact: true })).toBeVisible();
  await expect(page.getByText("First result details", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Matching terms")).toHaveCount(0);
});

test("real-stack: blank search has an accessible message and accepts a correction", async ({ page, request }) => {
  const term = await savedTerm(request, "blank correction");
  const calls = [];
  page.on("request", (req) => { if (searchRoute(new URL(req.url()))) calls.push(req.url()); });
  await lookup(page, "   ");
  await expect(page.getByRole("alert")).toHaveText("Enter a term to search.");
  await expect(searchInput(page)).toHaveAttribute("aria-invalid", "true");
  await expect(searchInput(page)).toHaveAttribute("aria-describedby", "search-term-error");
  expect(calls).toHaveLength(0);
  await lookup(page, term.name);
  await expect(page.getByRole("button", { name: term.name, exact: true })).toBeVisible();
  await expect(searchInput(page)).toHaveAttribute("aria-invalid", "false");
  await expect(searchInput(page)).not.toHaveAttribute("aria-describedby");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(calls).toHaveLength(1);
});

test("real-stack delayed request: pending search prevents duplicate submission", async ({ page, request }) => {
  const term = await savedTerm(request, "pending search");
  const hold = await holdWrite(page, "GET");
  try {
    await lookup(page, term.name);
    await hold.arrived;
    await expect(page.getByRole("button", { name: "Searching...", exact: true })).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Searching...");
    await searchInput(page).press("Enter");
    expect(hold.count()).toBe(1);
  } finally {
    hold.release();
  }
  await expect(page.getByRole("button", { name: term.name, exact: true })).toBeVisible();
  expect(hold.count()).toBe(1);
});

for (const [label, status, body, message] of [
  ["server error", 503, { detail: "The database is unavailable. Try again.", errors: [{ code: "DATABASE_UNAVAILABLE", field: null, message: "The database is unavailable. Try again." }] }, "The database is unavailable. Try again."],
  ["unknown 404", 404, { detail: "Search route unavailable.", errors: [{ code: "ROUTE_NOT_FOUND", field: null, message: "Search route unavailable." }] }, "Search route unavailable."],
  ["non-JSON error", 500, "<html>Unavailable</html>", "Search failed. Try again."],
  ["malformed JSON", 200, "{", "The search service returned an invalid response. Try again."],
  ["non-array success", 200, {}, "The search service returned an invalid response. Try again."],
  ["invalid term entries", 200, [null, { id: 1, name: false }], "The search service returned an invalid response. Try again."],
  ["network failure", null, null, "Unable to reach the search service. Try again."],
]) {
  test(`simulated response: search ${label} retains input and recovers with manual retry`, async ({ page, request }) => {
    const term = await savedTerm(request, `search ${label}`);
    let calls = 0;
    await page.route(searchRoute, async (route) => {
      calls++;
      if (status === null) return route.abort("failed");
      await route.fulfill({ status, contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
    });
    await lookup(page, term.name);
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(searchInput(page)).toHaveValue(term.name);
    // A second submit of the same query must issue another request.
    await lookup(page, term.name);
    await expect.poll(() => calls).toBe(2);
    await expect(page.getByRole("alert")).toContainText(message);
    await page.unrouteAll({ behavior: "wait" });
    await page.getByRole("button", { name: "Retry search", exact: true }).click();
    await expect(page.getByRole("button", { name: term.name, exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(searchInput(page)).toHaveValue(term.name);
  });
}

test("simulated response: an empty search result is not a service failure", async ({ page }) => {
  await page.route(searchRoute, (route) => route.fulfill({ json: [] }));
  await lookup(page, "no matches");
  await expect(page.getByRole("status")).toHaveText("No terms match “no matches”. Try a different search.");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(searchInput(page)).toHaveValue("no matches");
});

test("real database outage: search retains input and recovers with retry", async ({ page, request }) => {
  test.setTimeout(180_000);
  const term = await savedTerm(request, "database search outage");
  try {
    await control("db/stop");
    const rejected = page.waitForResponse((response) => searchRoute(new URL(response.url())), { timeout: 120_000 });
    await lookup(page, term.name);
    const response = await rejected;
    expect(response.status()).toBe(503);
    expect((await response.json()).errors[0].code).toBe("DATABASE_UNAVAILABLE");
    await expect(page.getByRole("alert")).toContainText("The database is unavailable. Try again.");
    await expect(searchInput(page)).toHaveValue(term.name);
  } finally {
    await control("db/start");
  }
  await page.getByRole("button", { name: "Retry search", exact: true }).click();
  await expect(page.getByRole("button", { name: term.name, exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
