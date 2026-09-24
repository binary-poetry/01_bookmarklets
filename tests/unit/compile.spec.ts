import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"
import { describe, expect, it } from "vitest"
import { compileSources } from "../../pipeline/compile"
import { compileBookmarklet } from "../../pipeline/build"

// esbuild-wasm has the same API and gives the same output as native esbuild,
// which the compiler page's e2e test checks in the browser.
const bookmarklets = new URL("../../bookmarklets/", import.meta.url)
const read = (path: string) => readFileSync(new URL(path, bookmarklets), "utf8")
const nodeModules = new URL("../../node_modules/", import.meta.url)
const files = {
  // All our sources, like the compiler page's `import.meta.glob`.
  ...Object.fromEntries(
    readdirSync(bookmarklets, { recursive: true, encoding: "utf8" })
      .filter(path => path.endsWith(".ts"))
      .map(path => [path, read(path)])
  ),
  // Packages by specifier, the files esbuild picks for the browser.
  ...Object.fromEntries(
    Object.entries({
      preact: "preact/dist/preact.module.js",
      "preact/hooks": "preact/hooks/dist/hooks.module.js",
      htm: "htm/dist/htm.module.js"
    }).map(([specifier, path]) => [
      specifier,
      readFileSync(new URL(path, nodeModules), "utf8")
    ])
  )
}

describe("compileSources", () => {
  it("compiles a bookmarklet exactly like the build", async () => {
    const entry = fileURLToPath(new URL("media-manager.ts", bookmarklets))
    const built = await compileBookmarklet(entry, { lang: "de" })

    const compiled = await compileSources(esbuild, files, "media-manager.ts", {
      lang: "de"
    })

    expect(compiled.template).toBe(built.template)
    expect(compiled.sha256).toBe(built.sha256)
  })
  it("compiles the Preact + htm showcase exactly like the build", async () => {
    const entry = fileURLToPath(
      new URL("media-manager-preact.ts", bookmarklets)
    )
    const built = await compileBookmarklet(entry, { lang: "en" })

    const compiled = await compileSources(
      esbuild,
      files,
      "media-manager-preact.ts",
      { lang: "en" }
    )

    expect(compiled.template).toBe(built.template)
  })

  it.each([
    ["a package", "lodash"],
    ["a URL", "https://example.com/evil.js"],
    ["a path outside the sources", "../../package.json"],
    ["an absolute path", "/etc/passwd"],
    ["our source without ./", "lib/h.ts"],
    ["an inherited property", "constructor"]
  ])("rejects importing %s", async (_, specifier) => {
    const code = `import x from "${specifier}"\nexport const run = () => x`

    await expect(
      compileSources(esbuild, { ...files, "code.ts": code }, "code.ts", {})
    ).rejects.toThrow(`Only the vendored modules can be imported: ${specifier}`)
  })

  it("resolves the vendored lib from pasted code", async () => {
    const code = `import { h } from "./lib/h"\nexport const run = () => h("p")`

    await expect(
      compileSources(esbuild, { ...files, "code.ts": code }, "code.ts", {})
    ).resolves.toHaveProperty("minified")
  })
})
