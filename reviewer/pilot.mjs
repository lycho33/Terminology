import { componentForPath } from "./components.mjs";
import { connectedSvg as fixture, withUiReplay } from "./pilot-ui.mjs";

export const pilotHead = "cfc2d1054619f4bcd0fbb6afa278f2985fa5891c";
const pilotBase = "849986f9331766618ed9f9fe738ab692217a2cf2";
const spec = "frontend/e2e/svg-diagram.spec.mjs";
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
const editHandoffs = [
  ["Saved term", "UpdateTermForm"],
  ["UpdateTermForm", "DiagramViewer"],
  ["UpdateTermForm", "Saved term view"],
  ["UpdateTermForm", "Update mutation"],
  ["updateTerm", "FastAPI"],
  ["FastAPI", "validate_svg"],
  ["update_term", "Neo4j"],
  ["Term detail query", "DiagramViewer"],
];
const edit = withUiReplay({
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
  ].map((item, index) => {
    const [from, to] = editHandoffs[index];
    return { ...item, flow: { from, to } };
  }),
});

function createStep(description, workflow) {
  return {
    ...description,
    workflow: {
      ...workflow,
      termName: "SVG preview example",
      fixture: workflow.stage !== "form" ? fixture : undefined,
    },
  };
}

const createPreview = {
  title: "SC-1 SVG: paste and preview before saving",
  source: source(spec, 45),
  path: ["test", "editor"],
  steps: [
    createStep(step("Open the Create term form", "", "The test opens Create term and fills the name. The Diagram field starts in Code mode with an empty value.", input, spec, 50, null,
      trace('Term name = "SVG preview example"', 'newDiagram = ""',
        excerpt(terms, 80, 91, "Initialize the create form"),
        excerpt(field, 304, 307, "Start the editable field in Code mode")), "editor", "Empty SVG field"),
      { stage: "form", node: "form", token: 'newDiagram = ""', focusLine: 86, draft: "Empty", parsed: "None", mode: "code" }),
    createStep(step("Paste the SVG", "", "Pasting changes the Diagram textarea. DiagramField sends the text to the form through its onChange callback.", inferred, spec, 51, null,
      trace("Clipboard input = exampleSvg", "onChange receives exampleSvg",
        excerpt(field, 381, 390, "Forward the textarea value"),
        excerpt(terms, 179, 186, "Connect onChange to handleDiagramChange")), "editor", "Paste · exampleSvg"),
      { stage: "paste", node: "field", from: "form", token: "Pasted SVG text", focusLine: 388, draft: "Empty before callback", parsed: "None", mode: "code" }),
    createStep(step("Run handleDiagramChange", "", "The callback stores the SVG in the form's state. The form then passes it back to DiagramField as value. Code mode stays selected.", inferred, terms, 100, null,
      trace("value = exampleSvg", 'newDiagram = exampleSvg\nmode = "code"',
        excerpt(terms, 100, 103, "Store the SVG in the form"),
        excerpt(terms, 180, 186, "Pass the new value to DiagramField")), "editor", "Form state · newDiagram"),
      { stage: "store", node: "form", from: "field", token: "setNewDiagram(exampleSvg)", focusLine: 101, draft: "exampleSvg", parsed: "Recomputes on render", mode: "code" }),
    createStep(step("Parse the new value", "", "DiagramField re-evaluates the diagram when its value changes. The fixture parses to a diagram with Client, Server, and their arrow. The textarea is still shown.", inferred, field, 309, null,
      trace("value = exampleSvg", 'parsed.diagram contains Client → Server\nmode = "code"',
        excerpt(field, 309, 318, "Parse the latest SVG value"),
        excerpt(format, 218, 226, "Return the parsed elements and interaction flag")), "editor", "Parsed SVG · Client → Server"),
      { stage: "parse", node: "field", from: "form", token: "value={exampleSvg}", focusLine: 311, draft: "exampleSvg", parsed: "Client → Server", mode: "code" }),
    createStep(step("Click Preview", "", "The Preview button calls setMode. DiagramField uses this mode on its next render. The SVG source stays the same.", inferred, spec, 52, null,
      trace('mode = "code"\nparsed.diagram is ready', 'mode = "preview"\nnewDiagram remains exampleSvg',
        excerpt(field, 347, 354, "Switch the field to Preview")), "editor", "Preview selected"),
      { stage: "mode", node: "field", token: 'setMode("preview")', focusLine: 350, draft: "exampleSvg", parsed: "Client → Server", mode: "preview" }),
    createStep(step("Display DiagramViewer", "Client → Server", "The render condition selects DiagramViewer and passes it the parsed diagram. The test sees both shapes and their arrow, with zero create requests.", preview, spec, 53, "preview-before-save",
      trace('mode = "preview"\nparsed.diagram is ready', "DiagramViewer shows Client → Server\nPOST count = 0",
        excerpt(field, 371, 377, "Pass the parsed diagram to DiagramViewer"),
        excerpt(spec, 53, 60, "Check the shapes and zero POST requests")), "editor", "DiagramViewer · Client → Server"),
      { stage: "preview", node: "viewer", from: "field", token: "diagram={parsed.diagram}", focusLine: 375, draft: "exampleSvg", parsed: "Client → Server", mode: "preview" }),
  ],
};

