import { test, expect } from "@playwright/test";
import {
  API,
  termUrl,
  newName,
  savedTerm,
  openCreate,
  openEdit,
} from "./support/helpers.mjs";

for (const operation of ["create", "update"]) {
  for (const blank of ["", "   \t"]) {
    test(`real-stack validation: ${operation} rejects ${blank ? "whitespace" : "empty"} name and recovers`, async ({
      page,
      request,
    }) => {
      await page.goto("/");
      const term =
        operation === "update"
          ? await savedTerm(request, "validation")
          : undefined;
      if (term) await openEdit(page, term);
      else await openCreate(page);
      const field = page.getByRole("textbox", {
        name: "Term name",
        exact: true,
      });
      await field.fill(blank);
      await page
        .getByRole("textbox", { name: "Definition", exact: true })
        .fill("Retain this input");
      const action = page.getByRole("button", {
        name: operation === "create" ? "Create" : "Update",
        exact: true,
      });
      const rejected = page.waitForResponse(
        (response) =>
          response.request().method() === (term ? "PATCH" : "POST") &&
          response.url().startsWith(`${API}/terms/`),
      );
      await action.click();
      const response = await rejected;
      expect(response.status()).toBe(422);
      expect((await response.json()).errors[0]).toMatchObject({
        code: "FIELD_BLANK",
        field: "name",
      });
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(field).toHaveAttribute(
        "aria-describedby",
        `${operation}-name-errors`,
      );
      await expect(page.getByRole("alert")).toHaveText(
        "Enter a value that is not blank.",
      );
      await expect(
        page.getByRole("textbox", { name: "Definition", exact: true }),
      ).toHaveValue("Retain this input");
      const corrected = newName("corrected");
      await field.fill(corrected);
      await expect(field).toHaveAttribute("aria-invalid", "false");
      await expect(page.getByRole("alert")).toHaveCount(0);
      await action.click();
      await expect(
        page.getByRole("heading", { name: corrected, exact: true }),
      ).toBeVisible();
    });
  }
}

const cases = [
  ["missing name", {}, "FIELD_REQUIRED", "name"],
  ["number name", { name: 12 }, "INVALID_TYPE", "name"],
  ["null name", { name: null }, "INVALID_TYPE", "name"],
  [
    "wrong definition",
    { name: "Valid", definition: 12 },
    "INVALID_TYPE",
    "definition",
  ],
  ["wrong diagram", { name: "Valid", diagram: {} }, "INVALID_TYPE", "diagram"],
  ["wrong body type", [], "INVALID_VALUE", null],
];
for (const [label, data, code, field] of cases) {
  test(`real HTTP validation: ${label}`, async ({ request }) => {
    const response = await request.post(`${API}/terms/`, { data });
    expect(response.status()).toBe(422);
    expect((await response.json()).errors[0]).toMatchObject({
      code,
      field,
      message: expect.any(String),
    });
  });
}

test("real HTTP validation: malformed JSON and multiple errors do not echo raw values", async ({
  request,
}) => {
  const malformed = await request.post(`${API}/terms/`, {
    // A Buffer bypasses Playwright's automatic JSON string encoding.
    data: Buffer.from("{"),
    headers: { "Content-Type": "application/json" },
  });
  expect(malformed.status()).toBe(422);
  expect((await malformed.json()).errors[0]).toMatchObject({
    code: "INVALID_JSON",
    field: null,
  });
  const multiple = await request.post(`${API}/terms/`, {
    data: { name: "", definition: 864209, diagram: {} },
  });
  expect(multiple.status()).toBe(422);
  const body = await multiple.json();
  expect(body.errors.map((error) => error.field)).toEqual([
    "name",
    "definition",
    "diagram",
  ]);
  expect(JSON.stringify(body)).not.toContain("864209");
  for (const error of body.errors)
    expect(Object.keys(error).sort()).toEqual(["code", "field", "message"]);
});

test("real HTTP update: omitted and null values preserve fields; empty text clears fields", async ({
  request,
}) => {
  const term = await savedTerm(request, "patch values", {
    definition: "Keep",
    diagram: "Keep diagram",
  });
  for (const data of [{}, { name: null, definition: null, diagram: null }]) {
    expect((await request.patch(termUrl(term.name), { data })).status()).toBe(
      200,
    );
    expect(await (await request.get(termUrl(term.name))).json()).toEqual(term);
  }
  const invalid = await request.patch(termUrl(term.name), {
    data: { name: 7, definition: [], diagram: false },
  });
  expect(invalid.status()).toBe(422);
  expect((await invalid.json()).errors.map((error) => error.field)).toEqual([
    "name",
    "definition",
    "diagram",
  ]);
  expect(
    (
      await request.patch(termUrl(term.name), {
        data: { definition: "", diagram: "" },
      })
    ).status(),
  ).toBe(200);
  expect(await (await request.get(termUrl(term.name))).json()).toEqual({
    ...term,
    definition: "",
    diagram: "",
  });
});
