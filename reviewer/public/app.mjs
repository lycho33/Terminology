import { architecture, mapRegions } from "/components.mjs";

const main = document.getElementById("main");
const walkthroughDialog = document.getElementById("walkthrough-dialog");
const walkthroughBody = document.getElementById("walkthrough-body");
const dialog = document.getElementById("preview");
const previewBody = document.getElementById("preview-body");
let pulls = [];
let listLoading = true;
let listError = "";
let pendingPull;
let reviewError = "";
let failedPull;
let current;
let loadGeneration = 0;
let selectedBehavior;
let selectedTest;
let stepIndex = 0;
let notes = [];
let noteMessage = "";
let sentLink;
let captureMessage = "";
let capturePending = false;
let sessionKey;
const reviewing = new Map();
const codeRequests = new Map();

function element(tag, attributes = {}, ...children) {
  const item = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value != null) item.setAttribute(name, String(value));
  }
  item.append(...children.flat().filter((child) => child !== null && child !== undefined));
  return item;
}

function button(title, click, className = "", attributes = {}) {
  const item = element("button", { type: "button", class: className, ...attributes }, title);
  item.addEventListener("click", click);
  return item;
}

function status(text, error = false) {
  return element("p", { class: error ? "notice error" : "notice", role: error ? "alert" : "status" }, text);
}

function tag(text, style = "") {
  return element("span", { class: "tag " + style }, text);
}

function link(text, href, style = "") {
  const url = new URL(href, location.href);
  if (url.hostname !== "github.com" || url.protocol !== "https:") {
    return element("span", { class: style }, text);
  }
  return element("a", { href: url.href, target: "_blank", rel: "noopener", class: style }, text);
}

function sourceLink(source, title) {
  const path = source.path.split("/").map(encodeURIComponent).join("/");
  const label = title ?? source.path.split("/").at(-1) + ":" + source.line;
  return link(label, "https://github.com/lycho33/Terminology/blob/" + current[source.revision === "base" ? "base" : "head"] + "/" + path + "#L" + source.line, "source-link");
}