const css = "frontend/src/diagram/diagram.css";
const crud = "frontend/e2e/crud.spec.mjs";
const validation = "frontend/e2e/validation.spec.mjs";
const integration = "tests/test_neo4j_integration.py";

function handoff(from, to, title, before, after, code, check, attachment) {
  return { flow: { from, to }, title, before, after, code: [code], check, attachment };
}

function reviewTest(title, file, line, handoffs) {
  const steps = handoffs.map(({ check, ...item }) => ({
    ...item,
    basis: check ? preview : inferred,
    code: check ? [...item.code, excerpt(file, check, check + 8, "Test checkpoint")] : item.code,
    source: check ? source(file, check) : item.code[0],
    component: item.flow.to === "Neo4j" ? "database" : componentForPath(item.code[0].path),
    payload: item.after.split("\n")[0],
  }));
  return withUiReplay({ title, source: source(file, line),
    path: ["test", ...new Set(steps.map(({ component }) => component))], steps });
}

const sendCreate = (svg) => handoff("CreateTermForm", "createTerm", "Send the draft to the API",
  "diagram = " + svg, "POST /terms/ includes the same diagram",
  excerpt(actions, 73, 83, "Serialize the create request"));

const validateWrite = (svg) => handoff("FastAPI request model", "validate_svg", "Validate the diagram",
  "diagram = " + svg, "Validation returns the same string",
  excerpt(models, 14, 27, "Validate the input before the route"));

const storeCreate = (svg, check) => handoff("create_term", "Neo4j", "Store the original SVG",
  "payload.diagram = " + svg, "t.diagram = " + svg,
  excerpt(api, 95, 110, "Pass the original string to the query"), check);

const sendEdit = (svg) => handoff("UpdateTermForm", "updateTerm", "Send the draft update",
  "newDiagram = " + svg, "PATCH body.diagram = " + svg,
  excerpt(actions, 95, 108, "Serialize the update request"));

const storeUpdate = (svg) => handoff("update_term", "Neo4j", "Update the stored SVG",
  "$updated_diagram = " + svg, "t.diagram = " + svg,
  excerpt(api, 127, 142, "Apply the supplied diagram parameter"));

const zoomIn = (check) => handoff("Zoom in button", "DiagramViewer", "Zoom in",
  "zoom = 1", "zoom = 1.25\nSVG transform includes scale(1.25)",
  excerpt(field, 212, 219, "Add a quarter step to zoom"), check);

const panView = (pixels, check) => handoff("Pointer event", "DiagramViewer", "Pan the view",
  "Pointer movement = " + pixels + " screen pixels\nGesture has no shape ID",
  "The viewport translate value changes",
  excerpt(field, 101, 119, "Convert pointer coordinates and update pan"), check);

const resetView = (check) => handoff("Reset button", "DiagramViewer", "Reset the view",
  "zoom = 1.25\npan is nonzero", "translate(0 0) scale(1)",
  excerpt(field, 128, 133, "Restore the view state"), check);

