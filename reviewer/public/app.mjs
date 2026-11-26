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
  const diagram = element("div", { class: "map-canvas" });
  for (const [index, region] of mapRegions.entries()) {
    if (index > 0) {
      const upstream = mapRegions[index - 1].members.at(-1);
      const edge = map.connections.find(({ from, to }) => from === upstream && region.members.includes(to));
      diagram.append(element("div", { class: "map-connection" }, element("span", {}, edge.label),
        element("i", { "aria-hidden": "true" })));
    }
    const members = region.members.map((id) => map.nodes.find((node) => node.id === id));
    const changed = members.some((node) => node.files.length);
    diagram.append(element("article", {
      class: "map-region map-" + region.id + (changed ? " region-changed" : ""),
      "data-region": region.id,
    }, element("div", { class: "map-region-title" }, element("h2", {}, region.label),
      element("p", {}, region.platform)),
    element("div", { class: "map-modules" }, members.map(mapModule)),
    pr && !changed ? element("p", { class: "map-unchanged" }, "No direct changes") : null));
  }
  const members = new Set(mapRegions.flatMap((region) => region.members));
  const otherChanges = map.nodes.filter((node) => !members.has(node.id) && node.files.length);
  return element("section", { class: "architecture", "aria-labelledby": "architecture-title" },
    element("div", { class: "map-heading" },
      element("h1", { id: "architecture-title" }, "Architecture map"),
      pr ? tag("Changed in PR #" + pr.number, "map-legend") : null),
    diagram,
    otherChanges.length ? element("details", { class: "map-support" },
      element("summary", {}, "Other changed areas", element("span", {}, otherChanges.map((node) => node.label).join(" · "))),
      element("div", { class: "map-support-items" }, otherChanges.map(mapModule))) : null);
}

function mapModule(node) {
  if (!node.files.length) return element("div", { class: "map-module" }, node.label);
  const count = node.files.length;
  return element("details", { class: "map-module changed" },
    element("summary", {}, element("span", {}, node.label), tag(count + (count === 1 ? " file" : " files"), "changed-label")),
    element("ul", {}, node.files.map(({ path, revision }) =>
      element("li", {}, sourceLink({ path, line: 1, revision }, path.split("/").at(-1))))));
}

function behaviorList(pr) {
  const withGaps = pr.behaviors.filter((item) => !item.tests.length || item.gaps.length);
  const header = element("div", { class: "section-heading" }, element("h2", {}, "Behaviors and tests"),
    withGaps.length ? tag(withGaps.length + " with test gaps", "amber") : null);
  const list = element("ul", { class: "behavior-list", "aria-label": "Changed and new behaviors" });
  for (const item of pr.behaviors) {
    const detail = element("div", { class: "behavior-detail" }, element("h3", {}, item.title),
      element("p", {}, item.detail),
      item.gaps.length ? element("div", { class: "gap" }, element("strong", {}, "Test gap"),
        element("ul", {}, item.gaps.map((gap) => element("li", {}, gap)))) : null,
      element("div", { class: "behavior-actions" },
        item.sources.length ? element("details", { class: "behavior-sources" },
          element("summary", {}, "Source links"),
          element("div", { class: "source-links" }, item.sources.map((source) => sourceLink(source)))) : null,
        button("Add behavior note", () => openWalkthrough(item), "text-button")));
    const tests = item.tests.length
      ? element("ul", { class: "test-list", "aria-label": "Related tests for " + item.title },
        item.tests.map((test) => element("li", {},
          button(test.title, () => openWalkthrough(item, test), "test-choice", { "aria-haspopup": "dialog" }))))
      : element("div", { class: "test-empty" }, tag("No related test found", "amber"));
    list.append(element("li", { class: "behavior" }, detail, tests));
  }
  return element("section", { class: "behaviors" }, header,
    pr.method ? element("p", { class: "subhead" }, pr.method) : null,
    pr.reportError ? status(pr.reportError, true) : null,
    pr.fileListIncomplete ? status("GitHub did not return all changed files.") : null,
    pr.behaviors.length ? list : status("No behavior report is available for this revision."),
    pr.reportError ? button("Retry behavior report", () => openPull(pr.number), "subtle") : null);
}

function openWalkthrough(behavior, test = null) {
  selectedBehavior = behavior;
  selectedTest = test;
  stepIndex = 0;
  captureMessage = "";
  renderWalkthrough();
  walkthroughDialog.showModal();
  document.getElementById("walkthrough-heading").focus({ preventScroll: true });
}

