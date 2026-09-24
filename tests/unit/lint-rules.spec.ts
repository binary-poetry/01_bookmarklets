import { ESLint } from "eslint"
import tseslint from "typescript-eslint"
import { describe, expect, it } from "vitest"

// The repo's own config, minus the type-aware rules: those need the
// snippet to be a file in the TypeScript project.
const eslint = new ESLint({
  overrideConfig: { ...tseslint.configs.disableTypeChecked }
})

/** The messages ESLint reports for `code` as a file at `path`. */
async function lint(code: string, path = "bookmarklets/probe.ts") {
  const [result] = await eslint.lintText(code, { filePath: path })
  return result!.messages.map(message => message.message)
}

describe("the lint rules for bookmarklets", () => {
  it("reject innerHTML, which Trusted Types blocks", async () => {
    expect(await lint("document.body.innerHTML = '<p></p>'\n")).toEqual([
      expect.stringContaining("Trusted Types")
    ])
  })

  it.each([
    [
      "insertAdjacentHTML",
      "document.body.insertAdjacentHTML('beforeend', '<p></p>')\n"
    ],
    ["document.write", "document.write('<p></p>')\n"],
    ["document.writeln", "document.writeln('<p></p>')\n"],
    ["srcdoc", "document.createElement('iframe').srcdoc = '<p></p>'\n"]
  ])("reject %s, which Trusted Types blocks", async (_, code) => {
    expect(await lint(code)).toEqual([expect.stringContaining("Trusted Types")])
  })

  it.each([
    ["eval", "eval('1')\n"],
    ["new Function", "new Function('return 1')\n"],
    ["a string timer", "setTimeout('alert(1)', 1)\n"]
  ])("reject %s, which page CSPs block", async (_, code) => {
    expect(await lint(code)).toEqual([expect.stringContaining("unsafe-eval")])
  })

  it.each([
    ["a <style> element", "document.createElement('style')\n"],
    ["a <style> element via h()", "h('style', null, 'p {}')\n"],
    ["a style attribute", "document.body.setAttribute('style', 'color: red')\n"]
  ])("reject %s, which a page's style-src blocks", async (_, code) => {
    expect(await lint(code)).toEqual([expect.stringContaining("style-src")])
  })

  it("allow them outside the bookmarklets", async () => {
    expect(
      await lint("document.body.innerHTML = ''\n", "pipeline/probe.ts")
    ).toEqual([])
  })
})