const save = reviewTest("SC-2 SVG: save, reopen, and copy exact source", spec, 65, [
  sendCreate('source with surrounding whitespace and "Client café &amp; tea"'),
  validateWrite("source"), storeCreate("source", 76),
  handoff("GET /terms/{name}", "DiagramField", "Reopen the source in Code mode",
    "GET diagram = source", "The read-only text area shows source, including its whitespace",
    excerpt(field, 381, 390, "Use the saved SVG as the text area value"), 80),
  handoff("DiagramField", "Mock clipboard", "Copy the exact source",
    "value = source", 'writeText receives source\nStatus: "SVG copied."',
    excerpt(field, 321, 329, "Pass the unchanged value to the clipboard"), 95),
  handoff("Mock clipboard", "DiagramField", "Recover from denied clipboard access",
    'writeText throws Error("Denied")', "Code mode retains source\nStatus asks the user to copy it manually",
    excerpt(field, 321, 329, "Keep the source available for manual copy"), 103, "saved-source"),
]);

const ordinary = reviewTest("SC-1 SVG: ordinary Docker source saves unchanged and supports view controls", spec, 333, [
  handoff("DiagramField", "parseDiagram", "Parse the Docker SVG",
    "value = dockerSvg", "The SVG is valid and interactive = false",
    excerpt(format, 218, 239, "Parse the SVG and check for shape interaction")),
  handoff("DiagramField", "DiagramViewer", "Preview the Docker diagram",
    'mode = "preview"\nparsed.diagram contains dockerSvg elements',
    'Canvas shows "CONTAINER A"\nShape buttons = 0\nPOST count = 0',
    excerpt(field, 371, 377, "Render the parsed diagram"), 348, "docker-preview-before-save"),
  zoomIn(371),
  panView("(30, 15)", 379),
  resetView(392),
  sendCreate("dockerSvg"),
  validateWrite("dockerSvg"), storeCreate("dockerSvg", 401),
  handoff("GET /terms/{name}", "DiagramField", "Reopen and update the same SVG",
    "The saved term has diagram = dockerSvg", 'Canvas shows "CONTAINER B"\nGET after Update returns dockerSvg',
    excerpt(terms, 245, 258, "Submit the unchanged draft"), 404, "docker-narrow-preview"),
]);

const zoom = reviewTest("SC-3 SVG: zoom, pan, reset, and narrow layout", spec, 108, [
  zoomIn(114), panView("(25, 15)", 122), resetView(130),
  handoff("Browser viewport", "DiagramViewer", "Read the diagram at a narrow width",
    "Viewport = 390 × 844\nzoom = 1", "Client is visible\nPage width fits the viewport",
    excerpt(field, 245, 253, "Use the available width for the SVG canvas"), 135, "narrow-diagram"),
]);

const move = reviewTest("SC-4 SVG: temporary shape movement keeps connections after zoom and pan", spec, 147, [
  zoomIn(154), panView("(10, 5)", 157),
  handoff("Pointer event", "DiagramViewer", "Move Client",
    "Drag Client by (30, 20) screen pixels", "The viewer converts the drag to diagram coordinates and stores a Client offset",
    excerpt(field, 101, 119, "Compute and store the shape offset")),
  handoff("Shape offsets", "SVG connector", "Redraw the arrow",
    "Client is the source\nOnly Client has a new offset", "Arrow start moves with Client\nThe Server endpoint stays in place",
    excerpt(field, 185, 196, "Apply each shape offset to its connector endpoint"), 162),
  handoff("Server ArrowLeft event", "DiagramViewer", "Move the Server endpoint by keyboard",
    'Key = "ArrowLeft"\nServer offset starts at 0', "Arrow end moves 10 SVG units to the left",
    excerpt(field, 173, 182, "Apply the keyboard offset"), 173, "moved-with-connection"),
  handoff("DiagramViewer", "DiagramField", "Keep movement in the view",
    "Viewer offsets changed\nvalue = exampleSvg", "Code and GET still contain exampleSvg\nReopen and Reset restore the original geometry",
    excerpt(field, 128, 133, "Reset temporary movement state"), 178),
]);

const details = reviewTest("SC-5 SVG: shape details come from pasted descriptions", spec, 196, [
  handoff("Client pointer event", "DiagramViewer", "Select Client with a click",
    'Shape ID = "client"\nThe pointer did not move', 'selected = "client"',
    excerpt(field, 120, 126, "Select the shape on pointer release")),
  handoff("DiagramViewer", "Shape details", "Read the Client description",
    'selected = "client"', "The client sends a request to the server.",
    excerpt(field, 277, 285, "Show the selected title and description"), 203),
  handoff("Server Enter event", "DiagramViewer", "Select Server from the keyboard",
    'Key = "Enter"\nShape ID = "server"', 'selected = "server"',
    excerpt(field, 167, 172, "Use Enter to select the focused shape")),
  handoff("DiagramViewer", "Shape details", "Read the Server description",
    'selected = "server"', "The server processes the request and returns a response.",
    excerpt(field, 277, 285, "Show the selected title and description"), 208, "selected-shape-details"),
]);

