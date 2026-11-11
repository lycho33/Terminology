# API dependency updates

Stage two uses branch `feature/update-api-packages`. CI and local checks use
Python 3.11.18 and Node.js 24.22.2. Desktop work is a later stage.

## Selected versions

These are the latest stable direct dependency versions reported by PyPI on
2026-11-10. HTTPX and python-dotenv retain their existing test versions.

| Package | Previous E2E version | Selected version |
| --- | --- | --- |
| [FastAPI](https://pypi.org/project/fastapi/0.162.4/) | 0.113.0 | 0.162.4 |
| [Pydantic](https://pypi.org/project/pydantic/2.14.3/) | 2.9.2 | 2.14.3 |
| [Pydantic Settings](https://pypi.org/project/pydantic-settings/2.16.2/) | 2.5.2 | 2.16.2 |
| [Neo4j driver](https://pypi.org/project/neo4j/6.4.1/) | 5.28.8 | 6.4.1 |
| [HTTPX](https://pypi.org/project/httpx/0.28.1/) | 0.28.1 | 0.28.1 |
| [python-dotenv](https://pypi.org/project/python-dotenv/1.2.4/) | 1.2.4 | 1.2.4 |
| [Uvicorn](https://pypi.org/project/uvicorn/0.54.0/) | 0.30.6 | 0.54.0 |

The Neo4j server image remains at the version used in stage one. Only its Python
driver changes. See the [driver installation guide](https://neo4j.com/docs/python-manual/current/install/)
and [upgrade guide](https://neo4j.com/docs/python-manual/current/upgrade/).

## One dependency set

- `requirements.in` records the direct dependencies.
- `requirements.txt` records exact direct and indirect dependency versions.
  Platform conditions keep platform-specific packages separate.
- `frontend/e2e/requirements.txt` includes the root `requirements.txt`. Tests and
  the application now install the same versions.

FastAPI retains its existing `standard` extra. Its current dependency tree
includes CLI, cloud CLI, and OpenTelemetry packages. Some OpenTelemetry packages
use beta version numbers required by their upstream dependencies. Thus, “latest
stable” describes the direct package selection, not every indirect package.
No application cloud service or telemetry export is configured by this change.

## Install and test

Use the existing isolated test environment:

```sh
npm ci --prefix frontend
npm run test:e2e:setup --prefix frontend
frontend/.e2e/venv/bin/python -m pip check
frontend/.e2e/venv/bin/python -m unittest discover -s tests -v
npm test --prefix frontend
npm run lint --prefix frontend
npm run test:e2e --prefix frontend
```

The E2E command builds React and starts the real API and a temporary Neo4j
container. It refuses occupied application ports. See the
[E2E guide](e2e-testing.md) for setup, reports, and cleanup.

## Update the fixed versions

Check package releases and Python support first. Update the direct versions in
`requirements.in`, then regenerate the full set from the repository root:

```sh
uv pip compile requirements.in --python-version 3.11.18 --universal \
  --upgrade --no-strip-extras --output-file requirements.txt
```

This stage used uv 0.7.19. uv is required only to regenerate the file. Normal
installation uses pip. Review changes to indirect dependencies before running
the tests. Do not edit generated package versions independently.

## Verification

Local verification on 2026-11-10:

- `pip check`: no broken requirements.
- API unit tests: 13 passed. The separate opt-in database test was skipped;
  the E2E suite tested the real database.
- Frontend unit tests: 5 passed.
- Frontend build and lint: passed.
- E2E: 70 passed across Chromium and WebKit, with no skips or retries. This
  includes separately labelled simulated-response tests.
- Linux x86_64 dependency resolution with Python 3.11.18: passed.
- Workflow YAML: checked. Uploads still occur only after failure, with five-day
  retention.
- Cleanup: the run's Neo4j container was removed, with no cleanup failures.
  Ports 3030 and 8000 had no listeners after the run.

Local evidence is in `frontend/e2e-artifacts/run-vJIE0R/`. It includes
`results.json`, `report/index.html`, service logs, and `cleanup.json`.

No application code changes or test assertion changes were needed. These checks
found no regression in the tested CRUD, validation, and error-handling paths.
Model endpoints were not tested. The GitHub Actions job has not run with this
dependency set. Linux dependency resolution does not prove Linux runtime behavior.