function renderWalkthrough() {
  walkthroughBody.replaceChildren(walkthrough(current));
}

function renderReview() {
  const pr = current;
  const summary = pr ? element("section", { class: "review-hero" },
    element("div", { class: "review-meta" }, tag("#" + pr.number, "neutral"),
      pr.draft ? tag("Draft") : null,
      link("Open on GitHub ↗", pr.url, "github-link"),
      element("code", { class: "commit" }, pr.head.slice(0, 8))),
    element("h2", { class: "pr-heading" }, pr.title), intentView(pr)) : null;
  const content = [architectureView(pr), pullPicker()];
  if (pr) content.push(summary, behaviorList(pr), notePanel(pr));
  main.replaceChildren(...content);
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
    element("h5", {}, "Implementation code"), body);
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
  renderWalkthrough();
  walkthroughBody.querySelector(".step-list [aria-current=step]").focus();
}

function walkthrough(pr) {
  const title = element("h2", { id: "walkthrough-heading", tabindex: "-1" },
    selectedTest ? "Test walkthrough" : "Behavior note");
  const header = element("div", { class: "section-heading walkthrough-header" }, title,
    button("Close", () => walkthroughDialog.close(), "subtle", { "aria-label": "Close walkthrough" }));
  if (!selectedTest) {
    return element("section", { class: "walkthrough" }, header, element("h3", {}, selectedBehavior.title),
      element("p", {}, selectedBehavior.detail), addNote(selectedBehavior.title, selectedBehavior.sources[0]));
  }

  const test = selectedTest;
  const evidence = pr.evidence[test.id];
  const browserTest = test.source.path.startsWith("frontend/e2e/");
  const step = test.steps[stepIndex];
  const nodes = pr.architecture.nodes.filter((node) => test.path.includes(node.id));
  const path = element("ol", { class: "test-path", "aria-label": "Affected components" },
    test.path.map((id) => {
      const node = nodes.find((item) => item.id === id);
      return element("li", { class: node.files.length ? "on-path changed" : "on-path" }, node.label);
    }));
  const details = element("div", { class: "checkpoint" });
  if (step) {
    details.append(element("div", { class: "checkpoint-heading" },
      element("h4", {}, step.title), tag(step.basis, "neutral")),
      element("p", {}, step.detail),
      sourceLink(step.source, "Step reference"),
      element("div", { class: "checkpoint-grid" },
        implementationCode(pr, test, stepIndex), fixtureValues(step)));
    if (step.attachment) {
      const image = evidence?.images[step.attachment];
      details.append(image ? element("figure", { class: "capture" }, element("img", {
        src: image, alt: step.title + " from the " + evidence.browser + " browser test",
      }), element("figcaption", {}, evidence.browser + " · " + evidence.result + " · " + evidence.head.slice(0, 8)))
        : element("p", { class: "subhead" }, "Screenshot pending. Run this browser test to capture the step."));
    }
  } else {
    details.append(status("This test has no walkthrough steps."));
  }

  return element("section", { class: "walkthrough" }, header, element("h3", {}, test.title),
    element("div", { class: "test-tools" }, sourceLink(test.source), evidence ? statusBadge(evidence) : null,
      browserTest ? button(capturePending ? "Test running…" : "Run browser test",
        () => capture(pr, test), "subtle", { disabled: capturePending ? "" : null }) : null),
    captureMessage ? status(captureMessage) : null,
    path,
    test.steps.length > 1 ? element("div", { class: "step-nav", "aria-label": "Step controls" },
      button("Previous", () => selectStep(stepIndex - 1), "subtle", { disabled: stepIndex === 0 ? "" : null }),
      element("span", {}, "Step " + (stepIndex + 1) + " of " + test.steps.length),
      button("Next", () => selectStep(stepIndex + 1), "subtle", { disabled: stepIndex === test.steps.length - 1 ? "" : null })) : null,
    element("div", { class: "step-list", "aria-label": "Walkthrough steps" },
      test.steps.map((item, index) => button(item.title, () => selectStep(index),
        "step", { "aria-current": index === stepIndex ? "step" : null }))),
    details,
    addNote(selectedBehavior.title + " / " + test.title + (step ? " / " + step.title : ""), step?.source ?? test.source));
}

async function capture(pr, test) {
  capturePending = true;
  captureMessage = "";
  renderWalkthrough();
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
      if (walkthroughDialog.open) renderWalkthrough();
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
