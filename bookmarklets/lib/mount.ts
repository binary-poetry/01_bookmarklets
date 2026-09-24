// SPDX-License-Identifier: MIT-0

import { h } from "./h"
import { theme } from "./theme"

function sheet(css: string): CSSStyleSheet {
  const styles = new CSSStyleSheet()
  styles.replaceSync(css)
  return styles
}

/** Appends a shadow host to the page. Adopted stylesheets survive a page
 * `style-src` CSP that blocks `<style>` and `style` attributes. The first
 * sheet stops inherited page styles (color, font, …) from leaking in, the
 * second holds the site's colors (`theme`), the last one dynamic values such
 * as the position. */
export function mount(id: string, css: string, ...children: Array<Node>) {
  const host = h("div", { id })
  const root = host.attachShadow({ mode: "open" })
  const dynamicStyles = sheet("")
  root.adoptedStyleSheets = [
    sheet(":host { all: initial }"),
    sheet(theme),
    sheet(css),
    dynamicStyles
  ]
  root.append(...children)
  document.body.append(host)
  return {
    host,
    root,
    setDynamicCss: (css: string) => dynamicStyles.replaceSync(css)
  }
}
