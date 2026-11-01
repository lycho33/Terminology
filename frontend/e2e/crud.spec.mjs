import { test, expect } from "@playwright/test";
import {
  API,
  termUrl,
  newName,
  normalized,
  savedTerm,
  readTerm,
  lookup,
  showTerm,
  openCreate,
  openEdit,
  openDelete,
  control,
  holdWrite,
} from "./support/helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("real-stack: create required fields and read after reload", async ({
  page,
  request,
}) => {
  const name = newName("required");
  await openCreate(page, name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const saved = await readTerm(request, name);
  expect(saved.id).toMatch(/^[a-f0-9]{32}$/);
  expect(saved.definition).toBeNull();
  expect(saved.diagram).toBeNull();
  await page.reload();
  await showTerm(page, saved);
  await expect(
    page.getByText("No definition saved yet.", { exact: true }),
  ).toBeVisible();
});

test("real-stack: trim, normalize, and preserve Unicode and URL-sensitive names", async ({
  page,
  request,
}) => {
  const input = `  ${newName("CAFÉ / HTTP? #100% & SQL")}  `;
  const name = normalized(input);
  await openCreate(page, input);
  await page
    .getByRole("textbox", { name: "Definition", exact: true })
    .fill("  Saved definition  ");
  await page
    .getByRole("textbox", { name: "Diagram", exact: true })
    .fill("  A -> B  ");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const saved = await readTerm(request, name);
  expect(saved).toMatchObject({
    name,
    definition: "Saved definition",
    diagram: "A -> B",
  });
  await page.reload();
  await showTerm(page, saved);
  await expect(
    page.getByText("Saved definition", { exact: true }),
  ).toBeVisible();
});

test("real-stack: missing lookup is distinct from a server failure", async ({
  page,
}) => {
  await lookup(page, newName("missing"));
  await expect(
    page.getByText("No term card is available for this lookup yet."),
  ).toBeVisible();
  await expect(page.getByText("Lookup failed", { exact: true })).toHaveCount(0);
});

test("real-stack: duplicate creation is rejected without overwriting data", async ({
  page,
  request,
}) => {
  const term = await savedTerm(request, "duplicate", {
    definition: "Original",
  });
  await openCreate(page, term.name.toUpperCase());
  await page
    .getByRole("textbox", { name: "Definition", exact: true })
    .fill("Replacement");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "A term with this name already exists.",
  );
  await expect(
    page.getByRole("textbox", { name: "Term name", exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  expect(await readTerm(request, term.name)).toEqual(term);
});

test("real-stack: rename and edit preserve the ID; clear optional text", async ({
  page,
  request,
}) => {
  const term = await savedTerm(request, "before", {
    definition: "Before",
    diagram: "Old",
  });
  const name = newName("after");
  await openEdit(page, term);
  await page
    .getByRole("textbox", { name: "Term name", exact: true })
    .fill(name);
  await page
    .getByRole("textbox", { name: "Definition", exact: true })
    .fill("After");
  await page.getByRole("textbox", { name: "Diagram", exact: true }).fill("New");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  expect(await readTerm(request, name)).toEqual({
    ...term,
    name,
    definition: "After",
    diagram: "New",
  });
  expect((await request.get(termUrl(term.name))).status()).toBe(404);
  await openEdit(page, { ...term, name });
  await page.getByRole("textbox", { name: "Definition", exact: true }).fill("");
  await page.getByRole("textbox", { name: "Diagram", exact: true }).fill("");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  expect(await readTerm(request, name)).toMatchObject({
    id: term.id,
    definition: "",
    diagram: "",
  });
});

test("real-stack: cancel edits leaves saved data unchanged", async ({
  page,
  request,
}) => {
  const term = await savedTerm(request, "cancel", { definition: "Original" });
  await openEdit(page, term);
  await page
    .getByRole("textbox", { name: "Term name", exact: true })
    .fill(newName("unsaved"));
  await page
    .getByRole("textbox", { name: "Definition", exact: true })
    .fill("Unsaved");
  await page
    .getByRole("button", { name: "Cancel update", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: term.name, exact: true }),
  ).toBeVisible();
  expect(await readTerm(request, term.name)).toEqual(term);
});

test("real-stack: duplicate rename preserves both records", async ({
  page,
  request,
}) => {
  const first = await savedTerm(request, "rename first");
  const second = await savedTerm(request, "rename second");
  await openEdit(page, first);
  await page
    .getByRole("textbox", { name: "Term name", exact: true })
    .fill(second.name);
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "A term with this name already exists.",
  );
  expect(await readTerm(request, first.name)).toEqual(first);
  expect(await readTerm(request, second.name)).toEqual(second);
});

