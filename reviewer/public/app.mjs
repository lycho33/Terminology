const main = document.getElementById("main");
const back = document.getElementById("show-pulls");
const dialog = document.getElementById("preview");
const previewBody = document.getElementById("preview-body");
let pulls = [];
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
  current = null;
  loadGeneration++;
  dialog.close();
  back.hidden = true;
  main.replaceChildren(status("Loading open pull requests…"));
  main.setAttribute("aria-busy", "true");
  try {
    pulls = await api("/api/prs");
    renderPulls();
  } catch (error) {
    main.replaceChildren(status(error.message, true), button("Try again", showPulls, "primary"));
  } finally {
    main.setAttribute("aria-busy", "false");
  }
}

function renderPulls() {
  const header = element("div", { class: "page-heading" },
    element("div", {}, element("h1", {}, "Open pull requests")),
    button("Refresh", showPulls, "subtle"));
  const rows = element("ul", { class: "pull-list" });
  for (const pr of pulls) {
    rows.append(element("li", {},
      button(element("span", { class: "pull-title" },
        element("span", { class: "pr-number" }, "#" + pr.number), element("strong", {}, pr.title),
        tag(pr.draft ? "Draft" : "Open", pr.draft ? "neutral" : "green"),
        element("span", { "aria-hidden": "true", class: "arrow" }, "↗")),
      () => openPull(pr.number), "pull-button")));
  }
  main.replaceChildren(header, pulls.length ? rows : status("There are no open pull requests."));
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
  const pull = pulls.find((item) => item.number === number);
  current = null;
  back.hidden = false;
  main.setAttribute("aria-busy", "true");
  main.replaceChildren(element("h1", {}, pull?.title ?? "Pull request #" + number),
    status("Reading the PR, related code, and tests…"));
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
    renderReview();
  } catch (error) {
    if (loadGeneration !== generation) return;
    main.append(status(error.message, true), button("Try again", () => openPull(number), "subtle"));
  } finally {
    if (loadGeneration === generation) main.setAttribute("aria-busy", "false");
  }
}

function intentView(pr) {
  return element("details", { class: "intent" },
    element("summary", {}, pr.intent.kind),
    pr.intent.sources.map((item) => element("div", { class: "intent-source" },
      link(item.title, item.url), element("p", {}, item.body || "This source has no description."))));
}

function architectureView(pr) {
  const diagram = element("div", { class: "flow", "aria-label": "Term editor to Neo4j persistence" });
  const others = element("div", { class: "component-other" });
  const mainPath = ["editor", "data", "api", "database"];
  for (const [index, id] of mainPath.entries()) {
    if (index > 0) diagram.append(element("span", { class: "flow-arrow", title: pr.architecture.connections.find((edge) => edge.to === id && mainPath[index - 1] === edge.from)?.label, "aria-hidden": "true" }, "→"));
    diagram.append(component(pr.architecture.nodes.find((node) => node.id === id)));
  }
  for (const node of pr.architecture.nodes.filter((node) => !mainPath.includes(node.id))) {
    others.append(component(node));
  }
  return element("section", { class: "architecture", "aria-label": "Architecture" },
    element("div", { class: "section-heading" }, element("h2", {}, "Architecture"),
      tag("Changed in this PR", "green")),
    diagram, others);
}

function component(node) {
  const details = element("details", { class: "component" + (node.files.length ? " changed" : "") });
  const hint = node.files.length ? node.files.length + " changed" : "No changed files";
  details.append(element("summary", {}, element("strong", {}, node.label), element("span", {}, hint)),
    element("ul", {}, node.files.length
      ? node.files.map(({ path, revision }) => element("li", {}, sourceLink({ path, line: 1, revision }, path)))
      : element("li", {}, "No files in the PR diff.")));
  return details;
}

function behaviorList(pr) {
  const withGaps = pr.behaviors.filter((item) => !item.tests.length || item.gaps.length);
  const header = element("div", { class: "section-heading" }, element("h2", {}, "Behaviors"),
    withGaps.length ? tag(withGaps.length + " with test gaps", "amber") : null);
  const list = element("ul", { class: "behavior-list", "aria-label": "Changed and new behaviors" });
  for (const item of pr.behaviors) {
    const active = selectedBehavior === item;
    const chips = item.tests.length ? tag(item.tests.length + (item.tests.length === 1 ? " test" : " tests"))
      : tag("No related test found", "amber");
    const details = element("details", { class: "behavior" + (active ? " active" : ""), open: active ? "" : null },
      element("summary", {}, element("strong", {}, item.title), chips),
      element("div", { class: "behavior-body" },
        element("p", {}, item.detail),
        element("div", { class: "source-links" }, item.sources.map((source) => sourceLink(source))),
        item.gaps.length ? element("div", { class: "gap" }, element("strong", {}, "Test gap"),
          element("ul", {}, item.gaps.map((gap) => element("li", {}, gap)))) : null,
        element("div", { class: "test-list" }, item.tests.map((test) =>
          button(test.title, () => select(item, test), "test-choice", { "aria-pressed": selectedTest === test }))),
        button("Add behavior note", () => select(item), "text-button")));
    list.append(element("li", {}, details));
  }
  return element("section", { class: "behaviors" }, header,
    pr.method ? element("p", { class: "subhead" }, pr.method) : null,
    pr.reportError ? status(pr.reportError, true) : null,
    pr.fileListIncomplete ? status("GitHub did not return all changed files.") : null,
    pr.behaviors.length ? list : status("No behavior report is available for this revision."),
    pr.reportError ? button("Retry behavior report", () => openPull(pr.number), "subtle") : null);
}

