import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { compileBookmarklet } from "../../pipeline/build"

const root = new URL("../../", import.meta.url)
const license = (pkg: string) =>
  readFileSync(new URL(`node_modules/${pkg}/LICENSE`, root), "utf8").trim()

describe("the Preact + htm showcase", () => {
  it("carries the full license texts of the bundled packages", async () => {
    const { minified } = await compileBookmarklet(
      fileURLToPath(new URL("bookmarklets/media-manager-preact.ts", root)),
      { lang: "en" }
    )

    expect(minified).toContain(license("preact"))
    expect(minified).toContain(license("htm"))
  })
})
