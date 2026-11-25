import { defineConfig, devices } from "@playwright/test";

// Several worktrees may run e2e at once, so each run picks its own port.
// Set in env so Playwright's worker processes inherit the same value.
process.env.E2E_PORT ??= String(30000 + (process.pid % 20000));
const port = Number(process.env.E2E_PORT);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Several browser contexts per test; keep the machine usable when worktrees run e2e side by side.
  workers: 4,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // e2e asserts on the HTML layer, never the canvas. Software WebGL (SwiftShader) for every page
        // pins the CPU, so WebGL is switched off and the app shows its HTML dice fallback instead.
        launchOptions: { args: ["--disable-3d-apis"] },
      },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm --filter @perudo/server start",
    url: `http://localhost:${port}/healthz`,
    // Seeded dice: every Room's first Game rolls the same dice (see apps/server/src/config.ts).
    env: { PORT: String(port), PERUDO_TEST_MODE: "1", PERUDO_RNG_SEED: "42" },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
  },
});
