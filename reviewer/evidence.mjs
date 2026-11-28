import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { isPilot, pilotCaptureTest } from "./pilot.mjs";

const run = promisify(execFile);
const workByPort = new Set();

function specs(suites) {
  return suites.flatMap((suite) => [...(suite.specs ?? []), ...specs(suite.suites ?? [])]);
}

export async function readEvidence(runDir, test, head, { optional = false } = {}) {
  const { reviewedHead } = JSON.parse(await readFile(join(runDir, "reviewer-revision.json"), "utf8"));
  if (reviewedHead !== head) throw new Error("This report belongs to another revision.");
  const report = JSON.parse(await readFile(join(runDir, "results.json"), "utf8"));
  const testFile = test.source.path.replace(/^frontend\/e2e\//, "");
  const spec = specs(report.suites).find((item) => item.title === test.title && item.file === testFile);
  const result = spec?.tests.find((item) => item.projectName === "chromium")?.results.at(-1);
  if (!result) {
    if (optional) return null;
    throw new Error("The isolated run did not select the requested Chromium test.");
  }
  const files = new Map();
  const root = await realpath(runDir);
  for (const item of result.attachments) {
    if (item.contentType !== "image/png" || !item.path) continue;
    const path = await realpath(resolve(root, item.path));
    const local = relative(root, path);
    if (local.startsWith("..") || isAbsolute(local)) continue;
    files.set(item.name, path);
  }
  return { head, browser: "Chromium", result: result.status, files, runDir };
}

async function stagePilotCaptures(root, pr, test) {
  if (!isPilot(pr) || test.title !== pilotCaptureTest) return;
  const file = join(root, test.source.path);
  const text = await readFile(file, "utf8");
  const start = text.indexOf('test("SC-6 SVG:');
  const end = text.indexOf("const cases =", start);
  if (start < 0 || end < 0) throw new Error("The pilot capture points moved.");
  const body = text.slice(start, end);
  const beforeCancel = '  await page\n    .getByRole("button", { name: "Cancel update"';
  const checkedCancel = "  expect((await readTerm(request, term.name)).diagram).toBe(exampleSvg);";
  if (!body.includes(beforeCancel) || !body.includes(checkedCancel)) {
    throw new Error("The pilot capture points do not match the reviewed test.");
  }
  const captured = body
    .replace(beforeCancel, '  await evidence(page, info, "review-preview");\n' + beforeCancel)
    .replace(checkedCancel, checkedCancel + '\n  await evidence(page, info, "review-cancel");');
  await writeFile(file, text.slice(0, start) + captured + text.slice(end));
}

export async function captureBrowser({ pr, test, repoPath }) {
  if (!/^frontend\/e2e\/[-\w./]+\.spec\.mjs$/.test(test.source.path) || test.source.path.includes("..")) {
    throw new Error("This test is outside the browser test suite.");
  }
  if (workByPort.size) throw new Error("A browser test is running. Try again when it finishes.");
  workByPort.add(pr.number);
  let root;
  try {
    root = await mkdtemp(join(tmpdir(), "terminology-review-capture-"));
    const checkout = join(root, "source");
    await mkdir(checkout);
    const tarball = join(root, "source.tar");
    const options = { timeout: 90_000, maxBuffer: 8 * 1024 * 1024 };
    try {
      await run("git", ["-C", repoPath, "archive", "--output=" + tarball, pr.head], options);
    } catch {
      throw new Error("The reviewed commit is missing in the local repository. Fetch the pull request and retry.");
    }
    await run("tar", ["-xf", tarball, "-C", checkout], options);
    await rm(tarball);
    for (const dependency of ["node_modules", ".e2e"]) {
      const source = join(repoPath, "frontend", dependency);
      await access(source).catch(() => {
        throw new Error("Run the Terminology E2E setup before capturing screenshots. Missing frontend/" + dependency + ".");
      });
      await symlink(source, join(checkout, "frontend", dependency), "dir");
    }
    await stagePilotCaptures(checkout, pr, test);

    // npm owns the wrapper, which starts and cleans up the isolated stack.
    // Retain the wrapper report on assertion failure so its status stays visible.
    const testArgs = ["run", "test:e2e", "--prefix", "frontend", "--",
      "--project=chromium", "--grep", RegExp.escape(test.title), test.source.path.replace(/^frontend\//, "")];
    const childResult = await run("npm", testArgs, { cwd: checkout, maxBuffer: 12 * 1024 * 1024 })
      .catch((error) => error);
    if (childResult.code === "ENOENT") throw new Error("The browser test runner could not start npm.");
    const lastRun = join(checkout, "frontend", "e2e-artifacts", "last-run.json");
    let runDir;
    try {
      runDir = JSON.parse(await readFile(lastRun, "utf8")).artifacts;
      await writeFile(join(runDir, "reviewer-revision.json"), JSON.stringify({ reviewedHead: pr.head }));
      return await readEvidence(runDir, test, pr.head);
    } catch (error) {
      throw new Error("The browser test did not produce evidence. " + (childResult.stderr?.trim().slice(-550) || error.message));
    }
  } finally {
    workByPort.delete(pr.number);
  }
}
