export const pilotHead = "cfc2d1054619f4bcd0fbb6afa278f2985fa5891c";
const pilotBase = "849986f9331766618ed9f9fe738ab692217a2cf2";
const spec = "frontend/e2e/svg-diagram.spec.mjs";
const fixture = "docs/skill-graph/examples/connected-shapes.svg";
const format = "frontend/src/diagram/svg-format.ts";
const field = "frontend/src/diagram/DiagramField.tsx";
const terms = "frontend/src/terms/Term.tsx";
const hooks = "frontend/src/hooks.tsx";
const api = "api/main.py";
const validator = "api/svg_diagram.py";
const runner = "frontend/e2e/run.mjs";
const source = (path, line) => ({ path, line });
const step = (title, value, detail, basis, path, line, attachment = null) =>
  ({ title, value, detail, basis, source: source(path, line), attachment });

const preview = "Checked by test";
const input = "Test input";
const inferred = "From source";
const editPath = ["test", "editor", "data", "api", "database"];
const edit = {
  title: "SC-6 SVG: edit, cancel, and save new source",
  source: source(spec, 214),
  path: editPath,
  steps: [
    step("Load the saved SVG", "Client", "Seed term.diagram with the connected shapes fixture.", input, fixture, 15),
    step("Preview the draft", "Browser", "The edited source replaces Client with Browser. The browser test checks that the preview shows Browser.", preview, spec, 219, "review-preview"),
    step("Cancel", "Client", "The browser shows Client again. A GET returns the original SVG source.", preview, spec, 226, "review-cancel"),
    step("Send an update", "diagram: SVG with Browser", "The update request sends the edited source in the diagram field of the JSON body.", inferred, "frontend/src/actions.tsx", 92),
    step("Store the updated SVG", "t.diagram = edited SVG", "The API sends the submitted value to the database query.", inferred, api, 122),
    step("Refresh the saved view", "Browser", "The saved view shows Browser. A GET returns the edited SVG source.", preview, spec, 235, "edited-diagram"),
  ],
};

function browser(title, line, attachment, value, detail, path = ["test", "editor"]) {
  return {
    title,
    source: source(spec, line),
    path,
    steps: [step("Check the result", value, detail, preview, spec, line, attachment)],
  };
}

function apiTest(title, line, detail) {
  const file = "tests/test_svg_diagram.py";
  return {
    title,
    source: source(file, line),
    path: ["test", "api"],
    steps: [step("Check the result", "", detail, preview, file, line)],
  };
}

const save = browser("SC-2 SVG: save, reopen, and copy exact source", 65, "saved-source",
  "Client café & tea", "The test verifies that save, reopen, and copy preserve the source.", editPath);
const ordinary = browser("SC-1 SVG: ordinary Docker source saves unchanged and supports view controls", 333, null,
  "Docker image diagram", "The fixture renders and retains its exact SVG. The test checks view controls on this ordinary SVG.", editPath);
const move = browser("SC-4 SVG: temporary shape movement keeps connections after zoom and pan", 147, "moved-with-connection",
  "Client moves by a drag of (30, 20) screen pixels", "The test checks shape geometry and connected endpoints and checks source after movement.");
const recover = browser("SC-7 SVG: invalid input is retained and can be corrected", 249, null,
  "Invalid fixture → supported SVG", "The test checks feedback, retention of the invalid input, and a corrected save.", editPath);