const recover = reviewTest("SC-7 SVG: invalid input is retained and can be corrected", spec, 249, [
  handoff("CreateTermForm", "DiagramField", "Show an error and keep the source",
    'Shared fixture "text" contains A -> B', "The alert stays visible\nThe text area retains the test input after Create",
    excerpt(terms, 105, 110, "Stop the submit on an invalid SVG"), 268),
  handoff("Test HTTP client", "FastAPI validation", "Reject the same invalid input at the API",
    'POST diagram = "A -> B"', "HTTP 422",
    excerpt(models, 14, 27, "Validate the diagram field before the route"), 272),
  handoff("parseDiagram", "DiagramField", "Find the missing marker",
    "exampleSvg references url(#missing)", "Preview cannot render\nThe code field shows a marker error",
    excerpt(format, 218, 223, "Check the referenced marker IDs"), null, "missing-marker-error"),
  handoff("CreateTermForm", "DiagramViewer", "Preview the saved correction",
    "Replace the draft with exampleSvg and click Create", "Client is visible on the saved term",
    excerpt(field, 371, 377, "Render the saved diagram"), 282),
]);

const clear = reviewTest("SC-8 SVG: clear the optional diagram", spec, 287, [
  handoff("DiagramField", "UpdateTermForm", "Clear the SVG draft", "newDiagram = exampleSvg", 'newDiagram = ""',
    excerpt(terms, 240, 243, "Store the empty text area value")),
  sendEdit('""'), validateWrite('""'), storeUpdate('""'),
  handoff("GET /terms/{name}", "DiagramField", "Show the empty saved view",
    'GET diagram = ""', 'The UI shows "No diagram saved yet."\nGET returns an empty string',
    excerpt(field, 399, 403, "Render the empty diagram hint"), 295, "empty-diagram"),
]);

const legacy = reviewTest("SC-9 SVG: simulated legacy read preserves old text for correction", spec, 302, [
  handoff("Mock GET response", "DiagramField", "Open the legacy value",
    'diagram = "Legacy plain text"', 'The parser reports an error\nCode still shows "Legacy plain text"',
    excerpt(field, 309, 320, "Keep the original value after a parse error"), 313),
  handoff("DiagramField", "UpdateTermForm", "Keep the old text available to edit",
    'Click Update with "Legacy plain text"', 'Validation stops the update\nThe form still holds "Legacy plain text"',
    excerpt(terms, 245, 251, "Validate the draft before submitting"), 319, "legacy-text-preserved"),
  sendEdit("exampleSvg"), validateWrite("exampleSvg"), storeUpdate("exampleSvg"),
  handoff("GET /terms/{name}", "DiagramViewer", "Show the corrected SVG",
    "Remove the GET mock and save exampleSvg", "Client is visible\nGET diagram equals exampleSvg",
    excerpt(field, 371, 377, "Render the corrected diagram"), 323),
]);

function toolbar(theme) {
  return reviewTest("SC-1 SVG: compact toolbar and footnote in " + theme + " mode", spec, 427, [
    handoff("DiagramField", "DiagramViewer", "Open Preview in " + theme + " mode",
      "colorScheme = " + theme + "\nvalue = dockerSvg", "The canvas and its help text are rendered",
      excerpt(field, 264, 275, "Render the SVG and the help text"), 459),
    handoff("DiagramViewer", "Toolbar CSS", "Lay out the controls",
      "Code, Preview, Copy SVG, Zoom in, Zoom out, Reset", "Six controls have center lines less than 2 px apart",
      excerpt(css, 5, 25, "Align the controls in a flex row"), 442),
    zoomIn(469),
    handoff("Zoom out button", "DiagramViewer", "Zoom out from the keyboard",
      "zoom = 1.25\nPress Enter on Zoom out", "SVG transform includes scale(1)",
      excerpt(field, 222, 229, "Subtract a quarter step from zoom"), 475, "toolbar-" + theme),
    handoff("Browser viewport", "Toolbar CSS", "Check the same row at 390 px",
      "Viewport = 390 × 844", "Control centers still align\nThe page fits the viewport",
      excerpt(css, 20, 40, "Allow the control group to fit a narrow viewport"), 483, "toolbar-" + theme + "-narrow"),
    handoff("Code button", "DiagramField", "Read the SVG source in " + theme + " mode",
      'mode = "preview"\nvalue = dockerSvg', 'mode = "code"\nThe text area retains dockerSvg with distinct text and background colors',
      excerpt(field, 381, 390, "Show the same source in Code mode"), 493, "code-" + theme + "-narrow"),
  ]);
}

