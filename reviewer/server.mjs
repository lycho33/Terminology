import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { architecture, componentForPath, components } from "./components.mjs";
import { createGitHub, repository } from "./github.mjs";
import { analyze } from "./analyze.mjs";
import { captureBrowser, readEvidence } from "./evidence.mjs";
import { isPilot } from "./pilot.mjs";
import { dockerSvg } from "./pilot-ui.mjs";

const publicFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/diagram-replay.mjs", ["diagram-replay.mjs", "text/javascript; charset=utf-8"]],
  ["/components.mjs", ["../components.mjs", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
]);
const publicRoot = new URL("./public/", import.meta.url);
const commit = /^[a-f0-9]{40}$/;
const run = promisify(execFile);
const validPath = (path) =>
  typeof path === "string" && /^[\w./ @+()-]+$/.test(path) &&
  !path.startsWith("/") && !path.split("/").some((part) => part === "..");
const sourceLocation = (item) => item && validPath(item.path) && Number.isSafeInteger(item.line) && item.line > 0;
const codeRange = (item) => sourceLocation(item) && Number.isSafeInteger(item.end) && item.end >= item.line;
const json = (response, status, body) => write(response, status, "application/json; charset=utf-8", JSON.stringify(body));

function write(response, status, type, content) {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'",
  });
  response.end(content);
}

