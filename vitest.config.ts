import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    // the Playwright specs live under tests/ too, and match the pattern
    exclude: [...configDefaults.exclude, "tests/e2e/**"]
  }
})
