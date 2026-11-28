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
const excerpt = (path, line, end, label) => ({ path, line, end, label });
const trace = (before, after, ...code) => ({ before, after, code });
const step = (title, value, detail, basis, path, line, attachment, implementation, component, payload) =>
  ({ title, value, detail, basis, source: source(path, line), attachment, ...implementation, component, payload });

const preview = "Checked by test";
const input = "Test input";
const inferred = "From source";
const editPath = ["test", "editor", "data", "api", "database"];
const client = "<title>Client</title>";
const browserTitle = "<title>Browser</title>";
const actions = "frontend/src/actions.tsx";
const models = "api/models.py";
const apiSpec = "tests/test_svg_diagram.py";
const edit = {
  title: "SC-6 SVG: edit, cancel, and save new source",
  source: source(spec, 214),
  path: editPath,
  steps: [
    step("Load the saved SVG", "Client", "The test seeds a term with the connected shapes SVG. The edit form reads the saved source into its draft state.", input, spec, 218, null,
      trace("exampleSvg contains " + client, "get.term.diagram = exampleSvg\nnewDiagram = exampleSvg",
        excerpt(terms, 204, 214, "Read the saved term into the edit form"),
        excerpt(fixture, 15, 22, "SVG fixture"),
        excerpt(spec, 214, 221, "Seed and open the test term")), "editor", "Saved SVG · Client"),
    step("Preview the draft", "Browser", "The test replaces Client with Browser in the SVG string. The form stores the draft. Preview parses and renders that string locally.", preview, spec, 219, "review-preview",
      trace("changed = exampleSvg.replaceAll(\"Client\", \"Browser\")\nmode = \"code\"", "newDiagram contains " + browserTitle + "\nmode = \"preview\"",
        excerpt(terms, 240, 243, "Store the input in React state"),
        excerpt(field, 305, 318, "Parse the current draft"),
        excerpt(field, 347, 354, "Switch to Preview")), "editor", "Draft SVG · Browser"),
    step("Cancel", "Client", "Cancel exits edit mode. The saved view reads the saved term. SC-6 checks the Client label and reloads the original source from the API.", preview, spec, 226, "review-cancel",
      trace("Draft title = Browser\nSaved title = Client", "onEditMode(false)\nSaved view shows Client\nGET diagram === exampleSvg",
        excerpt(terms, 269, 272, "Exit edit mode"),
        excerpt(terms, 600, 604, "Render the saved diagram"),
        excerpt(spec, 226, 232, "Check the label and stored value")), "editor", "Saved SVG · Client"),
    step("Submit the edited form", "", "The test reopens the form, enters the same edited SVG, and clicks Update. The form validates the draft and passes it to the mutation.", inferred, spec, 233, null,
      trace("newDiagram = changed\nchanged contains " + browserTitle, "UpdateTermInput.diagram = changed",
        excerpt(terms, 245, 258, "Validate and pass the draft to the mutation"),
        excerpt(spec, 233, 235, "Refill the draft and click Update")), "editor", "Browser SVG passed to mutation"),
    step("Send an update", "diagram: SVG with Browser", "The mutation calls the HTTP action. The action serializes the same SVG string in the JSON body of a PATCH request.", inferred, actions, 92, null,
      trace("termInputs.term = term.name\ntermInputs.diagram = changed",
        "PATCH /terms/{encoded term.name}\nJSON body diagram = changed",
        excerpt(hooks, 48, 57, "Call the HTTP action"),
        excerpt(actions, 92, 108, "Build the request")), "data", "PATCH carries Browser SVG"),
    step("Validate the update", "", "FastAPI validates the diagram field before it calls the route. The validator checks the SVG and returns an accepted source string as supplied.", inferred, models, 24, null,
      trace("JSON diagram = changed\nSVG contains " + browserTitle, "payload.diagram = changed",
        excerpt(models, 14, 27, "Bind the validator to the diagram field"),
        excerpt(validator, 72, 92, "Load the rules and parse the SVG"),
        excerpt(validator, 190, 196, "Return the accepted source")), "api", "Validated Browser SVG"),
    step("Store the updated SVG", "t.diagram = edited SVG", "The route passes the validated string to Cypher. The query replaces t.diagram because the update includes a value.", inferred, api, 122, null,
      trace("payload.diagram = changed\n$updated_diagram = changed", "t.diagram = changed\nStored SVG contains " + browserTitle,
        excerpt(api, 127, 135, "Update the Neo4j term"),
        excerpt(api, 136, 143, "Pass the validated diagram as a query parameter")), "database", "Stored SVG · Browser"),
    step("Refresh the saved view", "Browser", "The mutation invalidates the detail query. The saved view renders its updated value. SC-6 checks Browser and confirms that a GET returns the exact edited source.", preview, spec, 235, "edited-diagram",
      trace("Cached diagram contains " + client, "Saved view shows Browser\nGET diagram === changed",
        excerpt(hooks, 48, 57, "Invalidate term details after update"),
        excerpt(terms, 600, 604, "Read the current diagram into the saved view"),
        excerpt(spec, 235, 240, "Check the updated view and GET result")), "editor", "Saved view · Browser"),
  ],
};

