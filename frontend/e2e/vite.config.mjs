import { mergeConfig } from "vite";
import applicationConfig from "../vite.config.ts";

if (!process.env.E2E_EMPTY_ENV_DIR)
  throw new Error("Use the E2E runner to supply isolated configuration.");

// Keep the real application's plugins. Read no user .env files.
export default mergeConfig(applicationConfig, {
  envDir: process.env.E2E_EMPTY_ENV_DIR,
});
