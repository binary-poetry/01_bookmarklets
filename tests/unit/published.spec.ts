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
    "730ed6b28b56fc50254f25ffb67add2233bea5bc2af36a88690b6abeb23fef4b",
  "media-manager-preact":
    "681619d0e5bec00abce2cfab9417f74d0051ce4e4245892726031ed1dc3514c6"
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
