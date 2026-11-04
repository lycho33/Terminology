import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontend = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const python = process.env.E2E_PYTHON || "python3.11";
function run(command, args) {
  const result = spawnSync(command, args, { cwd: frontend, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(python, [
  "-c",
  'import sys; assert sys.version_info[:3] == (3, 11, 18), "E2E setup requires Python 3.11.18"',
]);
run(python, ["-m", "venv", ".e2e/venv"]);
run(path.join(frontend, ".e2e/venv/bin/python"), [
  "-m",
  "pip",
  "install",
  "-r",
  "e2e/requirements.txt",
]);
run(process.execPath, [
  "node_modules/@playwright/test/cli.js",
  "install",
  ...(process.env.CI ? ["--with-deps"] : []),
  "chromium",
  "webkit",
]);
