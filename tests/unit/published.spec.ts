import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { compileBookmarklet } from "../../pipeline/build"
import { defaultsOf } from "../../pipeline/options"
import type { OptionsDefinition } from "../../bookmarklets/lib/options"

/** The SHA-256 each tagged bookmarklet is published with (default options).
 * A change to a bookmarklet's output fails here on purpose: update the hash
 * together with a new tag, or find what changed the output. Formatting
 * counts, e.g. template text is published byte for byte. */
const published = {
  "media-manager":
    "f1075c263d11d0e0625f22c5efe9901735cde10a03169382e5136f0c4c2ecf26",
  "media-manager-preact":
    "4570f555eb29157b195cec210cc9c09649c8d791c4b8dd7bd3025fd854ae9a5c"
}

describe("the published bookmarklets", () => {
  it.each(Object.entries(published))(
    "%s still builds to its published hash",
    async (id, sha256) => {
      const entry = fileURLToPath(
        new URL(`../../bookmarklets/${id}.ts`, import.meta.url)
      )
      const { options } = (await import(entry)) as {
        options: OptionsDefinition
      }

      const built = await compileBookmarklet(entry, defaultsOf(options))

      expect(built.sha256).toBe(sha256)
    }
  )
})
