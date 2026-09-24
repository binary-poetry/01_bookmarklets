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
    "f55a6f18ca7b3bc51a0600597ac83023bdc82edcb02614265df011a0a7af6457",
  "media-manager-preact":
    "d00783a461fc7ab943054d950bbb9c8fb5f7174e695b9b5e46fd621c5b29ea9e"
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
