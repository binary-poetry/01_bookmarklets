// jsdom's `TextEncoder` yields arrays Web Crypto rejects, so this runs in node.

import { describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import { encodeHref, withOptions } from "../../pipeline/output"

const template = "globalThis.echoed=__BOOKMARKLET_OPTIONS__;"
const runInGlobalScope = (code: string) => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  ;(new Function(code) as () => void)()
  return (globalThis as { echoed?: unknown }).echoed
}

describe("encodeHref", () => {
  it("prefixes the javascript: pseudo-protocol and round-trips", () => {
    const code = `(()=>{alert("50% & more: a+b=c #1 ü")})();`

    const href = encodeHref(code)

    expect(href.startsWith("javascript:")).toBe(true)
    expect(decodeURIComponent(href.slice("javascript:".length))).toBe(code)
  })

  it("escapes the characters encodeURIComponent leaves alone", () => {
    expect(encodeHref("!'()*")).toBe("javascript:%21%27%28%29%2A")
  })
})

describe("withOptions", () => {
  it("fills the placeholder with the options as JSON", async () => {
    const { minified } = await withOptions(template, { lang: "de" })

    expect(minified).toBe('globalThis.echoed={"lang":"de"};')
    expect(runInGlobalScope(minified)).toEqual({ lang: "de" })
  })

  it("returns the drag link and the SHA-256 of the code", async () => {
    const { minified, href, sha256 } = await withOptions(template, {})

    expect(href).toBe(encodeHref(minified))
    expect(sha256).toBe(createHash("sha256").update(minified).digest("hex"))
  })

  it("keeps replacement patterns such as $& in values literal", async () => {
    const { minified } = await withOptions(template, { key: "$&$'$`" })

    expect(runInGlobalScope(minified)).toEqual({ key: "$&$'$`" })
  })

  it("rejects a template without exactly one placeholder", async () => {
    await expect(withOptions("f()", {})).rejects.toThrow(/placeholder/)
    await expect(withOptions(`${template}${template}`, {})).rejects.toThrow(
      /placeholder/
    )
  })
})
