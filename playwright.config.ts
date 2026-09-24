import { defineConfig, devices } from "@playwright/test"

// Chromium only: the fixture pages copy the target sites' markup, and the
// tests call the bookmarklets directly, no web server needed.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "tests/e2e/reports/html", open: "never" }]
  ],
  outputDir: "tests/e2e/reports/test-results",
  use: { trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
})