function select(behavior, test = null) {
  selectedBehavior = behavior;
  selectedTest = test;
  stepIndex = 0;
  captureMessage = "";
  renderReview();
  requestAnimationFrame(() => document.getElementById("walkthrough-heading")?.focus());
}

function renderReview() {
  const pr = current;
  if (!pr) return;
  const hero = element("section", { class: "review-hero" },
    element("div", { class: "review-meta" }, tag("#" + pr.number, "neutral"),
      pr.draft ? tag("Draft") : null,
      link("Open on GitHub ↗", pr.url, "github-link"),
      element("code", { class: "commit" }, pr.head.slice(0, 8))),
    element("h1", {}, pr.title), intentView(pr));
  const grid = element("div", { class: "review-grid" },
    behaviorList(pr), element("div", { class: "inspect-col" }, walkthrough(pr), notePanel(pr)));
  main.replaceChildren(hero, architectureView(pr), grid);
}

function statusBadge(evidence) {
  return tag(evidence.result === "passed" ? evidence.browser + " passed" : evidence.browser + " · " + evidence.result,
    evidence.result === "passed" ? "green" : "amber");
}

function walkthrough(pr) {
  const title = element("h2", { id: "walkthrough-heading", tabindex: "-1" }, "Test walkthrough");
  if (!selectedBehavior) {
    return element("section", { class: "walkthrough" }, title,
      element("p", { class: "subhead" }, "Open a behavior and select a test."));
  }
  if (!selectedTest) {
    return element("section", { class: "walkthrough" }, title, element("h3", {}, selectedBehavior.title),
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
      step.value ? element("pre", {}, element("code", {}, step.value)) : null,
      element("p", {}, step.detail), sourceLink(step.source));
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

  return element("section", { class: "walkthrough" }, title, element("h3", {}, test.title),
    element("div", { class: "test-tools" }, sourceLink(test.source), evidence ? statusBadge(evidence) : null,
      browserTest ? button(capturePending ? "Test running…" : "Run browser test",
        () => capture(pr, test), "subtle", { disabled: capturePending ? "" : null }) : null),
    captureMessage ? status(captureMessage) : null,
    path,
    element("div", { class: "step-list", "aria-label": "Walkthrough steps" },
      test.steps.map((item, index) => button(item.title, () => {
        stepIndex = index;
        renderReview();
        document.querySelector(".step-list [aria-current=step]")?.focus();
      }, "step", { "aria-current": index === stepIndex ? "step" : null }))),
    details,
    addNote(selectedBehavior.title + " / " + test.title + (step ? " / " + step.title : ""), step?.source ?? test.source));
}

async function capture(pr, test) {
  capturePending = true;
  captureMessage = "";
  renderReview();
  try {
    pr.evidence[test.id] = await api("/api/prs/" + pr.number + "/capture", {
      head: pr.head, base: pr.base, test: test.id,
    });
    if (current === pr && selectedTest === test && !Object.keys(pr.evidence[test.id].images).length) {
      captureMessage = "The test ran. It did not attach any screenshots.";
    }
  } catch (error) {
    if (current === pr) captureMessage = error.message;
  } finally {
    if (current === pr) {
      capturePending = false;
      renderReview();
    }
  }
}

function addNote(context, source) {
  const field = element("textarea", { rows: "3", maxlength: "2000", required: "", placeholder: "Write a question or comment" });
  const form = element("form", { class: "note-form" },
    element("label", {}, "Review note", field),
    element("button", { type: "submit", class: "subtle" }, "Save draft"));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = field.value.trim();
    if (!text) return;
    notes.push({ id: crypto.randomUUID(), text, context, source, selected: false });
    storeNotes();
    noteMessage = "Draft saved.";
    renderReview();
  });
  return form;
}

function notePanel(pr) {
  const section = element("section", { class: "notes" },
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
      renderReview();
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
      renderReview();
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

back.addEventListener("click", showPulls);
api("/api/session").then(({ key }) => {
  sessionKey = key;
  return showPulls();
}).catch((error) => main.replaceChildren(status(error.message, true)));
