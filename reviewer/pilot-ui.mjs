const spec = "frontend/e2e/svg-diagram.spec.mjs";
const crud = "frontend/e2e/crud.spec.mjs";
export const connectedSvg = "docs/skill-graph/examples/connected-shapes.svg";
export const dockerSvg = "docs/skill-graph/examples/docker-image.svg";

function editor(screen, name, values = {}) {
  return { screen, name, mode: "code", fixture: connectedSvg, ...values };
}

function preview(name, values = {}) {
  return editor("saved", name, { mode: "preview", ...values });
}

function repeat(frame, number) {
  return Array(number).fill(frame);
}

const copyDraft = editor("create", "SVG source", { variant: "unicode", action: "Create", pending: true });
const copyCode = editor("saved", "SVG source", { variant: "unicode" });
const dockerPreview = preview("Docker image example", { screen: "create", fixture: dockerSvg });
const dockerSave = editor("create", "Docker image example", { fixture: dockerSvg, action: "Create", pending: true });
const zoomed = { zoom: 1.25, action: "Zoom in" };
const reset = { action: "Reset view" };
const narrow = { width: 390 };
const editCode = editor("edit", "SVG edit");
const editSubmit = editor("edit", "SVG edit", { variant: "browser", action: "Update", pending: true });
const clearSubmit = editor("edit", "SVG clear", { value: "", action: "Update", pending: true });
const invalid = "Enter complete, well-formed SVG code.";
const legacyCode = editor("saved", "SVG legacy", { value: "Legacy plain text", error: invalid });
const legacySubmit = editor("edit", "SVG legacy", { action: "Update", pending: true });
const createCrudName = "CAFÉ / HTTP? #100% & SQL";
const createCrudSubmit = editor("create", createCrudName, {
  variant: "padded", definition: "  Saved definition  ", action: "Create", pending: true,
});
const renameSubmit = editor("edit", "after", { variant: "browser", definition: "After", action: "Update", pending: true });
const crudClearSubmit = editor("edit", "after", { value: "", definition: "", action: "Update", pending: true });

function toolbarFrames(test) {
  const theme = test.title.endsWith("dark mode") ? "dark" : "light";
  const toolbar = { ...dockerPreview, theme };
  return [
    { ...toolbar, action: "Preview" },
    toolbar,
    { ...toolbar, ...zoomed },
    { ...toolbar, action: "Zoom out" },
    { ...toolbar, ...narrow },
    { ...toolbar, ...narrow, mode: "code", action: "Code" },
  ];
}

const framesByTest = new Map([
  [spec + ":65", [
    ...repeat(copyDraft, 3),
    { ...copyCode, action: "Code" },
    { ...copyCode, action: "Copy SVG", status: "SVG copied." },
    { ...copyCode, action: "Copy SVG", status: "Copy failed. Select the SVG code and copy it manually." },
  ]],
  [spec + ":108", [
    preview("SVG view", zoomed),
    preview("SVG view", { zoom: 1.25, pan: [25, 15], action: "Drag background" }),
    preview("SVG view", reset),
    preview("SVG view", narrow),
  ]],
  [spec + ":147", [
    preview("SVG drag", zoomed),
    preview("SVG drag", { zoom: 1.25, pan: [10, 5], action: "Drag background" }),
    preview("SVG drag", { zoom: 1.25, pan: [10, 5], focus: "client", action: "Drag Client" }),
    preview("SVG drag", { zoom: 1.25, pan: [10, 5], client: [24, 16], focus: "client" }),
    preview("SVG drag", { zoom: 1.25, pan: [10, 5], client: [24, 16], server: [-10, 0],
      focus: "server", action: "Press ArrowLeft" }),
    preview("SVG drag", reset),
  ]],
  [spec + ":196", [
    preview("SVG details", { focus: "client", action: "Click Client" }),
    preview("SVG details", { selected: "client", focus: "client" }),
    preview("SVG details", { selected: "client", focus: "server", action: "Press Enter" }),
    preview("SVG details", { selected: "server", focus: "server" }),
  ]],
  [spec + ":214", [
    editCode,
    { ...editCode, mode: "preview", variant: "browser", action: "Preview" },
    preview("SVG edit", { action: "Cancel update" }),
    ...repeat(editSubmit, 4),
    preview("SVG edit", { variant: "browser" }),
  ]],
  [spec + ":249", [
    editor("create", "SVG recovery", { value: "A -> B", error: invalid, action: "Create" }),
    editor("create", "SVG recovery", { value: "A -> B", error: invalid }),
    editor("create", "SVG recovery", { variant: "missing-marker", error: "The SVG references a missing arrow marker." }),
    preview("SVG recovery", { action: "Create" }),
  ]],
  [spec + ":287", [
    { ...clearSubmit, action: "Clear diagram", pending: false },
    ...repeat(clearSubmit, 3),
    preview("SVG clear", { value: "" }),
  ]],
  [spec + ":302", [
    { ...legacyCode, action: "Code" },
    { ...legacyCode, screen: "edit", action: "Update" },
    ...repeat(legacySubmit, 3),
    preview("SVG legacy"),
  ]],
  [spec + ":333", [
    { ...dockerPreview, mode: "code" },
    { ...dockerPreview, action: "Preview" },
    { ...dockerPreview, ...zoomed },
    { ...dockerPreview, zoom: 1.25, pan: [30, 15], action: "Drag diagram" },
    { ...dockerPreview, ...reset },
    ...repeat(dockerSave, 3),
    preview("Docker image example", { fixture: dockerSvg, ...narrow }),
  ]],
  [spec + ":427", toolbarFrames],
  [crud + ":42", [
    { ...createCrudSubmit, name: "  " + createCrudName + "  ", action: "Fill form", pending: false },
    ...repeat(createCrudSubmit, 3),
    preview("Café / http? #100% & sql", { definition: "Saved definition" }),
  ]],
  [crud + ":101", [
    ...repeat(renameSubmit, 3),
    preview("After", { variant: "browser", definition: "After" }),
    crudClearSubmit,
    preview("After", { value: "", definition: "" }),
  ]],
]);

export function withUiReplay(test) {
  const scenes = framesByTest.get(test.source.path + ":" + test.source.line);
  if (!scenes) return test;
  const frames = typeof scenes === "function" ? scenes(test) : scenes;
  if (frames.length !== test.steps.length) throw new Error("UI replay does not match " + test.title);
  return { ...test, steps: test.steps.map((step, index) => ({ ...step, ui: frames[index] })) };
}
