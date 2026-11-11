import { spawn, spawnSync } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  openSync,
  closeSync,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import path from "node:path";
import os from "node:os";

const frontend = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = path.dirname(frontend);
const python = path.join(frontend, ".e2e/venv/bin/python");
// Exact image used for stage one's live tests (Neo4j 2026.06.0).
const image =
  "neo4j@sha256:2aefe0454ba8f38cd08081a2ab1908a2aca6e9d9024bd97c6e4eef6c79855c57";
const runId = randomUUID();
const container = `terminology-e2e-${runId}`;
const token = randomUUID();
const artifactsRoot = path.join(frontend, "e2e-artifacts");
mkdirSync(artifactsRoot, { recursive: true });
const artifacts = mkdtempSync(path.join(artifactsRoot, "run-"));
writeFileSync(
  path.join(artifactsRoot, "last-run.json"),
  JSON.stringify({ artifacts, runId, container }, null, 2),
);
const apiCwd = mkdtempSync(path.join(os.tmpdir(), "terminology-e2e-"));
let api, web, playwright, controller;
let createdContainer = false;
let stopping = false;
let dbPort;
const logs = [];
const env = { ...process.env };
// Settings must never inherit the user's database credentials or Python paths.
for (const key of Object.keys(env)) {
  if (
    /^(NEO4J_|VITE_)/i.test(key) ||
    ["PYTHONPATH", "PYTHONHOME", "VIRTUAL_ENV"].includes(key)
  )
    delete env[key];
}
env.E2E_EMPTY_ENV_DIR = apiCwd;

function command(command, args, extra = {}) {
  const result = spawnSync(command, args, {
    cwd: frontend,
    env,
    encoding: "utf8",
    timeout: 120_000,
    ...extra,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} ${args[0]} failed: ${result.error?.message || result.stderr || result.stdout}`,
    );
  return result.stdout?.trim();
}
function launch(name, commandName, args, extra = {}) {
  const fd = openSync(path.join(artifacts, `${name}.log`), "a");
  logs.push(fd);
  const child = spawn(commandName, args, {
    cwd: frontend,
    env,
    detached: true,
    stdio: ["ignore", fd, fd],
    ...extra,
  });
  child.on("error", (error) => {
    child.spawnError = error;
    console.error(`${name}: ${error.message}`);
  });
  return child;
}
async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  const ended = once(child, "exit");
  const timer = setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      /* already stopped */
    }
  }, 10_000);
  try {
    await ended;
  } finally {
    clearTimeout(timer);
  }
}
async function allocateDatabasePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
async function assertPortFree(host, port) {
  const probe = createNetServer();
  try {
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(port, host, resolve);
    });
  } catch (error) {
    if (
      host === "::1" &&
      ["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)
    )
      return;
    throw new Error(
      `Port ${port} on ${host} is occupied or unavailable. Stop your own app before testing. No existing service was stopped.`,
      { cause: error },
    );
  } finally {
    if (probe.listening) await new Promise((resolve) => probe.close(resolve));
  }
}
async function waitUntil(check, description, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (stopping) throw new Error("Run interrupted");
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${description}. See ${artifacts}.`);
}
async function databaseReady() {
  await waitUntil(() => {
    const result = spawnSync(
      python,
      [path.join(frontend, "e2e/support/db.py"), "ready"],
      { cwd: apiCwd, env, encoding: "utf8", timeout: 5_000 },
    );
    if (result.status === 0) {
      writeFileSync(
        path.join(artifacts, "database-version.txt"),
        result.stdout,
      );
      return true;
    }
    return false;
  }, "Neo4j");
}
async function startApi() {
  if (api?.exitCode === null && api.signalCode === null) return;
  const logPath = path.join(artifacts, "api.log");
  const offset = existsSync(logPath) ? statSync(logPath).size : 0;
  api = launch(
    "api",
    python,
    [
      "-m",
      "uvicorn",
      "api.main:app",
      "--app-dir",
      root,
      "--host",
      "127.0.0.1",
      "--port",
      "8000",
    ],
    { cwd: apiCwd },
  );
  await waitUntil(async () => {
    if (api.spawnError || api.exitCode !== null || api.signalCode !== null)
      throw new Error("Test API exited. See api.log.");
    if (
      !stripVTControlCharacters(
        readFileSync(logPath, "utf8").slice(offset),
      ).includes("Uvicorn running on http://127.0.0.1:8000")
    )
      return false;
    try {
      return (
        await fetch("http://127.0.0.1:8000/", {
          signal: AbortSignal.timeout(1500),
        })
      ).ok;
    } catch {
      return false;
    }
  }, "FastAPI");
}
async function cleanup() {
  stopping = true;
  const failures = [];
  for (const child of [playwright, web, api]) {
    try {
      await stop(child);
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (controller) {
    controller.closeAllConnections();
    await new Promise((resolve) => controller.close(resolve));
  }
  if (createdContainer) {
    try {
      writeFileSync(
        path.join(artifacts, "neo4j.log"),
        command("docker", ["logs", container]),
      );
    } catch (error) {
      failures.push(error.message);
    }
    try {
      command("docker", ["rm", "--force", "--volumes", container]);
    } catch (error) {
      failures.push(error.message);
    }
  }
  for (const fd of logs) closeSync(fd);
  const { rmSync } = await import("node:fs");
  rmSync(apiCwd, { recursive: true, force: true });
  writeFileSync(
    path.join(artifacts, "cleanup.json"),
    JSON.stringify(
      { container, removed: failures.length === 0, failures },
      null,
      2,
    ),
  );
  if (failures.length)
    throw new Error(`Cleanup failed: ${failures.join("; ")}`);
}
let cleanupPromise;
const cleanOnce = () => (cleanupPromise ??= cleanup());
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    cleanOnce().then(
      () => process.exit(signal === "SIGINT" ? 130 : 143),
      (error) => {
        console.error(error.message);
        process.exit(1);
      },
    );
  });

