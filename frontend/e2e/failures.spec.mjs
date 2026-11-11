import { test, expect } from "@playwright/test";
import {
  API,
  termUrl,
  newName,
  savedTerm,
  readTerm,
  lookup,
  openCreate,
  openEdit,
  openDelete,
  control,
  simulate,
} from "./support/helpers.mjs";

const databaseError = {
  detail: "The database operation failed.",
  errors: [
    {
      code: "DATABASE_ERROR",
      field: null,
      message: "The database operation failed.",
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

for (const operation of ["create", "read", "update", "delete"]) {
  test(`simulated response: ${operation} displays a form-level server error and recovers`, async ({
    page,
    request,
  }) => {
    const term = await savedTerm(request, `failure ${operation}`, {
      definition: "Saved",
    });
    const draft = newName("failed create");
    if (operation === "create") await openCreate(page, draft);
    if (operation === "update") await openEdit(page, term);
    if (operation === "delete") await openDelete(page, term);
    await simulate(
      page,
      { create: "POST", read: "GET", update: "PATCH", delete: "DELETE" }[
        operation
      ],
      databaseError,
    );
    if (operation === "read") await lookup(page, term.name);
    else {
      if (operation !== "delete")
        await page
          .getByRole("textbox", { name: "Definition", exact: true })
          .fill("Keep this draft");
      await page
        .getByRole("button", {
          name: { create: "Create", update: "Update", delete: "Delete" }[
            operation
          ],
          exact: true,
        })
        .click();
    }
    await expect(page.getByRole("alert")).toContainText(
      "The database operation failed.",
    );
    if (["create", "update"].includes(operation)) {
      await expect(
        page.getByRole("textbox", { name: "Definition", exact: true }),
      ).toHaveValue("Keep this draft");
      await expect(
        page.getByRole("textbox", { name: "Term name", exact: true }),
      ).toHaveValue(operation === "create" ? draft : term.name);
    }
    expect(await readTerm(request, term.name)).toEqual(term);
    await page.unrouteAll({ behavior: "wait" });
    if (operation === "read") {
      await page.reload();
      await lookup(page, term.name);
    } else
      await page
        .getByRole("button", {
          name: { create: "Create", update: "Update", delete: "Delete" }[
            operation
          ],
          exact: true,
        })
        .click();
    if (operation === "delete")
      await expect(page.getByRole("dialog")).toHaveCount(0);
    else
      await expect(
        page.getByRole("heading", {
          name: operation === "create" ? draft : term.name,
          exact: true,
        }),
      ).toBeVisible();
  });
}

test("simulated response: multiple field messages are linked to the correct inputs", async ({
  page,
}) => {
  await openCreate(page, newName("multiple"));
  await simulate(
    page,
    "POST",
    {
      detail: "Check the submitted fields.",
      errors: [
        { code: "INVALID_VALUE", field: "name", message: "Check the name." },
        {
          code: "INVALID_TYPE",
          field: "definition",
          message: "Check the definition.",
        },
        {
          code: "INVALID_TYPE",
          field: "diagram",
          message: "Check the diagram.",
        },
      ],
    },
    422,
  );
  await page.getByRole("button", { name: "Create", exact: true }).click();
  for (const [label, field] of [
    ["Term name", "name"],
    ["Definition", "definition"],
    ["Diagram", "diagram"],
  ]) {
    const input = page.getByRole("textbox", { name: label, exact: true });
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAttribute(
      "aria-describedby",
      `create-${field}-errors`,
    );
    await expect(page.locator(`#create-${field}-errors`)).toHaveText(
      `Check the ${field}.`,
    );
  }
});

for (const [label, body, contentType, expected] of [
  [
    "non-JSON",
    "<html>Unavailable</html>",
    "text/html",
    "Create failed. Try again.",
  ],
  [
    "malformed error entries",
    { errors: [null, { code: 4 }] },
    "application/json",
    "Create failed. Try again.",
  ],
  [
    "unknown field",
    {
      errors: [
        {
          code: "INVALID_VALUE",
          field: "future.field",
          message: "Check the additional value.",
        },
      ],
    },
    "application/json",
    "Check the additional value.",
  ],
]) {
  test(`simulated response: ${label} remains visible at form level`, async ({
    page,
  }) => {
    await openCreate(page, newName("fallback"));
    await simulate(page, "POST", body, 500, contentType);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(expected);
  });
}

test("real API outage: failed creation keeps input and recovers after restart", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const name = newName("api outage");
  await openCreate(page, name);
  await page
    .getByRole("textbox", { name: "Definition", exact: true })
    .fill("Unsaved input");
  try {
    await control("api/stop");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(/\S/);
    await expect(
      page.getByRole("textbox", { name: "Term name", exact: true }),
    ).toHaveValue(name);
    await expect(
      page.getByRole("textbox", { name: "Definition", exact: true }),
    ).toHaveValue("Unsaved input");
  } finally {
    await control("api/start");
  }
  expect((await request.get(termUrl(name))).status()).toBe(404);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
});

test("real API outage: lookup shows failure and recovers after restart", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const term = await savedTerm(request, "lookup outage");
  try {
    await control("api/stop");
    await lookup(page, term.name);
    await expect(page.getByRole("alert")).toContainText("Lookup failed", {
      timeout: 30_000,
    });
  } finally {
    await control("api/start");
  }
  await page.reload();
  await lookup(page, term.name);
  await expect(
    page.getByRole("heading", { name: term.name, exact: true }),
  ).toBeVisible();
});

test("real database outage: creation reports DATABASE_UNAVAILABLE and recovers", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const name = newName("database outage");
  await openCreate(page, name);
  await page
    .getByRole("textbox", { name: "Definition", exact: true })
    .fill("Keep while database is down");
  try {
    await control("db/stop");
    const rejected = page.waitForResponse(
      (response) =>
        response.url() === `${API}/terms/` &&
        response.request().method() === "POST",
      { timeout: 120_000 },
    );
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const response = await rejected;
    expect(response.status()).toBe(503);
    expect((await response.json()).errors[0]).toMatchObject({
      code: "DATABASE_UNAVAILABLE",
      field: null,
    });
    await expect(page.getByRole("alert")).toHaveText(
      "The database is unavailable. Try again.",
    );
    await expect(
      page.getByRole("textbox", { name: "Definition", exact: true }),
    ).toHaveValue("Keep while database is down");
  } finally {
    await control("db/start");
  }
  expect((await request.get(termUrl(name))).status()).toBe(404);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
});
