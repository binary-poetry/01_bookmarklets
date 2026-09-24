// SPDX-License-Identifier: MIT-0

// Browser-safe: the build, the configurator and the compiler all turn an
// options-free template into the bookmarklet with these functions.

import type { BuildOptions } from "esbuild"
import { encodeHref } from "../bookmarklets/lib/href"

export { encodeHref }

/** Stands for the options in the template (see `stdinFor`). */
export const PLACEHOLDER = "__BOOKMARKLET_OPTIONS__"

/** The esbuild entry for the bookmarklet module `file`: calls its `run` with
 * the placeholder, which esbuild leaves alone. */
export const stdinFor = (file: string) =>
  `import { run } from "./${file}"\nrun(${PLACEHOLDER})`

/** Shared by the build and the compiler, so both give the same output. */
export const esbuildOptions = {
  bundle: true,
  minify: true,
  format: "iife",
  legalComments: "inline",
  write: false
} as const satisfies BuildOptions

/** Turns esbuild's output into the template: a named function, so the code
 * can read its own source via `String(bookmarklet)`, and comment markers
 * around the options, so a settings panel can swap them later. */
export function frame(output: string): string {
  const code = output.replace(/\n$/, "") // esbuild's final newline
  return `void function bookmarklet(){${code.replace(
    PLACEHOLDER,
    `/*<options>*/${PLACEHOLDER}/*</options>*/`
  )}}()`
}

/** Fills the template's options placeholder with `options` as JSON. */
export function fill(template: string, options: object): string {
  if (template.split(PLACEHOLDER).length !== 2) {
    throw new Error(`The template needs exactly one ${PLACEHOLDER} placeholder`)
  }
  // A function replacement, so `$&` in a value isn't a replacement pattern.
  return template.replace(PLACEHOLDER, () => JSON.stringify(options))
}

/** The bookmarklet for `options`: its code, drag link and hash. */
export async function withOptions(
  template: string,
  options: object
): Promise<{ minified: string; href: string; sha256: string }> {
  const minified = fill(template, options)
  return {
    minified,
    href: encodeHref(minified),
    sha256: await sha256(minified)
  }
}

/** Hex SHA-256 via Web Crypto, so the browser can reuse it. */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  )
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}