const sharedCases = reviewTest("test_shared_format_cases", apiSpec, 38, [
  handoff("Shared SVG fixture", "validate_svg", "Check an accepted source",
    'Case "source whitespace and Unicode"\nInput = case["source"]', "Returns the exact original string",
    excerpt(validator, 188, 196, "Return the original source after validation"), 41),
  handoff("Shared SVG fixture", "validate_svg", "Check a rejected source",
    'Case "text" contains A -> B', "Raises PydanticCustomError",
    excerpt(validator, 84, 92, "Reject invalid XML or an invalid root"), 43),
]);

const writes = reviewTest("test_writes_reject_invalid_before_database_and_preserve_valid_source", apiSpec, 47, [
  handoff("TestClient", "FastAPI validation", "Validate the create or update body",
    'POST or PATCH\nname = "Example"\ndiagram = case["source"]', "The diagram validator receives the string",
    excerpt(models, 14, 27, "Bind validation to the input field")),
  handoff("FastAPI route", "Mock execute_query", "Check the accepted write",
    'Accepted fixture "source whitespace and Unicode"', "POST returns 201 or PATCH returns 200\nQuery parameter matches the exact input",
    excerpt(api, 95, 110, "Pass the accepted string to the query"), 72),
  handoff("FastAPI validation", "TestClient", "Check the rejected write",
    'diagram = "A -> B"', "HTTP 422 · INVALID_SVG · diagram\nMock execute_query calls = 0",
    excerpt(models, 14, 27, "Reject the invalid input before the route"), 87),
]);

const reloadRules = reviewTest("test_shared_format_changes_apply_without_restarting_the_validator", apiSpec, 22, [
  handoff("Temporary format.json", "validate_svg", "Read the initial rules",
    "maxDepth = 20\nInput = connected-shapes.svg", "The validator returns the original SVG",
    excerpt(validator, 72, 82, "Read the rules at validation time"), 29),
  handoff("Replacement format.json", "validate_svg", "Reject the same SVG when the depth limit falls",
    "maxDepth = 1\nThe SVG source stays the same", "PydanticCustomError",
    excerpt(validator, 95, 101, "Apply the limit to each element depth"), 31),
  handoff("Restored format.json", "validate_svg", "Accept the same SVG again",
    "Restore maxDepth = 20", "The same validator returns the original SVG again",
    excerpt(validator, 75, 82, "Read the restored rules"), 35),
]);

const createCrud = reviewTest("real-stack: trim, normalize, and preserve Unicode and URL-sensitive names", crud, 42, [
  handoff("Create form input", "CreateTermForm", "Trim the name and definition",
    'name begins with "CAFÉ / HTTP? #100% & SQL" and has padding\ndefinition = "  Saved definition  "\ndiagram = padded exampleSvg',
    'definition = "Saved definition"\nThe SVG keeps its leading and trailing spaces',
    excerpt(terms, 105, 118, "Trim text fields and keep the diagram source")),
  sendCreate('exampleSvg with two spaces on each end'),
  validateWrite('exampleSvg with two spaces on each end'),
  storeCreate('exampleSvg with two spaces on each end', 57),
  handoff("getTerm", "Saved term view", "Reload the term by name",
    "The stored name contains URL-sensitive characters", "The lookup uses the encoded name\nThe view shows Saved definition",
    excerpt(actions, 58, 65, "Encode the name when reading the term"), 63),
]);

