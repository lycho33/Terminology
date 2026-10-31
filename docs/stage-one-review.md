# Stage one review

Branch: `feature/remove-neontology`.

This stage removes Neontology and adds API validation messages in React.
Stage two (package upgrades) has not started.

## Changes

- One official Neo4j driver is created during API startup. Startup checks the
  connection and creates the existing unique-name constraint. The driver closes
  on shutdown, including when startup fails.
- Term queries use parameters. Names still use the existing capitalization rule.
  New identifiers remain UUID hex strings. Updates keep the current behavior:
  omitted or null values keep the saved value; empty text clears optional text.
- A plain Pydantic model replaces the graph-library node model.
- Successful response shapes stay unchanged. GET returns the term object.
  POST/PATCH return a `term` result wrapper; DELETE returns a `result` wrapper.
  The scalar-query wrapper retains `records_raw` as ordered value arrays and
  the existing empty graph collections. This compatibility code is local code;
  it does not import Neontology.
- React retains error codes and field details. Field messages appear beside the
  input and are linked with `aria-describedby`. Other errors appear at form level.
  Editing clears stale errors. Inputs are disabled while a save is pending.
- Blank names now produce a visible message instead of doing nothing.
- Model routes, Docker configuration, desktop packaging, and sandbox work are
  outside this stage. Shared request validation also applies to the model API.

## Error contract

Example: a blank term name returns HTTP 422:

```json
{
  "detail": "Check the submitted fields.",
  "errors": [
    {
      "code": "FIELD_BLANK",
      "field": "name",
      "message": "Enter a value that is not blank."
    }
  ]
}
```

Use `code` for program decisions. Do not parse `message` text. `field` is null
when the error has no field. React shows unknown fields at form level so that
messages do not disappear. Raw submitted values and database exception text are
not returned. Existing text-only HTTP errors still have a frontend fallback.

| Code | HTTP status | Meaning |
| --- | --- | --- |
| `FIELD_REQUIRED` | 422 | Required field is absent. |
| `FIELD_BLANK` | 422 | Text is empty or contains only spaces. |
| `INVALID_TYPE` | 422 | A text field received a different type. |
| `INVALID_JSON` | 422 | Request JSON cannot be read. |
| `INVALID_VALUE` | 422 | Other request validation failure. |
| `TERM_ALREADY_EXISTS` | 409 | The term name conflicts with an existing term. |
| `TERM_NOT_FOUND` | 404 | Lookup, update, or deletion found no term. |
| `DATABASE_UNAVAILABLE` | 503 | Connection is unavailable or the session expired. |
| `DATABASE_ERROR` | 500 | Other database operation failure. |

## Package scope

Neontology is removed from requirements. The driver's previous effective major
version limit is now explicit (`neo4j>=5.20.0,<6.0.0`). This prevents an incidental
major upgrade during stage one. Stage two can remove that limit and check the
latest driver with the other package updates.

The Python checks used an isolated Python 3.11.18 environment with FastAPI
0.113.0, Pydantic 2.9.2, Pydantic Settings 2.5.2, Neo4j driver 5.28.8, HTTPX
0.28.1, and python-dotenv 1.2.4. These are test-environment versions, not a new
release lock. Full dependency locking remains in stage two.

## Repeat the automated checks

From the repository root, using a Python environment with the API dependencies:

```sh
python -m unittest discover -s tests -v
npm test --prefix frontend
npm run build --prefix frontend
npm run lint --prefix frontend
```

The database integration test is skipped unless `NEO4J_TEST_URI` is set. Use only
an isolated, disposable Neo4j instance with authentication disabled, bound to
loopback. Never point this test at a user database. It creates the application
constraint and temporary terms; temporary terms are removed after the test.

```sh
NEO4J_TEST_URI=bolt://127.0.0.1:TEST_PORT python -m unittest discover -s tests -v
```

## Checks completed for this branch

- 14 Python tests passed, including the opt-in CRUD and constraint test against
  a separate Neo4j 2026.06.0 container from the existing local image.
- Five frontend error-parser tests passed.
- TypeScript compilation, the Vite production build, and ESLint passed.
- Python checks for undefined names and syntax errors passed.
- Browser checks passed for blank names in create and edit, duplicate-name
  feedback, successful creation after correction, and successful renaming.
- No user database was used. The test instance had no user data mounts.

This evidence does not establish desktop packaging or sandbox compatibility.
Those checks belong to later stages.

## Manual review

1. Submit an empty name and a name with only spaces in both create and edit.
   Confirm that a message appears beside the name field.
2. Create a term with a definition and diagram. Look it up.
3. Create a duplicate name. Confirm the name conflict message.
4. Rename a term. Confirm its identifier stays the same and the old lookup fails.
5. Rename to an existing term. Confirm the original term remains unchanged.
6. Clear optional text, save, and look up the term again.
7. Delete a test term and confirm that it no longer appears.
8. Check form-level feedback when the API or database is unavailable.

After this branch is pushed, work stops for user review. Do not start stage two.
