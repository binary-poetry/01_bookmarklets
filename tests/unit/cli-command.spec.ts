import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { compileBookmarklet } from "../../pipeline/build"

const root = new URL("../../", import.meta.url)
const bookmarklets = new URL("bookmarklets/", root)

describe("the CLI command in the README", () => {
  it("reproduces the published hash", async () => {
    const readme = readFileSync(new URL("README.md", root), "utf8")
    const command = /```sh\n([^`]*npx esbuild@0\.28\.2[^`]*)```/.exec(
      readme
    )![1]!
    // The same pinned version, without downloading it
    const local = command.replace(
      "npx esbuild@0.28.2",
      fileURLToPath(new URL("node_modules/esbuild/bin/esbuild", root))
    )

    const output = execFileSync("sh", ["-c", local], {
      cwd: fileURLToPath(bookmarklets),
      encoding: "utf8"
    })

    const { sha256 } = await compileBookmarklet(
      fileURLToPath(new URL("media-manager.ts", bookmarklets)),
      { lang: "en" }
    )
    expect(output.split(" ")[0]).toBe(sha256)
  })
})