async function api(path, payload) {
  const response = await fetch(path, payload === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Reviewer-Key": sessionKey },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

async function showPulls() {
  listLoading = true;
  listError = "";
  renderReview();
  try {
    pulls = await api("/api/prs");
  } catch (error) {
    listError = error.message;
  } finally {
    listLoading = false;
    renderReview();
  }
}

function pullPicker() {
  const select = element("select", {
    id: "pull-picker", disabled: listLoading || !pulls.length ? "" : null,
  }, element("option", { value: "" }, listLoading ? "Loading open pull requests…" : "Choose an open pull request"));
  for (const pr of pulls) {
    const label = "#" + pr.number + " · " + (pr.draft ? "Draft" : "Open") + " · " + pr.title;
    select.append(element("option", { value: pr.number }, label));
  }
  select.value = pendingPull ?? current?.number ?? failedPull ?? "";
  select.addEventListener("change", () => openPull(Number(select.value)));
  return element("section", { class: "pull-control", "aria-label": "Pull request selection" },
    element("div", { class: "pull-field" },
      element("label", { for: "pull-picker" }, "Pull request"), select),
    pendingPull ? status("Reading code and tests for PR #" + pendingPull + "…") : null,
    !listLoading && !pulls.length && !listError ? status("There are no open pull requests.") : null,
    listError ? status(listError, true) : null,
    listError ? button("Retry open list", showPulls, "subtle") : null,
    reviewError ? status(reviewError, true) : null,
    reviewError ? button("Retry review", () => openPull(failedPull), "subtle") : null);
}

function draftKey(pr) {
  return "review-notes:" + pr.number + ":" + pr.head;
}

function savedNotes(pr) {
  if (!reviewing.has(draftKey(pr))) {
    try {
      reviewing.set(draftKey(pr), JSON.parse(localStorage.getItem(draftKey(pr))) ?? []);
    } catch {
      reviewing.set(draftKey(pr), []);
    }
  }
  return reviewing.get(draftKey(pr));
}

function storeNotes() {
  try {
    localStorage.setItem(draftKey(current), JSON.stringify(notes));
  } catch {
    // In-memory drafts still work when storage is unavailable.
  }
}

async function openPull(number) {
  const generation = ++loadGeneration;
  current = null;
  selectedBehavior = null;
  selectedTest = null;
  pendingPull = number || null;
  failedPull = null;
  reviewError = "";
  walkthroughDialog.close();
  dialog.close();
  renderReview();
  if (!number) return;
  try {
    const pr = await api("/api/prs/" + number);
    if (loadGeneration !== generation) return;
    current = pr;
    selectedBehavior = null;
    selectedTest = null;
    stepIndex = 0;
    noteMessage = "";
    sentLink = null;
    captureMessage = "";
    capturePending = false;
    notes = savedNotes(pr);
  } catch (error) {
    if (loadGeneration !== generation) return;
    failedPull = number;
    reviewError = error.message;
  } finally {
    if (loadGeneration === generation) {
      pendingPull = null;
      renderReview();
      document.getElementById("pull-picker").focus({ preventScroll: true });
    }
  }
}

function intentView(pr) {
  return element("details", { class: "intent" },
    element("summary", {}, pr.intent.kind),
    pr.intent.sources.map((item) => element("div", { class: "intent-source" },
      link(item.title, item.url), element("p", {}, item.body || "This source has no description."))));
}

function architectureView(pr) {
  const map = pr?.architecture ?? architecture([]);
  const steps = selectedTest?.steps ?? [];
  const step = steps[stepIndex];
  const active = step?.component;
  const route = new Set([...(selectedTest?.path ?? []), ...steps.map((item) => item.component).filter(Boolean)]);
  const regionIndex = (id) => mapRegions.findIndex((region) => region.members.includes(id));
  const from = regionIndex(steps[stepIndex - 1]?.component);
  const to = regionIndex(active);
  const diagram = element("div", { class: "map-canvas" + (selectedTest ? " tracing" : "") });
  for (const [index, region] of mapRegions.entries()) {
    if (index > 0) {
      const upstream = mapRegions[index - 1].members.at(-1);
      const edge = map.connections.find(({ from, to }) => from === upstream && region.members.includes(to));
      const onRoute = route.has(edge.from) && route.has(edge.to);
      const inMotion = from >= 0 && to >= 0 && index > Math.min(from, to) && index <= Math.max(from, to);
      diagram.append(element("div", {
        class: "map-connection" + (onRoute ? " route-edge" : "") + (inMotion ? " active-edge" : ""),
        "data-direction": inMotion && to < from ? "return" : null,
      }, element("span", {}, edge.label), element("i", { "aria-hidden": "true" })));
    }
    const members = region.members.map((id) => map.nodes.find((node) => node.id === id));
    const changed = members.some((node) => node.files.length);
    const isActive = region.members.includes(active);
    const onRoute = region.members.some((id) => route.has(id));
    diagram.append(element("article", {
      class: "map-region map-" + region.id + (changed ? " region-changed" : "") +
        (onRoute ? " region-on-route" : "") + (isActive ? " region-active" : ""),
      "data-region": region.id,
      "aria-current": isActive ? "step" : null,
    }, element("div", { class: "map-region-title" }, element("h2", {}, region.label),
      element("p", {}, region.platform)),
    element("div", { class: "map-modules" }, members.map((node) => mapModule(node, node.id === active))),
    isActive ? mapPayload(step) : null,
    pr && !changed ? element("p", { class: "map-unchanged" }, "No direct changes") : null));
  }
  const core = new Set(mapRegions.flatMap((region) => region.members));
  const otherChanges = map.nodes.filter((node) => !core.has(node.id) && !route.has(node.id) && node.files.length);
  const supporting = map.nodes.filter((node) => !core.has(node.id) && route.has(node.id));
  return element("section", { class: "architecture", "aria-labelledby": "architecture-title" },
    element("div", { class: "map-heading" },
      element("h1", { id: "architecture-title" }, "Architecture map"),
      element("div", { class: "map-legend-row" },
        pr ? tag("Changed in PR #" + pr.number, "map-legend") : null,
        selectedTest ? tag("Test path", "route-legend") : null,
        selectedTest ? element("a", { class: "board-sidebar-link", href: "#board-sidebar" }, "Behaviors") : null)),
    diagram,
    supporting.length ? element("div", { class: "map-support-items", "aria-label": "Supporting test components" },
      supporting.map((node) => element("div", { class: "supporting-node" },
        mapModule(node, node.id === active), node.id === active ? mapPayload(step) : null))) : null,
    otherChanges.length ? element("details", { class: "map-support" },
      element("summary", {}, "Other changed areas", element("span", {}, otherChanges.map((node) => node.label).join(" · "))),
      element("div", { class: "map-support-items" }, otherChanges.map((node) => mapModule(node)))) : null);
}

function mapPayload(step) {
  return element("div", { class: "map-payload" },
    element("span", {}, "Current step"), element("strong", {}, step.payload || step.title));
}

function mapModule(node, isActive = false) {
  const cls = "map-module" + (isActive ? " map-module-active" : "");
  if (!node.files.length) return element("div", { class: cls }, node.label);
  const count = node.files.length;
  return element("details", { class: cls + " changed" },
    element("summary", {}, element("span", {}, node.label), tag(count + (count === 1 ? " file" : " files"), "changed-label")),
    element("ul", {}, node.files.map(({ path, revision }) =>
      element("li", {}, sourceLink({ path, line: 1, revision }, path.split("/").at(-1))))));
}

function behaviorList(pr) {
  const withGaps = pr.behaviors.filter((item) => !item.tests.length || item.gaps.length);
  const header = element("div", { class: "section-heading" }, element("h2", {}, "Behaviors"),
    withGaps.length ? tag(withGaps.length + " with test gaps", "amber") : null);
  const list = element("ul", { class: "behavior-list", "aria-label": "Changed and new behaviors" });
  for (const item of pr.behaviors) {
    const tests = item.tests.length
      ? element("ul", { class: "test-list", "aria-label": "Related tests for " + item.title },
        item.tests.map((test) => element("li", {},
          button(test.title, () => selectTest(item, test), "test-choice", {
            "data-test": test.id, "aria-pressed": String(selectedTest === test),
          }))))
      : null;
    const badge = !item.tests.length ? tag("No related test found", "amber")
      : item.gaps.length ? tag("Test gap", "amber")
      : element("span", { class: "test-count" }, item.tests.length + (item.tests.length === 1 ? " test" : " tests"));
    list.append(element("li", {},
      element("details", { class: "behavior", open: selectedBehavior === item ? "" : null },
        element("summary", {}, element("span", {}, item.title), badge),
        element("div", { class: "behavior-detail" }, tests, element("p", {}, item.detail),
          item.gaps.length ? element("div", { class: "gap" },
            element("ul", {}, item.gaps.map((gap) => element("li", {}, gap)))) : null,
          element("div", { class: "behavior-actions" },
            item.sources.length ? element("details", { class: "behavior-sources" },
              element("summary", {}, "Source links"),
              element("div", { class: "source-links" }, item.sources.map((source) => sourceLink(source)))) : null,
            button("Add behavior note", () => openBehaviorNote(item), "text-button"))))));
  }
  return element("section", { class: "behaviors", "aria-label": "Behaviors and tests" }, header,
    pr.method ? element("p", { class: "subhead" }, pr.method) : null,
    pr.reportError ? status(pr.reportError, true) : null,
    pr.fileListIncomplete ? status("GitHub did not return all changed files.") : null,
    pr.behaviors.length ? list : status("No behavior report is available for this revision."),
    pr.reportError ? button("Retry behavior report", () => openPull(pr.number), "subtle") : null);
}

function openBehaviorNote(behavior) {
  const title = element("h2", { id: "walkthrough-heading", tabindex: "-1" }, "Behavior note");
  walkthroughBody.replaceChildren(element("section", { class: "walkthrough" },
    element("div", { class: "section-heading walkthrough-header" }, title,
      button("Close", () => walkthroughDialog.close(), "subtle", { "aria-label": "Close walkthrough" })),
    element("h3", {}, behavior.title), element("p", {}, behavior.detail),
    addNote(behavior.title, behavior.sources[0])));
  walkthroughDialog.showModal();
  title.focus({ preventScroll: true });
}

function selectTest(behavior, test) {
  selectedBehavior = behavior;
  selectedTest = test;
  stepIndex = 0;
  captureMessage = "";
  renderSelection();
  if (matchMedia("(max-width: 719px)").matches) {
    document.getElementById("board-map").scrollIntoView({ block: "start" });
  }
}

function renderSelection() {
  document.getElementById("board-map").replaceChildren(architectureView(current));
  document.getElementById("board-trace").replaceChildren(selectedTest ? walkthrough(current) : "");
  for (const control of main.querySelectorAll("[data-test]")) {
    control.setAttribute("aria-pressed", String(control.dataset.test === selectedTest?.id));
  }
}

function renderReview() {
  const pr = current;
  const summary = pr ? element("details", { class: "review-hero" },
    element("summary", {}, "PR #" + pr.number, pr.draft ? " · Draft" : ""),
    element("p", { class: "pr-heading" }, pr.title),
    element("div", { class: "review-meta" }, link("Open on GitHub ↗", pr.url, "github-link"),
      element("code", { class: "commit" }, pr.head.slice(0, 8))),
    intentView(pr)) : null;
  const map = element("div", { id: "board-map" }, architectureView(pr));
  const sidebar = element("aside", { id: "board-sidebar", class: "board-sidebar", "aria-label": "Review sidebar" }, pullPicker(), summary,
    pr ? behaviorList(pr) : null, pr ? notePanel(pr) : null);
  const trace = element("div", { id: "board-trace" }, pr && selectedTest ? walkthrough(pr) : null);
  main.replaceChildren(element("div", { class: "board" }, map, sidebar, trace));
}

function statusBadge(evidence) {
  return tag(evidence.result === "passed" ? evidence.browser + " passed" : evidence.browser + " · " + evidence.result,
    evidence.result === "passed" ? "green" : "amber");
}

function excerptBlock(excerpt) {
  const name = excerpt.path.split("/").at(-1);
  const range = name + ":" + excerpt.line + (excerpt.end > excerpt.line ? "–" + excerpt.end : "");
  const heading = element("div", { class: "excerpt-heading" },
    element("strong", {}, excerpt.label), sourceLink(excerpt, range));
  if (excerpt.unavailable) {
    return element("figure", { class: "code-excerpt" }, heading,
      element("p", {}, "This excerpt could not be loaded. Open its source link."));
  }
  const lines = excerpt.lines.map((line, index) =>
    element("span", { class: "excerpt-line" },
      element("span", { class: "line-number", "aria-hidden": "true" }, excerpt.line + index),
      element("span", {}, line || " "), "\n"));
  return element("figure", { class: "code-excerpt" }, heading,
    element("pre", {}, element("code", {}, lines)));
}

function implementationCode(pr, test, index) {
  const body = element("div", { class: "excerpt-list" }, status("Loading source…"));
  const section = element("section", { class: "implementation-code", "aria-label": "Implementation code" },
    body);
  const revision = new URLSearchParams({ head: pr.head, base: pr.base });
  const url = "/api/prs/" + pr.number + "/source/" + test.id + "/" + index + "?" + revision;
  if (!codeRequests.has(url)) {
    const request = api(url).catch((error) => {
      codeRequests.delete(url);
      throw error;
    });
    codeRequests.set(url, request);
  }
  codeRequests.get(url).then(({ excerpts }) => {
    body.replaceChildren(...excerpts.map(excerptBlock));
  }).catch((error) => body.replaceChildren(status(error.message, true)));
  return section;
}

function fixtureValues(step) {
  const after = step.after || step.value;
  if (!step.before && !after) return null;
  return element("section", { class: "fixture-values", "aria-label": "Test values" },
    element("h5", {}, "Test values"),
    step.before ? element("div", { class: "fixture-value" }, element("strong", {}, "Input"),
      element("pre", {}, element("code", {}, step.before))) : null,
    after ? element("div", { class: "fixture-value" }, element("strong", {}, "Result"),
      element("pre", {}, element("code", {}, after))) : null);
}

function selectStep(index) {
  stepIndex = index;
  renderSelection();
  document.getElementById("walkthrough-step").focus({ preventScroll: true });
  if (matchMedia("(min-width: 720px)").matches) {
    document.getElementById("board-map").scrollIntoView({ block: "nearest" });
  }
}

function stepNavigation(test) {
  if (test.steps.length < 2) return null;
  const steps = element("select", { id: "walkthrough-step", "aria-label": "Walkthrough step" },
    test.steps.map((step, index) => element("option", { value: index },
      (index + 1) + " of " + test.steps.length + " · " + step.title)));
  steps.value = stepIndex;
  steps.addEventListener("change", () => selectStep(Number(steps.value)));
  return element("div", { class: "step-nav", "aria-label": "Step controls" },
    button("Previous", () => selectStep(stepIndex - 1), "subtle", { disabled: stepIndex === 0 ? "" : null }),
    steps,
    button("Next", () => selectStep(stepIndex + 1), "subtle", { disabled: stepIndex === test.steps.length - 1 ? "" : null }));
}

function screenshotEvidence(step, evidence) {
  if (!step.attachment) return null;
  const image = evidence?.images[step.attachment];
  return element("details", { class: "walkthrough-disclosure", open: image ? "" : null },
    element("summary", {}, "Browser screenshot"),
    image ? element("figure", { class: "capture" }, element("img", {
      src: image, alt: step.title + " from the " + evidence.browser + " browser test",
    }), element("figcaption", {}, evidence.browser + " · " + evidence.result + " · " + evidence.head.slice(0, 8)))
      : element("p", { class: "subhead" }, "Run this browser test to capture the step."));
}

function walkthrough(pr) {
  const test = selectedTest;
  const evidence = pr.evidence[test.id];
  const browserTest = test.source.path.startsWith("frontend/e2e/");
  const step = test.steps[stepIndex];
  const header = element("header", { class: "trace-header" },
    element("div", { class: "trace-title" },
      element("h2", {}, "Test walkthrough"),
      element("p", { class: "walkthrough-test-title" }, test.title)),
    stepNavigation(test));
  const checkpoint = step
    ? element("section", { class: "checkpoint" },
      element("div", { class: "checkpoint-heading" }, element("h3", {}, step.title), tag(step.basis, "neutral"),
        sourceLink(step.source, "Step reference")),
      element("p", {}, step.detail), fixtureValues(step), screenshotEvidence(step, evidence),
      element("details", { class: "walkthrough-disclosure" }, element("summary", {}, "Implementation code"),
        implementationCode(pr, test, stepIndex)))
    : status("This test has no walkthrough steps.");
  const context = selectedBehavior.title + " / " + test.title + (step ? " / " + step.title : "");
  const tools = element("div", { class: "test-tools" }, sourceLink(test.source), evidence ? statusBadge(evidence) : null,
    browserTest ? button(capturePending ? "Test running…" : "Run browser test",
      () => capture(pr, test), "subtle", { disabled: capturePending ? "" : null }) : null);
  const note = element("details", { class: "walkthrough-disclosure" },
    element("summary", {}, "Add review note"), addNote(context, step?.source ?? test.source));
  return element("section", { class: "board-walkthrough", "aria-label": "Test walkthrough" }, header,
    captureMessage ? status(captureMessage) : null, checkpoint, tools, note);
}

async function capture(pr, test) {
  capturePending = true;
  captureMessage = "";
  renderSelection();
  try {
    pr.evidence[test.id] = await api("/api/prs/" + pr.number + "/capture", {
      head: pr.head, base: pr.base, test: test.id,
    });
    if (current === pr && selectedTest === test && !Object.keys(pr.evidence[test.id].images).length) {
      captureMessage = "The test ran. It did not attach any screenshots.";
    }
  } catch (error) {
    if (current === pr && selectedTest === test) captureMessage = error.message;
  } finally {
    if (current === pr) {
      capturePending = false;
      renderSelection();
    }
  }
}

function addNote(context, source) {
  const field = element("textarea", { rows: "3", maxlength: "2000", required: "", placeholder: "Write a question or comment" });
  const feedback = element("span", { role: "status" });
  const form = element("form", { class: "note-form" },
    element("label", {}, "Review note", field),
    element("div", { class: "note-form-actions" },
      element("button", { type: "submit", class: "subtle" }, "Save draft"), feedback));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = field.value.trim();
    if (!text) return;
    notes.push({ id: crypto.randomUUID(), text, context, source, selected: false });
    storeNotes();
    field.value = "";
    feedback.textContent = "Draft saved.";
    noteMessage = "Draft saved.";
    renderNotes();
  });
  return form;
}