async function readBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > 100_000) throw new Error("The request exceeds the size limit.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

function normalizePilotOrDraft(report) {
  const ids = new Set(components.map(({ id }) => id));
  return report.behaviors.map((behavior, behaviorIndex) => ({
    ...behavior,
    id: String(behaviorIndex),
    sources: behavior.sources.filter(sourceLocation),
    tests: behavior.tests.filter((test) => sourceLocation(test.source)).map((test, testIndex) => ({
      ...test,
      id: behaviorIndex + "." + testIndex,
      path: test.path.filter((id) => ids.has(id)),
      steps: test.steps.filter((step) => sourceLocation(step.source)).map((step) => {
        const code = (step.code ?? []).filter(codeRange).slice(0, 3);
        const implementation = code.map(({ path }) => componentForPath(path))
          .find((id) => id && id !== "test" && id !== "docs");
        return {
          ...step,
          code,
          component: ids.has(step.component) ? step.component : implementation,
          flow: typeof step.flow?.to === "string" && step.flow.to.trim() ? {
            from: typeof step.flow.from === "string" ? step.flow.from.trim().slice(0, 100) : null,
            to: step.flow.to.trim().slice(0, 100),
          } : null,
          payload: typeof step.payload === "string" ? step.payload.slice(0, 100) : "",
        };
      }),
    })),
  }));
}

async function readRepositorySource({ repoPath, github, head, path }) {
  if (!commit.test(head) || !validPath(path)) throw new Error("Invalid source reference.");
  try {
    const { stdout } = await run("git", [
      "-C", repoPath ?? process.cwd(), "show", head + ":" + path,
    ], { timeout: 4_000, maxBuffer: 1024 * 1024 });
    return stdout;
  } catch {
    return github.source(head, path);
  }
}

async function stepExcerpts(step, read) {
  const anchors = step.code.length ? step.code : [
    { ...step.source, end: step.source.line + 7, label: "Step source" },
  ];
  const files = new Map();
  return Promise.all(anchors.map(async (anchor) => {
    try {
      if (!files.has(anchor.path)) files.set(anchor.path, read(anchor.path));
      const content = (await files.get(anchor.path)).split(/\r?\n/);
      const start = anchor.line - 1;
      const lines = content.slice(start, Math.min(anchor.end, start + 26));
      if (!lines.length) return { ...anchor, unavailable: true };
      return { ...anchor, end: anchor.line + lines.length - 1, lines };
    } catch {
      return { ...anchor, unavailable: true };
    }
  }));
}

function publicEvidence(number, test, item) {
  return {
    head: item.head, browser: item.browser, result: item.result,
    images: Object.fromEntries([...item.files.keys()].map((name) => [
      name, "/api/prs/" + number + "/images/" + test.id + "/" + encodeURIComponent(name),
    ])),
  };
}

export function reviewBody(data) {
  if (!commit.test(data?.head) || !commit.test(data.base) ||
      !Array.isArray(data.notes) || !data.notes.length || data.notes.length > 40) {
    throw new Error("Select at least one note for this reviewed revision.");
  }
  const paragraphs = data.notes.map((note) => {
    const text = typeof note.text === "string" ? note.text.trim() : "";
    if (!text || text.length > 2000) throw new Error("Each selected note must contain 1 to 2,000 characters.");
    const label = typeof note.context === "string" ? note.context.replace(/[\r\n]/g, " ").slice(0, 210) : "";
    const path = note.source?.path;
    const line = note.source?.line;
    const link = validPath(path) && Number.isSafeInteger(line) && line > 0
      ? "[Source at reviewed commit](https://github.com/" + repository + "/blob/" +
        data.head + "/" + path.split("/").map((part) => encodeURIComponent(part).replace(/[()]/g, (ch) => ch === ")" ? "%29" : "%28")).join("/") + "#L" + line + ")"
      : "";
    return [label && "### " + label, link, text].filter(Boolean).join("\n\n");
  });
  return paragraphs.join("\n\n---\n\n");
}

export function createReviewer({
  github = createGitHub(), loadAnalysis = analyze, runBrowser = captureBrowser,
  readSource = readRepositorySource, repoPath, priorPilotRun,
} = {}) {
  const key = randomUUID();
  const reviews = new Map();
  const analyses = new Map();
  const captures = new Map();
  const sent = new Map();
  const captureKey = (pr, test) => [pr.head, test.source.path, test.title].join(":");

  async function evidenceFor(pr, test) {
    const id = captureKey(pr, test);
    if (captures.has(id)) return captures.get(id);
    if (priorPilotRun && isPilot(pr) && test.source.path.startsWith("frontend/e2e/")) {
      const found = await readEvidence(priorPilotRun, test, pr.head, { optional: true }).catch((error) => {
        console.warn("Previous pilot evidence unavailable: " + error.message);
        return null;
      });
      captures.set(id, found);
      return found;
    }
    return null;
  }

  async function route(request, response) {
    const port = request.socket.localPort;
    const origin = "http://127.0.0.1:" + port;
    if (request.headers.host !== "127.0.0.1:" + port) {
      return json(response, 403, { error: "Open the reviewer using its loopback URL." });
    }
    const url = new URL(request.url, origin);
    const route = url.pathname;
    const file = publicFiles.get(route);
    if (request.method === "GET" && file) {
      return write(response, 200, file[1], await readFile(new URL(file[0], publicRoot)));
    }
    if (route === "/api/session" && request.method === "GET") return json(response, 200, { key });
    if (route === "/api/prs" && request.method === "GET") return json(response, 200, await github.list());
    const match = /^\/api\/prs\/([1-9][0-9]*)(?:\/(capture|send|images|source|docker-diagram)(?:\/([^/]+)\/([^/]+))?)?$/.exec(route);
    if (!match) return json(response, 404, { error: "Page unavailable." });
    const number = Number(match[1]);
    const action = match[2];

    if (!action && request.method === "GET") {
      const pr = await github.details(number);
      let reportError = "";
      let report;
      try {
        report = await loadAnalysis(pr, repoPath, analyses);
      } catch (error) {
        reportError = error.message;
      }
      const behaviors = report ? normalizePilotOrDraft(report) : [];
      const map = architecture(pr.files);
      const view = { ...pr, files: undefined, behaviors, architecture: map, reportError, method: report?.method };
      reviews.set(number, view);
      const evidence = {};
      for (const behavior of behaviors) {
        for (const test of behavior.tests) {
          const item = await evidenceFor(view, test);
          if (item) evidence[test.id] = publicEvidence(number, test, item);
        }
      }
      return json(response, 200, { ...view, evidence });
    }

    const pr = reviews.get(number);
    if (!pr) return json(response, 409, { error: "Open this review first." });
    if (action === "docker-diagram" && request.method === "GET" && isPilot(pr)) {
      return write(response, 200, "image/svg+xml; charset=utf-8",
        await readSource({ repoPath, github, head: pr.head, path: dockerSvg }));
    }
    const testFor = (id) => pr.behaviors.flatMap((behavior) => behavior.tests).find((test) => test.id === id);
    if (action === "source" && request.method === "GET") {
      if (url.searchParams.get("head") !== pr.head || url.searchParams.get("base") !== pr.base) {
        return json(response, 409, { error: "Open the current review before loading its source." });
      }
      const test = testFor(match[3]);
      const index = Number(match[4]);
      const step = Number.isInteger(index) && test?.steps[index];
      if (!step) return json(response, 404, { error: "This walkthrough step is unavailable." });
      const read = (path) => readSource({ repoPath, github, head: pr.head, path });
      const fixturePath = step.workflow?.fixture ??
        (step.ui?.mode === "code" && step.ui.value === undefined ? step.ui.fixture : null);
      const [excerpts, workflowFixture] = await Promise.all([
        stepExcerpts(step, read),
        fixturePath && validPath(fixturePath) ? read(fixturePath).catch(() => null) : null,
      ]);
      return json(response, 200, { excerpts, workflowFixture });
    }
    if (action === "images" && request.method === "GET") {
      const test = testFor(match[3]);
      const item = test && await evidenceFor(pr, test);
      const path = item?.files.get(decodeURIComponent(match[4] ?? ""));
      if (!path) return json(response, 404, { error: "Screenshot unavailable." });
      return write(response, 200, "image/png", await readFile(path));
    }
    if (request.method !== "POST" || request.headers.origin !== origin ||
        request.headers["x-reviewer-key"] !== key || request.headers["content-type"] !== "application/json") {
      return json(response, 403, { error: "Use the current reviewer panel for this action." });
    }

    const data = await readBody(request);
    if (data.head !== pr.head || data.base !== pr.base) return json(response, 409, { error: "Refresh the review before trying this action." });
    if (action === "capture") {
      const test = testFor(data.test);
      if (!test) return json(response, 404, { error: "Choose a browser test in this review." });
      const evidence = await runBrowser({ pr, test, repoPath });
      captures.set(captureKey(pr, test), evidence);
      return json(response, 200, publicEvidence(number, test, evidence));
    }
    if (action === "send") {
      const body = reviewBody(data);
      if (!/^[a-f0-9-]{36}$/.test(data.requestId)) return json(response, 400, { error: "Missing review submission ID." });
      const id = [number, pr.head, data.requestId].join(":");
      if (!sent.has(id)) {
        sent.set(id, github.send(number, { head: pr.head, base: pr.base, body }));
      }
      return json(response, 200, await sent.get(id));
    }
    return json(response, 404, { error: "Action unavailable." });
  }

  return createServer((request, response) => route(request, response).catch((error) => {
    const message = error.code === "ENOENT" && error.path === "gh"
      ? "Install and sign in to the GitHub CLI."
      : error.message.slice(0, 800);
    if (!response.headersSent) json(response, error.statusCode ?? 400, { error: message });
    else response.end();
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repoPath = resolve(process.env.TERMINOLOGY_REPO ?? process.cwd());
  const reviewer = createReviewer({ repoPath, priorPilotRun: process.env.REVIEWER_PR14_EVIDENCE });
  reviewer.listen(Number(process.env.REVIEWER_PORT ?? 0), "127.0.0.1", () => {
    console.log("Terminology PR reviewer http://127.0.0.1:" + reviewer.address().port);
  });
}
