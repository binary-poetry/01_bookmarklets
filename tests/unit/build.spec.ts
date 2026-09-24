import { describe, expect, it } from "vitest"
import { fileURLToPath } from "node:url"
import { compileBookmarklet } from "../../pipeline/build"
import { withOptions } from "../../pipeline/output"

describe("compileBookmarklet", () => {
  const entry = fileURLToPath(new URL("fixtures/echo.ts", import.meta.url))
  const runInGlobalScope = (code: string) => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    ;(new Function(code) as () => void)()
    return (globalThis as { echoed?: unknown }).echoed
  }

  it("calls run() with the options substituted for the placeholder", async () => {
    const { minified } = await compileBookmarklet(entry, { lang: "de" })

    expect(minified).not.toContain("__BOOKMARKLET_OPTIONS__")
    expect(runInGlobalScope(minified)).toEqual({ lang: "de" })
  })

  it("gives different options a different hash", async () => {
    const en = await compileBookmarklet(entry, { lang: "en" })
    const de = await compileBookmarklet(entry, { lang: "de" })

    expect(de.sha256).not.toBe(en.sha256)
  })

  it("builds an options-free template that withOptions completes", async () => {
    const { template, ...compiled } = await compileBookmarklet(entry, {
      lang: "de"
    })

    expect(await withOptions(template, { lang: "de" })).toEqual({
      minified: compiled.minified,
      href: compiled.href,
      sha256: compiled.sha256
    })
  })

  it("frames the code so it can read its own source and options", async () => {
    const self = fileURLToPath(new URL("fixtures/self.ts", import.meta.url))
    const { minified } = await compileBookmarklet(self, { lang: "de" })

    const { source, options } = runInGlobalScope(minified) as {
      source: string
      options: object
    }

    expect(`void ${source}()`).toBe(minified)
    expect(source).toContain('/*<options>*/{"lang":"de"}/*</options>*/')
    expect(options).toEqual({ lang: "de" })
  })

  it("lists the other bundled files relative to the bookmarklet", async () => {
    const greet = fileURLToPath(new URL("fixtures/greet.ts", import.meta.url))

    expect(
      (await compileBookmarklet(greet, { name: "x" })).dependencies
    ).toEqual(["lib/shout.ts"])
    expect(
      (await compileBookmarklet(entry, { lang: "en" })).dependencies
    ).toEqual([])
  })
})
