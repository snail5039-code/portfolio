import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a dedicated API (8010) and web (5174) instance, never the ports
 * a developer's own `npm run dev` uses on 8000/5173. The approval, policy
 * settings, and notification settings stores have no reset endpoint and now
 * persist to real SQLite files by default (the *_DB_PATH env vars below
 * override all three to ":memory:"), so every test run needs its own fresh,
 * non-persistent FastAPI process — sharing the dev server's process (or its
 * .db files) would let one run's writes leak into the next.
 */
const API_PORT = 8010;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: "../api",
      env: {
        APPROVALS_DB_PATH: ":memory:",
        POLICY_SETTINGS_DB_PATH: ":memory:",
        NOTIFICATION_SETTINGS_DB_PATH: ":memory:"
      },
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: `npm run dev -- --port ${WEB_PORT}`,
      cwd: ".",
      env: { VITE_API_PORT: String(API_PORT), VITE_PORT: String(WEB_PORT) },
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ]
});