const editCrud = reviewTest("real-stack: rename and edit preserve the ID; clear optional text", crud, 101, [
  sendEdit('exampleSvg.replaceAll("Client", "Browser")'),
  validateWrite('exampleSvg.replaceAll("Client", "Browser")'),
  storeUpdate('exampleSvg.replaceAll("Client", "Browser")'),
  handoff("GET /terms/{name}", "Browser test", "Read the renamed term",
    "The edit sends a new name, After, and the modified SVG", "The new name has the original ID and edited SVG\nThe old name returns 404",
    excerpt(api, 130, 135, "Update the matched record"), 120),
  sendEdit('""'),
  handoff("update_term", "Neo4j", "Clear the optional fields on the same term",
    'definition = ""\ndiagram = ""', "The stored fields are empty strings\nThe ID is unchanged",
    excerpt(api, 130, 135, "Distinguish empty strings from null"), 132),
]);

const patchValues = reviewTest("real HTTP update: omitted and null values preserve fields; empty text clears fields", validation, 125, [
  handoff("Test HTTP client", "Neo4j", "Keep the diagram on omitted and null updates",
    "PATCH sends {} or null values\nStored diagram = exampleSvg", "HTTP 200\nGET returns the original term",
    excerpt(api, 130, 135, "Leave a field unchanged when its parameter is null"), 132),
  handoff("Test HTTP client", "FastAPI validation", "Reject incorrect field types",
    'name = 7\ndefinition = []\ndiagram = false', "HTTP 422 with name, definition, and diagram errors",
    excerpt(models, 21, 27, "Apply the declared field types"), 138),
  handoff("update_term", "Neo4j", "Clear the diagram with an empty string",
    'PATCH definition = "" and diagram = ""', "HTTP 200\nGET returns empty strings for both fields",
    excerpt(api, 130, 135, "Write the supplied empty strings"), 147),
]);

const graphIntegration = reviewTest("test_term_workflow_and_constraint", integration, 26, [
  storeCreate("SVG (connected-shapes.svg)", 40),
  handoff("TestClient", "Neo4j constraint", "Reject a conflicting rename",
    "PATCH tries to rename the first term to the existing second term", "HTTP 409 · TERM_ALREADY_EXISTS",
    excerpt(api, 145, 148, "Map the database constraint error to a conflict"), 56),
  storeUpdate('SVG.replace("Client", "Browser")'),
  handoff("Neo4j", "TestClient", "Read the updated term",
    "GET reads the renamed term", "Same ID\nDefinition is empty\nDiagram contains Browser",
    excerpt(api, 80, 92, "Read the current term fields"), 67),
]);

const behaviors = [
  {
    title: "Preview and save supported SVG without interaction metadata",
    detail: "Create, edit, and saved views use a common SVG field. Supported source renders in Preview and the saved value retains the original string.",
    sources: [source(field, 291), source(terms, 170), source(format, 105), source("api/models.py", 18)],
    tests: [
      createPreview,
      save, ordinary,
      writes, createCrud,
    ],
    gaps: [],
  },
  {
    title: "Preview, cancel, or save an edit",
    detail: "Preview applies to the draft. Cancel restores the saved SVG. Update persists the newly submitted source and refreshes the saved view.",
    sources: [source(terms, 204), source(terms, 240), source(hooks, 48), source(api, 122)],
    tests: [edit, editCrud, graphIntegration],
    gaps: [],
  },
  {
    title: "Clear a saved diagram",
    detail: "The optional SVG field can be cleared in the edit form.",
    sources: [source(terms, 240), source("frontend/src/actions.tsx", 92)],
    tests: [clear, patchValues],
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
    tests: [zoom, ordinary],
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
    tests: [details, move],
    gaps: [],
  },
  {
    title: "Reject unsupported input and allow correction",
    detail: "The browser and API use a shared set of SVG rules. Validation rejects malformed and unsupported content and preserves the input for correction.",
    sources: [source(format, 105), source(validator, 72), source("api/models.py", 18)],
    tests: [recover, sharedCases, writes],
    gaps: [],
  },
  {
    title: "Allow a legacy diagram value to be corrected",
    detail: "A previously stored text value remains available in Code view. The user can replace it with supported SVG.",
    sources: [source(field, 291), source(terms, 204)],
    tests: [legacy],
    gaps: ["The setup simulates a legacy GET. It does not migrate or read a database seeded with legacy text."],
  },
  ...["light", "dark"].map((theme) => ({
    title: "Keep the SVG controls compact in " + theme + " mode",
    detail: "The field puts labeled icons and mode controls on one row. It puts the help text under the image and follows the active theme.",
    sources: [source(field, 291), source("frontend/src/diagram/diagram.css", 1)],
    tests: [toolbar(theme)],
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
    tests: [reloadRules],
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
