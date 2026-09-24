// SPDX-License-Identifier: MIT-0

import { basename, dirname, relative, resolve } from "node:path"
import { build } from "esbuild"
import { esbuildOptions, frame, stdinFor, withOptions } from "./output"

/** Bundles a bookmarklet module (`export function run(options)`) into one
 * minified IIFE that calls `run` with `options` baked in as JSON. `template`
 * is the same code with the options placeholder, for `withOptions`.
 * `dependencies` are the other bundled files, relative to the module. */
export async function compileBookmarklet(
  entry: string,
  options: object
): Promise<{
  minified: string
  href: string
  sha256: string
  template: string
  dependencies: Array<string>
}> {
  const result = await build({
    stdin: {
      contents: stdinFor(basename(entry)),
      resolveDir: dirname(entry),
      loader: "ts"
    },
    ...esbuildOptions,
    metafile: true
  })
  const template = frame(result.outputFiles[0]!.text)
  return {
    ...(await withOptions(template, options)),
    template,
    dependencies: Object.keys(result.metafile.inputs)
      .filter(input => !input.startsWith("<")) // virtual: <stdin>
      .map(input => relative(dirname(entry), resolve(input)))
      .filter(path => path !== basename(entry))
  }
}
