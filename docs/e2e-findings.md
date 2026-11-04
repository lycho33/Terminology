# E2E verification record

Local verification completed on 2026-10-31 (America/Detroit).
The branch starts from stage-one commit `bf01f12`, including the latest comments.

## Results

| Check | Result |
| --- | --- |
| Chromium E2E | 35 passed |
| WebKit E2E | 35 passed |
| Python unit tests | 13 passed; one opt-in database test skipped |
| Frontend unit tests | 5 passed |
| Frontend build | Passed |
| Frontend and E2E lint | Passed |
| Git whitespace check | Passed |
| Clean frontend install (`npm ci`) | Passed; audit warnings below |

The E2E run used one worker and zero retries. No E2E tests were skipped.
It took about four minutes. The 70 checks include:

- 38 browser checks through real services, including service outages and delayed requests.
- 16 direct HTTP checks through the real API and database.
- 16 browser checks with simulated error responses.

The existing opt-in Python database test needs its own explicit database address.
The E2E suite supplies the live database coverage for this workflow.

## Application defects

No application defects were found in these cases. This result does not prove
that all possible inputs or failures are covered. No application code changed.

`npm ci` reported 21 dependency audit findings: 14 moderate and 7 high.
These findings were not investigated in this test task. No dependency upgrade
or automatic audit fix was applied. They require separate review.

Database outage checks took about one minute each. The API keeps the Neo4j
driver's existing retry behavior before it returns HTTP 503. The tests allow
that delay and verify recovery. No new response-time requirement was added.

## Test setup corrections

Two problems in the new test setup were corrected during verification:

1. Docker can change an automatically assigned port when a container restarts.
   The runner now selects an available port number and uses that explicit
   mapping for the database's whole lifetime.
2. Playwright encodes an invalid JSON string as a valid JSON string value.
   The malformed-JSON test now sends raw bytes. The `INVALID_JSON` assertion
   remains in place. A direct request also confirmed that API response.

An earlier complete run reported 68 passes and two failures from the request
encoding problem. Its failure report and traces remain available locally.
No assertions were removed, skipped, or marked as expected failures.

## Isolation and cleanup

- The database reported `Neo4j/2026.06.0`, matching stage one.
- Docker inspection showed new anonymous volumes for `/data` and `/logs`.
  There were no user data mounts.
- A second run refused occupied port 3030 with exit code 1. It did not stop
  the active services.
- An interrupted run removed its test container and processes.
- The failed run and final successful run both reported successful cleanup.
- After the final run, no test containers or listeners on ports 3030 and 8000
  remained. Both test volumes were removed. The five pre-existing volumes
  were unchanged.

## Evidence and limits

The final local report is under
`frontend/e2e-artifacts/run-eA4dKp/`. It contains `results.json`,
`report/index.html`, service logs, `database-version.txt`, and `cleanup.json`.
The earlier failure evidence is under `frontend/e2e-artifacts/run-UI49FI/`.
These generated files are ignored by Git.

The GitHub Actions job is configured for pull requests and manual runs.
It has not been executed on GitHub during this local verification.
The visible-browser command is provided, but verification used headless browsers.
Package upgrades and desktop work remain outside this branch.
