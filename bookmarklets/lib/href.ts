// SPDX-License-Identifier: MIT-0

/** `javascript:` URL for a bookmark. Also escapes `!'()*`, which
 * `encodeURIComponent` leaves alone (RFC 3986 reserves them). Shared by the
 * build and the settings view, so a reconfigured link equals the build. */
export function encodeHref(code: string): string {
  const encoded = encodeURIComponent(code).replace(
    /[!'()*]/g,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `javascript:${encoded}`
}