test("real-stack: a term deleted during editing gives a form error", async ({
  page,
  request,
}) => {
  const term = await savedTerm(request, "stale edit");
  await openEdit(page, term);
  expect((await request.delete(termUrl(term.id))).status()).toBe(200);
  await page
    .getByRole("textbox", { name: "Definition", exact: true })
    .fill("Keep this draft");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Term not found.");
  await expect(
    page.getByRole("textbox", { name: "Definition", exact: true }),
  ).toHaveValue("Keep this draft");
});

test("real-stack: cancel then confirm deletion, including attached relationships", async ({
  page,
  request,
}) => {
  const term = await savedTerm(request, "delete");
  const other = await savedTerm(request, "linked");
  await control("db/link", { first: term.id, second: other.id });
  let dialog = await openDelete(page, term);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await readTerm(request, term.name)).toEqual(term);
  dialog = await openDelete(page, term);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: term.name, exact: true }),
  ).toHaveCount(0);
  expect((await request.get(termUrl(term.name))).status()).toBe(404);
  const repeated = await request.delete(termUrl(term.id));
  expect(repeated.status()).toBe(404);
  expect((await repeated.json()).errors[0].code).toBe("TERM_NOT_FOUND");
  expect(await readTerm(request, other.name)).toEqual(other);
  await page.reload();
  await lookup(page, term.name);
  await expect(
    page.getByText("No term card is available for this lookup yet."),
  ).toBeVisible();
});

for (const operation of ["create", "update", "delete"]) {
  test(`real-stack delayed request: ${operation} prevents duplicate submission`, async ({
    page,
    request,
  }) => {
    const term =
      operation === "create"
        ? { name: newName("pending") }
        : await savedTerm(request, "pending");
    if (operation === "create") await openCreate(page, term.name);
    if (operation === "update") await openEdit(page, term);
    if (operation === "delete") await openDelete(page, term);
    const method = { create: "POST", update: "PATCH", delete: "DELETE" }[
      operation
    ];
    const hold = await holdWrite(page, method);
    try {
      await page
        .getByRole("button", {
          name: { create: "Create", update: "Update", delete: "Delete" }[
            operation
          ],
          exact: true,
        })
        .click();
      await hold.arrived;
      await expect(
        page.getByRole("button", {
          name: {
            create: "Creating...",
            update: "Updating...",
            delete: "Deleting...",
          }[operation],
          exact: true,
        }),
      ).toBeDisabled();
      if (operation !== "delete") {
        for (const name of ["Term name", "Definition", "Diagram"])
          await expect(
            page.getByRole("textbox", { name, exact: true }),
          ).toBeDisabled();
      }
      await page.keyboard.press("Enter");
      expect(hold.count()).toBe(1);
    } finally {
      hold.release();
    }
    if (operation === "delete")
      await expect(page.getByRole("dialog")).toHaveCount(0);
    else
      await expect(
        page.getByRole("heading", { name: term.name, exact: true }),
      ).toBeVisible();
    expect(hold.count()).toBe(1);
    if (operation === "create")
      expect(
        (
          await request.post(`${API}/terms/`, { data: { name: term.name } })
        ).status(),
      ).toBe(409);
  });
}
