import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createGitHub } from "./github.mjs";
import { architecture } from "./components.mjs";
import { isPilot, pilotBehaviorReport, pilotCaptureTest, pilotHead } from "./pilot.mjs";
import { createReviewer } from "./server.mjs";

const base = "849986f9331766618ed9f9fe738ab692217a2cf2";
const pr = {
  number: 14, title: "Save and preview SVG source", draft: true, head: pilotHead, base,
  url: "https://github.com/lycho33/Terminology/pull/14",
  intent: { kind: "PR description", sources: [{ title: "SVG work", body: "Save SVG", url: "https://github.com/lycho33/Terminology/pull/14" }] },
  files: [{ filename: "frontend/src/hooks.tsx" }, { filename: "frontend/e2e/svg-diagram.spec.mjs" }],
};

const wire = (number, state, draft = false) => ({
  number, state, draft, title: "PR " + number, body: "PR description", changed_files: 2,
  html_url: "https://github.com/lycho33/Terminology/pull/" + number,
  head: { sha: pilotHead }, base: { sha: base },
});

test("GitHub lists all pages of open PRs and keeps the draft flag", async () => {
  const github = createGitHub(async (args) => {
    assert.match(args[1], /pulls\?state=open/);
    assert.deepEqual(args.slice(-2), ["--paginate", "--slurp"]);
    return JSON.stringify([[wire(14, "open", true)], [wire(13, "open"), wire(11, "closed")]]);
  });
  assert.deepEqual((await github.list()).map(({ number, draft }) => [number, draft]), [[14, true], [13, false]]);
});

test("PR details prefer GitHub's linked issue and check both revision endpoints", async () => {
  let checked = 0;
  const github = createGitHub(async (args) => {
    if (args[1] === "graphql") {
      return JSON.stringify({ data: { repository: { pullRequest: { closingIssuesReferences: { nodes: [
        { title: "Issue objective", body: "Keep SVG text", url: "https://github.com/lycho33/Terminology/issues/20" },
      ] } } } } });
    }
    if (args[1].includes("/files?")) return JSON.stringify([pr.files]);
    checked++;
    return JSON.stringify(wire(14, "open", true));
  });
  const info = await github.details(14);
  assert.equal(info.intent.kind, "Linked GitHub issue");
  assert.equal(info.intent.sources[0].title, "Issue objective");
  assert.equal(checked, 2);
});

test("GitHub submission preserves revision and refuses a moved PR", async () => {
  const calls = [];
  let pull = wire(14, "open", true);
  const github = createGitHub(async (args, options) => {
    if (!options) return JSON.stringify(pull);
    calls.push(JSON.parse(options.input));
    return JSON.stringify({ id: 3, html_url: pr.url + "#pullrequestreview-3" });
  });
  await github.send(14, { head: pilotHead, base, body: "One note" });
  pull = { ...pull, head: { sha: "b".repeat(40) } };
  await assert.rejects(github.send(14, { head: pilotHead, base, body: "Stale" }), { statusCode: 409 });
  assert.deepEqual(calls, [{ commit_id: pilotHead, body: "One note", event: "COMMENT" }]);
});

test("stable map distinguishes changed source, test code, and renamed files", () => {
  const files = [...pr.files, { filename: "docs/provider.txt", previous_filename: "frontend/src/provider.tsx", status: "renamed" }, { filename: "api/old.py", status: "removed" }];
  const { nodes } = architecture(files);
  assert.deepEqual(nodes.find((node) => node.id === "api").files, [{ path: "api/old.py", revision: "base" }]);
  assert.deepEqual(nodes.find((node) => node.id === "data").files, [
    { path: "frontend/src/hooks.tsx", revision: "head" }, { path: "frontend/src/provider.tsx", revision: "base" },
  ]);
  assert.deepEqual(nodes.find((node) => node.id === "docs").files, [{ path: "docs/provider.txt", revision: "head" }]);
  assert.deepEqual(nodes.find((node) => node.id === "test").files, [{ path: "frontend/e2e/svg-diagram.spec.mjs", revision: "head" }]);
  assert.equal(isPilot({ ...pr, base: "b".repeat(40) }), false);
});

