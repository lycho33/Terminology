import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";

export const API = "http://localhost:8000";
export const termUrl = (name) => `${API}/terms/${encodeURIComponent(name)}`;
export const newName = (label) => `E2e ${label} ${randomUUID()}`;
export const normalized = (name) => name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();

export async function savedTerm(request, label = "term", fields = {}) {
  const name = newName(label);
  const response = await request.post(`${API}/terms/`, {
    data: { name, ...fields },
  });
  expect(response.status()).toBe(201);
  return readTerm(request, name);
}
export async function readTerm(request, name) {
  const response = await request.get(termUrl(name));
  expect(response.status()).toBe(200);
  return response.json();
}
export async function lookup(page, name) {
  await page
    .getByRole("textbox", { name: "Lookup term", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Search", exact: true }).click();
}
export async function showTerm(page, term) {
  await lookup(page, term.name);
  await expect(
    page.getByRole("heading", { name: term.name, exact: true }),
  ).toBeVisible();
}
export async function openCreate(page, name = "") {
  await page.getByRole("button", { name: "Create term", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Term name", exact: true })
    .fill(name);
}
export async function openEdit(page, term) {
  await showTerm(page, term);
  await page
    .getByRole("button", { name: `Edit ${term.name}`, exact: true })
    .click();
}
export async function openDelete(page, term) {
  await showTerm(page, term);
  await page
    .getByRole("button", { name: `Delete ${term.name}`, exact: true })
    .click();
  return page.getByRole("dialog", { name: "Delete term?" });
}
export async function control(action, data) {
  const response = await fetch(`${process.env.E2E_CONTROL_URL}/${action}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.E2E_CONTROL_TOKEN}` },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(150_000),
  });
  if (!response.ok)
    throw new Error(`Test control ${action}: ${await response.text()}`);
}
export async function holdWrite(page, method) {
  let release, received;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const arrived = new Promise((resolve) => {
    received = resolve;
  });
  let count = 0;
  await page.route(`${API}/terms/**`, async (route) => {
    if (route.request().method() === method) {
      count++;
      received();
      await gate;
    }
    await route.continue();
  });
  return { release, arrived, count: () => count };
}
export async function simulate(
  page,
  method,
  body,
  status = 500,
  contentType = "application/json",
) {
  await page.route(`${API}/terms/**`, async (route) => {
    if (route.request().method() !== method) return route.continue();
    await route.fulfill({
      status,
      contentType,
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  });
}
