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
    "364f65232b2a30031e2ac23316bade5955c3d9482c515c1d76ad69a673e2b6ea",
  "media-manager-preact":
    "9f49d13979b315c0e8e7e818f8237817954e9449f52a97d2b8d9018884de525b"
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