test("pilot walkthrough pins source and evidence and sends one selected note once", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "reviewer-test-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const attachments = [];
  const output = join(root, "test-results");
  await mkdir(output);
  for (const name of ["review-preview", "review-cancel", "edited-diagram"]) {
    const path = join(output, name + ".png");
    await writeFile(path, "test-" + name);
    attachments.push({ name, path, contentType: "image/png" });
  }
  await writeFile(join(root, "reviewer-revision.json"), JSON.stringify({ reviewedHead: pilotHead }));
  await writeFile(join(root, "results.json"), JSON.stringify({ suites: [{ specs: [{
    title: pilotCaptureTest, file: "svg-diagram.spec.mjs",
    tests: [{ projectName: "chromium", results: [{ status: "passed", attachments }] }],
  }] }] }));
  const sent = [];
  const server = createReviewer({
    github: {
      list: async () => [pr],
      details: async () => pr,
      send: async (number, review) => {
        sent.push({ number, ...review });
        return { id: 27, url: pr.url + "#pullrequestreview-27" };
      },
    },
    loadAnalysis: async () => pilotBehaviorReport,
    readSource: async ({ head, path }) => {
      assert.equal(head, pilotHead);
      if (path.endsWith("connected-shapes.svg")) return "<svg><title>Client</title></svg>";
      if (!path.endsWith("Term.tsx")) throw new Error("Not in the test checkout");
      return Array.from({ length: 300 }, (_, index) => "source line " + (index + 1)).join("\n");
    },
    priorPilotRun: root,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const host = "http://127.0.0.1:" + server.address().port;
  const read = async (path) => (await fetch(host + path)).json();
  const displayed = await read("/api/prs/14");
  assert.equal(displayed.behaviors.length, 14);
  assert.ok(displayed.behaviors.some(({ title, tests }) => title.includes("cached") && !tests.length));
  const editTest = displayed.behaviors.flatMap((item) => item.tests).find((item) => item.title === pilotCaptureTest);
  assert.deepEqual(editTest.steps.filter((step) => step.attachment).map((step) => step.value), ["Browser", "Client", "Browser"]);
  assert.deepEqual(editTest.steps.map((step) => step.component),
    ["editor", "editor", "editor", "editor", "data", "api", "database", "editor"]);
  assert.equal(editTest.steps.find((step) => step.component === "database").payload, "Stored SVG · Browser");
  const previewTest = displayed.behaviors[0].tests[0];
  assert.equal(previewTest.steps[0].component, "editor");
  assert.deepEqual(previewTest.steps.map((step) => step.workflow.stage), ["form", "paste", "preview"]);
  assert.equal(previewTest.steps.at(-1).code[0].path, "frontend/src/diagram/DiagramField.tsx");
  const previewSource = await read("/api/prs/14/source/" + previewTest.id + "/2?head=" + pilotHead + "&base=" + base);
  assert.equal(previewSource.workflowFixture, "<svg><title>Client</title></svg>");

  const stepUrl = "/api/prs/14/source/" + editTest.id + "/0";
  const revision = "?head=" + pilotHead + "&base=" + base;
  const { excerpts } = await read(stepUrl + revision);
  assert.equal(excerpts[0].path, "frontend/src/terms/Term.tsx");
  assert.equal(excerpts[0].line, 204);
  assert.equal(excerpts[0].end, 214);
  assert.equal(excerpts[0].lines[0], "source line 204");
  assert.equal(excerpts[0].lines.at(-1), "source line 214");
  assert.equal(excerpts[1].unavailable, true);
  assert.equal((await fetch(host + stepUrl + "?head=" + "a".repeat(40) + "&base=" + base)).status, 409);
  assert.equal((await fetch(host + "/api/prs/14/source/" + editTest.id + "/99" + revision)).status, 404);

  const images = displayed.evidence[editTest.id].images;
  assert.equal(await (await fetch(host + images["review-cancel"])).text(), "test-review-cancel");
  const { key } = await read("/api/session");
  const payload = JSON.stringify({
    head: pilotHead, base, requestId: "f5326f94-8f78-4f50-afc2-594edf32e361",
    notes: [{ text: "Does this need a regression test?", context: "Cancel",
      source: { path: "frontend/e2e/svg-diagram.spec.mjs", line: 226 } }],
  });
  const headers = { origin: host, "x-reviewer-key": key, "content-type": "application/json" };
  const send = (overrides) => fetch(host + "/api/prs/14/send", { method: "POST", body: payload, headers: { ...headers, ...overrides } });
  assert.equal((await send({ origin: "https://example.com" })).status, 403);
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /Does this need a regression test\?/);
  assert.match(sent[0].body, new RegExp(pilotHead + "/frontend/e2e/svg-diagram.spec.mjs#L226"));
});