const browserTraces = new Map([
  [45, trace("exampleSvg contains Client, Server, and their arrow", "Preview shows both shapes and the arrow\nPOST count = 0",
    excerpt(field, 371, 390, "Render Preview from the parsed source"),
    excerpt(spec, 45, 60, "Paste the fixture and verify Preview"))],
  [65, trace("source adds whitespace and Client café &amp; tea", "clipboard.writeText receives the exact source",
    excerpt(actions, 68, 84, "Send the original source to Create"),
    excerpt(field, 321, 329, "Copy the exact value"),
    excerpt(spec, 85, 101, "Check the mocked clipboard"))],
  [108, trace("zoom = 1\npan = { x: 0, y: 0 }", "Zoom in gives scale(1.25)\nReset gives translate(0 0) scale(1)",
    excerpt(field, 128, 133, "Reset the view state"),
    excerpt(field, 212, 219, "Increase zoom in quarter steps"),
    excerpt(spec, 114, 134, "Check zoom, pan, and reset"))],
  [147, trace("Drag Client by (30, 20) screen pixels", "Client and the source endpoint move together\nStored source === exampleSvg",
    excerpt(field, 101, 119, "Convert pointer motion to an offset"),
    excerpt(field, 186, 197, "Apply offsets to the connector"),
    excerpt(spec, 161, 178, "Check geometry and storage"))],
  [196, trace("Select Client with a pointer. Select Server with Enter.", "Shape details shows the selected node's description",
    excerpt(field, 120, 126, "Select a node when the pointer did not drag"),
    excerpt(field, 167, 177, "Select a node with the keyboard"),
    excerpt(spec, 201, 211, "Check the two selected descriptions"))],
  [249, trace("exampleSvg contains url(#missing) instead of url(#arrow)", "The parser reports a missing marker\nThe test then saves the corrected exampleSvg",
    excerpt(format, 218, 226, "Check referenced marker IDs"),
    excerpt(format, 278, 285, "Return the validation message"),
    excerpt(spec, 278, 284, "Show the error and replace the source"))],
  [287, trace("saved diagram = exampleSvg\nEdit input becomes \"\"", "GET diagram === \"\"\nNo diagram saved yet.",
    excerpt(validator, 72, 77, "Accept the explicit empty string"),
    excerpt(api, 127, 135, "Let an empty value replace the stored SVG"),
    excerpt(field, 399, 403, "Render the empty state"))],
  [302, trace("Mocked GET diagram = \"Legacy plain text\"", "Code view retains the value\nA corrected PATCH saves exampleSvg",
    excerpt(field, 305, 318, "Handle a failed parse without replacing the input"),
    excerpt(field, 381, 399, "Show the original value in Code"),
    excerpt(spec, 306, 326, "Mock the legacy GET and save the real correction"))],
  [333, trace("dockerSvg contains ordinary SVG without interaction metadata", "Preview renders the source\nShape dragging is unavailable",
    excerpt(format, 218, 239, "Parse SVG and check whether movement is enabled"),
    excerpt(field, 371, 379, "Render a valid diagram"),
    excerpt(spec, 343, 364, "Load the Docker fixture and verify Preview"))],
  [427, trace("The test sets the color scheme and loads dockerSvg", "Code, Preview, Copy, Zoom, and Reset fit in one row",
    excerpt(field, 330, 354, "Place the mode controls in the toolbar"),
    excerpt("frontend/src/diagram/diagram.css", 20, 46, "Apply control styles"),
    excerpt(spec, 471, 482, "Verify the toolbar and footnote"))],
]);

