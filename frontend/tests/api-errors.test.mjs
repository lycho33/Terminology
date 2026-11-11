import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

// Compile the pure TypeScript module without adding a test framework.
const source = readFileSync(
  new URL("../src/api-errors.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { readApiError, isApiError, fieldMessages, formMessages } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`
);

test("keeps stable codes and separates field and form messages", async () => {
  const error = await readApiError(
    new Response(
      JSON.stringify({
        detail: "Check fields.",
        errors: [
          { code: "FIELD_BLANK", field: "name", message: "Enter a name." },
          { code: "DATABASE_ERROR", field: null, message: "Save failed." },
        ],
      }),
      { status: 422 },
    ),
    "Fallback",
  );
  assert.ok(isApiError(error));
  assert.equal(error.status, 422);
  assert.equal(error.issues[0].code, "FIELD_BLANK");
  assert.deepEqual(fieldMessages(error.issues, "name"), ["Enter a name."]);
  assert.deepEqual(formMessages(error.issues, error.message), ["Save failed."]);
});

test("does not repeat field errors in the form summary", () => {
  assert.deepEqual(
    formMessages(
      [{ code: "INVALID_TYPE", field: "diagram", message: "Enter text." }],
      "Check fields.",
    ),
    [],
  );
});

test("unknown fields remain visible at form level", () => {
  assert.deepEqual(
    formMessages(
      [
        {
          code: "INVALID_VALUE",
          field: "future.field",
          message: "Check value.",
        },
      ],
      "Fallback",
    ),
    ["Check value."],
  );
});

test("legacy text errors and non-JSON responses remain readable", async () => {
  const legacy = await readApiError(
    new Response(JSON.stringify({ detail: "Not found." }), { status: 404 }),
    "Fallback",
  );
  assert.deepEqual(formMessages(legacy.issues, legacy.message), ["Not found."]);
  const plain = await readApiError(
    new Response("Unavailable", { status: 503 }),
    "Try again.",
  );
  assert.equal(plain.message, "Try again.");
  assert.deepEqual(plain.issues, []);
});

test("malformed issue entries do not crash error display", async () => {
  const error = await readApiError(
    new Response(JSON.stringify({ errors: [null, { code: 4 }, "bad"] }), {
      status: 500,
    }),
    "Try again.",
  );
  assert.deepEqual(formMessages(error.issues, error.message), ["Try again."]);
});
