// SPDX-License-Identifier: MIT-0

// Browser-safe: compiles bookmarklet sources from memory, with the esbuild
// API passed in (esbuild-wasm on the page, native esbuild in unit tests).

import type { Plugin } from "esbuild"
import { esbuildOptions, frame, stdinFor, withOptions } from "./output"

type Esbuild = Pick<typeof import("esbuild"), "build">

/** `path` relative to `dir`, or `null` if it leaves the root. */
function join(dir: string, path: string): string | null {
  const parts = dir ? dir.split("/") : []
  for (const part of path.split("/")) {
    if (part === "..") {
      if (!parts.length) return null
      parts.pop()
    } else if (part !== ".") {
      parts.push(part)
    }
  }
  return parts.join("/")
}

/** Resolves imports only to `files`, e.g. `./lib/h` from `media-manager.ts`
 * to `lib/h.ts`, and a package such as `preact` to the file under that key.
 * Anything else is an error. */
function vendoredOnly(files: Record<string, string>): Plugin {
  return {
    name: "vendored-only",
    setup(build) {
      build.onResolve({ filter: /.*/ }, ({ path, importer }) => {
        const dir = importer.includes("/")
          ? importer.slice(0, importer.lastIndexOf("/"))
          : ""
        const joined = join(dir, path)
        const candidates = path.startsWith(".")
          ? [joined, `${joined}.ts`]
          : [path].filter(bare => !bare.endsWith(".ts")) // packages only
        const file = candidates.find(
          candidate => candidate !== null && Object.hasOwn(files, candidate)
        )
        return file
          ? { path: file, namespace: "vendored" }
          : {
              errors: [
                { text: `Only the vendored modules can be imported: ${path}` }
              ]
            }
      })
      build.onLoad({ filter: /.*/, namespace: "vendored" }, ({ path }) => ({
        contents: files[path],
        loader: path.endsWith(".ts") ? "ts" : "js"
      }))
    }
  }
}

/** Compiles `entry` (a path in `files`) like `compileBookmarklet`. */
export async function compileSources(
  esbuild: Esbuild,
  files: Record<string, string>,
  entry: string,
  options: object
): Promise<{
  template: string
  minified: string
  href: string
  sha256: string
}> {
  const result = await esbuild.build({
    stdin: { contents: stdinFor(entry), loader: "ts" },
    ...esbuildOptions,
    logLevel: "silent", // errors are thrown
    plugins: [vendoredOnly(files)]
  })
  const template = frame(result.outputFiles[0]!.text)
  return { template, ...(await withOptions(template, options)) }
}