let status = 1;
try {
  if (!existsSync(python)) throw new Error("Run npm run test:e2e:setup first.");
  for (const port of [3030, 8000]) {
    await assertPortFree("127.0.0.1", port);
    await assertPortFree("::1", port);
  }
  command("docker", ["info", "--format", "{{.ServerVersion}}"]);
  command(process.execPath, ["node_modules/typescript/bin/tsc", "-b"]);
  command(process.execPath, [
    "node_modules/vite/bin/vite.js",
    "build",
    "--config",
    "e2e/vite.config.mjs",
  ]);
  dbPort = await allocateDatabasePort();
  command("docker", [
    "create",
    "--name",
    container,
    "--label",
    `terminology.e2e.run=${runId}`,
    "--publish",
    `127.0.0.1:${dbPort}:7687`,
    "--env",
    "NEO4J_AUTH=none",
    "--env",
    "NEO4J_server_memory_heap_initial__size=256m",
    "--env",
    "NEO4J_server_memory_heap_max__size=512m",
    "--env",
    "NEO4J_server_memory_pagecache_size=128m",
    image,
  ]);
  createdContainer = true;
  command("docker", ["start", container]);
  Object.assign(env, {
    NEO4J_URI: `bolt://127.0.0.1:${dbPort}`,
    NEO4J_USERNAME: "",
    NEO4J_PASSWORD: "",
    PYTHONUNBUFFERED: "1",
  });
  await databaseReady();
  await startApi();
  web = launch("frontend", process.execPath, [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--config",
    "e2e/vite.config.mjs",
    "--host",
    "127.0.0.1",
    "--port",
    "3030",
    "--strictPort",
  ]);
  await waitUntil(async () => {
    if (web.spawnError || web.exitCode !== null || web.signalCode !== null)
      throw new Error("Test frontend exited. See frontend.log.");
    // CI color codes can split the URL between its host and port.
    if (
      !stripVTControlCharacters(
        readFileSync(path.join(artifacts, "frontend.log"), "utf8"),
      ).includes("http://127.0.0.1:3030")
    )
      return false;
    try {
      return (
        await fetch("http://127.0.0.1:3030", {
          signal: AbortSignal.timeout(1500),
        })
      ).ok;
    } catch {
      return false;
    }
  }, "React");
  // This test-only control server is separate from the application. The random
  // token and loopback binding restrict it to this run's Playwright process.
  controller = createServer(async (request, response) => {
    if (
      request.method !== "POST" ||
      request.headers.authorization !== `Bearer ${token}`
    ) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (request.url === "/api/stop") await stop(api);
      else if (request.url === "/api/start") await startApi();
      else if (request.url === "/db/stop")
        command("docker", ["stop", "--time", "5", container]);
      else if (request.url === "/db/start") {
        command("docker", ["start", container]);
        await databaseReady();
      } else if (request.url === "/db/link") {
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 2048) throw new Error("Request too large");
        }
        const { first, second } = JSON.parse(body);
        if (![first, second].every((id) => /^[0-9a-f]{32}$/.test(id)))
          throw new Error("Invalid test term ID");
        command(python, [path.join(frontend, "e2e/support/db.py"), "link"], {
          cwd: apiCwd,
          input: JSON.stringify({ first, second }),
        });
      } else {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200).end("ok");
    } catch (error) {
      response.writeHead(500).end(error.message);
    }
  });
  controller.listen(0, "127.0.0.1");
  await once(controller, "listening");
  Object.assign(env, {
    E2E_RUN_ID: runId,
    E2E_CONTROL_URL: `http://127.0.0.1:${controller.address().port}`,
    E2E_CONTROL_TOKEN: token,
    E2E_ARTIFACT_DIR: artifacts,
  });
  console.log(`E2E reports and logs: ${artifacts}`);
  playwright = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    { cwd: frontend, env, detached: true, stdio: "inherit" },
  );
  const [code] = await once(playwright, "exit");
  status = code ?? 1;
} catch (error) {
  console.error(error.message);
} finally {
  try {
    await cleanOnce();
  } catch (error) {
    console.error(error.message);
    status = 1;
  }
  console.log(`Run finished. Reports: ${artifacts}`);
}
process.exitCode = status;