function renderNotes() {
  document.getElementById("review-notes").replaceWith(notePanel(current));
}

function notePanel(pr) {
  const section = element("section", { id: "review-notes", class: "notes" },
    element("div", { class: "section-heading" }, element("h2", {}, "Review notes"), tag(String(notes.length))));
  if (!notes.length) section.append(element("p", { class: "subhead" }, "Notes you save to this review appear here."));
  const preview = button("Preview selected notes", () => showPreview(pr), "primary",
    { disabled: notes.some((note) => note.selected) ? null : "" });
  for (const note of notes) {
    const choice = element("input", { type: "checkbox", checked: note.selected ? "" : null });
    const label = element("label", { class: "note-choice" }, choice,
      element("span", {}, element("small", {}, note.context), element("span", {}, note.text)));
    choice.addEventListener("change", () => {
      note.selected = choice.checked;
      preview.disabled = !notes.some((item) => item.selected);
      storeNotes();
    });
    const remove = button("Delete draft", () => {
      notes.splice(notes.indexOf(note), 1);
      storeNotes();
      renderNotes();
    }, "text-button");
    section.append(element("div", { class: "note" }, label, remove));
  }
  if (notes.length) section.append(preview);
  if (noteMessage) section.append(status(noteMessage));
  if (sentLink) section.append(link("View sent notes on GitHub ↗", sentLink));
  return section;
}

