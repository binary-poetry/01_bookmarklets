import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { iconDataUrl } from "../../pipeline/icon"

// Top-level files in `bookmarklets/` are bookmarklets; shared code goes to
// `bookmarklets/lib/`.
const root = new URL("../../", import.meta.url)
const bookmarklets = readdirSync(new URL("bookmarklets/", root))
  .filter(file => file.endsWith(".ts"))
  .map(file => file.replace(/\.ts$/, ""))

describe.each(bookmarklets)("the bookmarklet %s", id => {
  it("exports its options definition and `run(options)`", async () => {
    const module = (await import(
      fileURLToPath(new URL(`bookmarklets/${id}.ts`, root))
    )) as Record<string, unknown>

    // The site renders the options form from `options`, and the build
    // calls `run` with the chosen values
    expect(typeof module.options, "options").toBe("object")
    expect(typeof module.run, "run").toBe("function")
  })

  it("is run by an e2e spec", () => {
    const specs = readdirSync(new URL("tests/e2e/", root))
      .filter(file => file.endsWith(".spec.ts"))
      .map(file => readFileSync(new URL(`tests/e2e/${file}`, root), "utf8"))

    // Unit tests can't show that a bookmarklet works on a page: Trusted
    // Types, CSP and the top layer only exist in a real browser
    expect(specs.some(spec => spec.includes(`"${id}"`))).toBe(true)
  })

  it("has a valid icon in `bookmarklets/icons/<id>.txt`", () => {
    const grid = readFileSync(
      new URL(`bookmarklets/icons/${id}.txt`, root),
      "utf8"
    )

    // The site puts it into the bookmark file it offers for download
    expect(() => iconDataUrl(grid)).not.toThrow()
  })
})

const sources = ["bookmarklets/", "pipeline/"].flatMap(dir =>
  readdirSync(new URL(dir, root), { recursive: true, encoding: "utf8" })
    .filter(file => file.endsWith(".ts"))
    .map(file => `${dir}${file}`)
)

describe.each(sources)("the source %s", path => {
  it("starts with the MIT-0 SPDX header", () => {
    const source = readFileSync(new URL(path, root), "utf8")

    // Minified bookmarklets carry no notice, so the sources say it
    expect(source.split("\n")[0]).toBe("// SPDX-License-Identifier: MIT-0")
  })
})