const behaviors = [
  {
    title: "Preview and save supported SVG without interaction metadata",
    detail: "Create, edit, and saved views use a common SVG field. Supported source renders in Preview and the saved value retains the original string.",
    sources: [source(field, 291), source(terms, 170), source(format, 105), source("api/models.py", 18)],
    tests: [
      browser("SC-1 SVG: paste and preview before saving", 45, "preview-before-save", "Client → Server", "The browser shows the two fixture shapes and the arrow before Create."),
      save, ordinary,
      apiTest("test_writes_reject_invalid_before_database_and_preserve_valid_source", 47, "The client response preserves valid source and invalid writes do not reach the database."),
    ],
    gaps: [],
  },
  {
    title: "Preview, cancel, or save an edit",
    detail: "Preview applies to the draft. Cancel restores the saved SVG. Update persists the newly submitted source and refreshes the saved view.",
    sources: [source(terms, 204), source(terms, 240), source(hooks, 48), source(api, 122)],
    tests: [edit],
    gaps: [],
  },
  {
    title: "Clear a saved diagram",
    detail: "The optional SVG field can be cleared in the edit form.",
    sources: [source(terms, 240), source("frontend/src/actions.tsx", 92)],
    tests: [browser("SC-8 SVG: clear the optional diagram", 287, null, "diagram: \"\"", "The browser test checks that the diagram is cleared after Update.", editPath)],
    gaps: [],
  },
  {
    title: "Open Code or Preview and copy the exact source",
    detail: "The same field serves code and preview views. Copy uses the complete source string, including its original whitespace.",
    sources: [source(field, 291), source(field, 321)],
    tests: [save],
    gaps: ["The browser test replaces the clipboard API. It does not check the operating system clipboard."],
  },
  {
    title: "Zoom, pan, and reset a diagram",
    detail: "The viewer applies temporary view changes without changing the stored SVG.",
    sources: [source(field, 41), source(field, 82)],
    tests: [browser("SC-3 SVG: zoom, pan, reset, and narrow layout", 108, null, "Default view → zoom and pan → default view", "The test checks transform changes and reset at a narrow width."), ordinary],
    gaps: [],
  },
  {
    title: "Move annotated shapes and their connectors",
    detail: "Complete interaction metadata enables shape movement and connector updates. A supported passive SVG stays viewable.",
    sources: [source(field, 82), source(format, 105)],
    tests: [move, ordinary],
    gaps: [],
  },
  {
    title: "Open shape details with pointer or keyboard",
    detail: "The viewer displays the selected shape's SVG title and description. A drag remains a move action.",
    sources: [source(field, 41), source(field, 82)],
    tests: [browser("SC-5 SVG: shape details come from pasted descriptions", 196, "selected-shape-details", "The server processes the request and returns a response.", "The test checks details after a pointer click on Client and Enter on Server."), move],
    gaps: [],
  },
  {
    title: "Reject unsupported input and allow correction",
    detail: "The browser and API use a shared set of SVG rules. Validation rejects malformed and unsupported content and preserves the input for correction.",
    sources: [source(format, 105), source(validator, 72), source("api/models.py", 18)],
    tests: [
      recover,
      apiTest("test_shared_format_cases", 38, "The validator checks accepted and rejected shared fixtures."),
      apiTest("test_writes_reject_invalid_before_database_and_preserve_valid_source", 47, "Invalid create and update requests do not reach database execution."),
    ],
    gaps: [],
  },
  {
    title: "Allow a legacy diagram value to be corrected",
    detail: "A previously stored text value remains available in Code view. The user can replace it with supported SVG.",
    sources: [source(field, 291), source(terms, 204)],
    tests: [browser("SC-9 SVG: simulated legacy read preserves old text for correction", 302, null, "Old diagram text → supported SVG", "The test simulates the legacy GET, then saves valid SVG to the isolated stack.", editPath)],
    gaps: ["The setup simulates a legacy GET. It does not migrate or read a database seeded with legacy text."],
  },
  ...["light", "dark"].map((theme) => ({
    title: "Keep the SVG controls compact in " + theme + " mode",
    detail: "The field puts labeled icons and mode controls on one row. It puts the help text under the image and follows the active theme.",
    sources: [source(field, 291), source("frontend/src/diagram/diagram.css", 1)],
    tests: [browser("SC-1 SVG: compact toolbar and footnote in " + theme + " mode", 427, null,
      theme + " theme", "The test checks layout and access to controls at desktop and narrow viewport widths.")],
    gaps: [],
  })),
  {
    title: "Invalidate other cached term details after a save",
    detail: "The shared update hook invalidates the term key prefix. That includes other cached detail keys. The edit test checks the edited term.",
    sources: [source(hooks, 18), source(hooks, 48), source(terms, 460)],
    tests: [],
    gaps: ["No related test found for opening a second cached term after saving the first one."],
  },
  {
    title: "Use an isolated API endpoint in browser tests",
    detail: "The runner gives the build and test client one temporary IPv4 API address. Test requests do not need the app's default API endpoint.",
    sources: [source(runner, 267), source("frontend/playwright.config.mjs", 7), source("frontend/src/actions.tsx", 5)],
    tests: [],
    gaps: ["The isolated runner uses this path in browser tests. The system found no test that exercises a conflicting app API on the default port."],
  },
  {
    title: "Reload the shared SVG rules when the API validates a write",
    detail: "The API re-reads the rule file during validation. Compose supplies a read-only mount. The standalone image includes a copy.",
    sources: [source(validator, 15), source(validator, 72), source("docker-compose.yml", 38), source("Dockerfile.api", 7)],
    tests: [apiTest("test_shared_format_changes_apply_without_restarting_the_validator", 22, "The test changes the shared rules, checks that validation follows the change, and restores the baseline.")],
    gaps: ["The validator test does not start the Compose service or verify its rule-file mount."],
  },
];

export const isPilot = ({ number, head, base }) =>
  number === 14 && head === pilotHead && base === pilotBase;

export const pilotBehaviorReport = {
  behaviors,
  method: "Source and test review for this revision",
};

export const pilotCaptureTest = edit.title;