function showPreview(pr) {
  const selected = notes.filter((note) => note.selected);
  if (!selected.length) return;
  const listing = element("ol", { class: "preview-notes" }, selected.map((note) =>
    element("li", {}, element("strong", {}, note.context), element("p", {}, note.text),
      note.source ? sourceLink(note.source) : null)));
  const feedback = element("div", { role: "status" });
  const cancel = button("Back", () => dialog.close(), "subtle");
  const submissionKey = selected.map((note) => note.id).join(":");
  const submissionId = sessionStorage.getItem("submission:" + submissionKey) ?? crypto.randomUUID();
  const send = button("Send to GitHub", async () => {
    sessionStorage.setItem("submission:" + submissionKey, submissionId);
    send.disabled = true;
    cancel.disabled = true;
    feedback.textContent = "Submitting review…";
    try {
      const result = await api("/api/prs/" + pr.number + "/send", {
        head: pr.head, base: pr.base, requestId: submissionId, notes: selected,
      });
      for (const note of selected) notes.splice(notes.indexOf(note), 1);
      storeNotes();
      dialog.close();
      noteMessage = "Selected notes sent.";
      sentLink = result.url;
      renderNotes();
    } catch (error) {
      feedback.textContent = error.message;
      send.disabled = false;
      cancel.disabled = false;
    }
  }, "primary");
  previewBody.replaceChildren(element("h2", { id: "preview-heading" }, "Send selected notes"),
    element("p", {}, "Terminology PR #" + pr.number + " · " + pr.head.slice(0, 8)),
    listing, feedback, element("div", { class: "dialog-actions" }, cancel, send));
  dialog.showModal();
}

void showPulls();
api("/api/session").then(({ key }) => {
  sessionKey = key;
}).catch((error) => {
  listError = error.message;
  renderReview();
});