const apiTraces = new Map([
  [22, trace("Test redirects FORMAT_PATH to a temporary path", "maxDepth = 1 rejects the SVG\nRestoring the file accepts it again",
    excerpt(validator, 72, 82, "Read the current rules on each validation"),
    excerpt(apiSpec, 22, 36, "Replace the rule file during the test"))],
  [38, trace("case[\"source\"] from svg-cases.json", "An accepted case returns the same string\nA rejected case raises PydanticCustomError",
    excerpt(validator, 72, 92, "Check and parse the source"),
    excerpt(validator, 190, 196, "Return the original source"),
    excerpt(apiSpec, 38, 45, "Check valid and invalid fixtures"))],
  [47, trace("JSON name = Example\nJSON diagram = case[\"source\"]\nDatabase driver is a MagicMock",
    "Accepted SVG is passed to execute_query unchanged\nRejected SVG returns 422 before execute_query",
    excerpt(models, 14, 27, "Validate the fields before the route"),
    excerpt(apiSpec, 69, 86, "Check HTTP status and captured query parameters"),
    excerpt(apiSpec, 87, 95, "Check the invalid response and mock call count"))],
]);

function browser(title, line, attachment, value, detail, path = ["test", "editor"]) {
  return {
    title,
    source: source(spec, line),
    path,
    steps: [step("Trace the implementation", value, detail, preview, spec, line, attachment, browserTraces.get(line))],
  };
}

function apiTest(title, line, detail) {
  return {
    title,
    source: source(apiSpec, line),
    path: ["test", "api"],
    steps: [step("Trace the implementation", "", detail, preview, apiSpec, line, null, apiTraces.get(line))],
  };
}

const save = browser("SC-2 SVG: save, reopen, and copy exact source", 65, "saved-source",
  "Client café & tea", "The test verifies that save, reopen, and copy preserve the source.", editPath);
const ordinary = browser("SC-1 SVG: ordinary Docker source saves unchanged and supports view controls", 333, "docker-preview-before-save",
  "Docker image diagram", "The fixture renders and retains its exact SVG. The test checks view controls on this ordinary SVG.", editPath);
const move = browser("SC-4 SVG: temporary shape movement keeps connections after zoom and pan", 147, "moved-with-connection",
  "Client moves by a drag of (30, 20) screen pixels", "The test checks shape geometry and connected endpoints and checks source after movement.");
const recover = browser("SC-7 SVG: invalid input is retained and can be corrected", 249, "missing-marker-error",
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
    tests: [browser("SC-8 SVG: clear the optional diagram", 287, "empty-diagram", "diagram: \"\"", "The browser test checks that the diagram is cleared after Update.", editPath)],
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
    tests: [browser("SC-3 SVG: zoom, pan, reset, and narrow layout", 108, "narrow-diagram", "Default view → zoom and pan → default view", "The test checks transform changes and reset at a narrow width."), ordinary],
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
    tests: [browser("SC-9 SVG: simulated legacy read preserves old text for correction", 302, "legacy-text-preserved", "Old diagram text → supported SVG", "The test simulates the legacy GET, then saves valid SVG to the isolated stack.", editPath)],
    gaps: ["The setup simulates a legacy GET. It does not migrate or read a database seeded with legacy text."],
  },
  ...["light", "dark"].map((theme) => ({
    title: "Keep the SVG controls compact in " + theme + " mode",
    detail: "The field puts labeled icons and mode controls on one row. It puts the help text under the image and follows the active theme.",
    sources: [source(field, 291), source("frontend/src/diagram/diagram.css", 1)],
    tests: [browser("SC-1 SVG: compact toolbar and footnote in " + theme + " mode", 427, "toolbar-" + theme,
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
