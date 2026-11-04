import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// Prevent a direct test command from accidentally targeting a user's running app.
if (
  !process.env.E2E_RUN_ID ||
  !process.env.E2E_CONTROL_URL ||
  !process.env.E2E_ARTIFACT_DIR
) {
  throw new Error(
    "Run npm run test:e2e. The suite requires its own isolated stack.",
  );
}
const artifacts = process.env.E2E_ARTIFACT_DIR;
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  outputDir: path.join(artifacts, "test-results"),
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(artifacts, "report"), open: "never" }],
    ["json", { outputFile: path.join(artifacts, "results.json") }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3030",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
