import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { architecture, components } from "./components.mjs";
import { createGitHub, repository } from "./github.mjs";
import { analyze } from "./analyze.mjs";
import { captureBrowser, readEvidence } from "./evidence.mjs";
import { isPilot, pilotCaptureTest } from "./pilot.mjs";

const publicFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/components.mjs", ["../components.mjs", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
]);
const publicRoot = new URL("./public/", import.meta.url);
const commit = /^[a-f0-9]{40}$/;
const validPath = (path) =>
  typeof path === "string" && /^[\w./ @+()-]+$/.test(path) &&
  !path.startsWith("/") && !path.split("/").some((part) => part === "..");
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
  const source = (item) => item && validPath(item.path) && Number.isSafeInteger(item.line) && item.line > 0;
  return report.behaviors.map((behavior, behaviorIndex) => ({
    ...behavior,
    id: String(behaviorIndex),
    sources: behavior.sources.filter(source),
    tests: behavior.tests.filter((test) => source(test.source)).map((test, testIndex) => ({
      ...test,
      id: behaviorIndex + "." + testIndex,
      path: test.path.filter((id) => ids.has(id)),
      steps: test.steps.filter((step) => source(step.source)),
    })),
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
  repoPath, priorPilotRun,
} = {}) {
  const key = randomUUID();
  const reviews = new Map();
  const analyses = new Map();
  const captures = new Map();
  const sent = new Map();
  const captureKey = (pr, test) => [pr.head, test.source.path, test.title].join(":");

  async function evidenceFor(pr, test) {
    const capture = captures.get(captureKey(pr, test));
    if (capture) return capture;
    if (priorPilotRun && isPilot(pr) && test.title === pilotCaptureTest) {
      const found = await readEvidence(priorPilotRun, test, pr.head).catch((error) => {
        console.warn("Previous pilot evidence unavailable: " + error.message);
        return null;
      });
      if (found) captures.set(captureKey(pr, test), found);
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
    const match = /^\/api\/prs\/([1-9][0-9]*)(?:\/(capture|send|images)(?:\/([^/]+)\/([^/]+))?)?$/.exec(route);
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
    if (action === "images" && request.method === "GET") {
      const test = pr.behaviors.flatMap((behavior) => behavior.tests).find((test) => test.id === match[3]);
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
      const test = pr.behaviors.flatMap((behavior) => behavior.tests).find((test) => test.id === data.test);
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
