// SPDX-License-Identifier: MIT-0

/** The binary poetry site's colors as custom properties, light or dark as
 * the browser prefers. `color-scheme` makes native controls follow. Kept
 * compact, because esbuild doesn't minify CSS in strings. */
export const theme = `:host{color-scheme:light dark;--bp-bg:#fff;--bp-text:#3c3c43;--bp-control:oklch(84% .15 90deg);--bp-control-hover:oklch(88% .15 90deg);--bp-control-border:oklch(74% .15 90deg)}@media (prefers-color-scheme:dark){:host{--bp-bg:#1b1b1f;--bp-text:#dfdfd6;--bp-control:oklch(51% .15 90deg);--bp-control-hover:oklch(55% .15 90deg);--bp-control-border:oklch(41% .15 90deg)}}`
