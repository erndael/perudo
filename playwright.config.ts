import { defineConfig, devices } from "@playwright/test";

// Several worktrees may run e2e at once, so each run picks its own port.
// Set in env so Playwright's worker processes inherit the same value.
process.env.E2E_PORT ??= String(30000 + (process.pid % 20000));
const port = Number(process.env.E2E_PORT);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm --filter @perudo/server start",
    url: `http://localhost:${port}/healthz`,
    env: { PORT: String(port) },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
  },
});
