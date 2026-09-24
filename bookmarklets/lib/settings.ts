// SPDX-License-Identifier: MIT-0
// spellchecker:ignore einstellungen zieh diesen deine lesezeichenleiste lösch alte lesezeichen

import { h } from "./h"
import { encodeHref } from "./href"
import type { Lang, OptionsDefinition } from "./options"

/** The function the published code is framed in (see `frame` in
 * `pipeline/output.ts`), so `String(bookmarklet)` is the running
 * bookmarklet's own source. */
declare const bookmarklet: () => void

const open = "/*<options>*/"
const close = "/*</options>*/"

/** The drag link for the framed bookmarklet function `source` with other
 * options. The last markers are the real ones: this very code holds the
 * marker strings earlier in the source. */
function reconfigure(source: string, options: object): string {
  const start = source.lastIndexOf(open) + open.length
  const end = source.lastIndexOf(close)
  return encodeHref(
    `void ${source.slice(0, start)}${JSON.stringify(options)}${source.slice(end)}()`
  )
}

/** The drag link for the running bookmarklet with other options. */
export const linkFor = (options: object) =>
  reconfigure(String(bookmarklet), options)

/* The hint wraps, so the dialog keeps about its width. The link looks like
   something to grab, not to click. */
export const settingsStyles = `
  .settings label { display: block; }
  .settings p { max-width: 14em; }
  .settings a {
    display: inline-block;
    padding: 0.25em 0.5em;
    border: 1px dashed var(--bp-control-border);
    border-radius: 4px;
    color: inherit;
    text-decoration: none;
    cursor: grab;
    margin-bottom: 0.5em;
  }
`

export const settingsTexts = {
  en: {
    settings: "Settings",
    drag: "Drag this link into your bookmarks bar and delete the old one:"
  },
  de: {
    settings: "Einstellungen",
    drag: "Zieh diesen Link in deine Lesezeichenleiste und lösch das alte Lesezeichen:"
  }
}

/** A select per option and the link to drag with the chosen options. Its
 * texts follow the chosen `lang`, so choosing one previews it; `name` is
 * the link's text, which becomes the bookmark's name. */
export function settingsView(
  definition: OptionsDefinition,
  current: Record<string, string>,
  name: (lang: Lang) => string
): HTMLDivElement {
  const values = { ...current }
  const fields = Object.entries(definition).map(([key, option]) => {
    const label = h("span")
    const select = h(
      "select",
      {
        onchange: () => {
          values[key] = select.value
          update()
        }
      },
      ...Object.keys(option.choices).map(value => h("option", { value }))
    )
    select.value = values[key]!
    return { option, label, select }
  })
  const hint = h("p")
  // A click would run it here, on the page
  const link = h("a", { onclick: (event: Event) => event.preventDefault() })

  function update() {
    const lang = values.lang as Lang
    for (const { option, label, select } of fields) {
      label.textContent = option.label[lang]
      for (const choice of select.options) {
        choice.textContent = option.choices[choice.value]![lang]
      }
    }
    hint.textContent = settingsTexts[lang].drag
    link.textContent = name(lang)
    link.href = linkFor(values)
  }
  update()

  return h(
    "div",
    { class: "settings" },
    ...fields.map(({ label, select }) => h("label", null, label, " ", select)),
    hint,
    link
  )
}
