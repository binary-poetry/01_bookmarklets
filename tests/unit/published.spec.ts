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
    "c1c5421e3b6ac92fa74225d874f01adca0d0403d737a2e3db15f01e96ecbff6e",
  "media-manager-preact":
    "3933af5966807837b1f824c9b8eea608a81d889359987ff795716a6ee7138c9f"
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
