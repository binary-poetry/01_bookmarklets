// SPDX-License-Identifier: MIT-0
// spellchecker:ignore einstellungen zieh diesen deine lesezeichenleiste lösch alte lesezeichen speichern

import { h } from "./h"
import { encodeHref } from "./href"
import type { Lang, NumberOption, OptionsDefinition } from "./options"

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

/* A grid lines the controls up: labels, controls, a number option's field.
   The labels only lay out their children, they still name the controls.
   The hint wraps at the controls' width (at least 14em), so it never
   widens the dialog. The link looks like something to grab, not to click. */
export const settingsStyles = `
  .settings {
    display: grid;
    grid-template-columns: auto auto auto;
    gap: 0.25em 0.5em;
    align-items: center;
    justify-items: start;
  }
  .settings[hidden] { display: none; }
  .settings label { display: contents; }
  .settings label > span { grid-column: 1; }
  .settings p, .settings a { grid-column: 1 / -1; }
  .settings p { contain: inline-size; justify-self: stretch; min-width: 14em; }
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
    drag: "Drag this link into your bookmarks bar to store the settings, and delete the old one:"
  },
  de: {
    settings: "Einstellungen",
    drag: "Zieh diesen Link in deine Lesezeichenleiste, um die Einstellungen zu speichern, und lösch das alte Lesezeichen:"
  }
}

/** A slider and a number field for a number option, kept in step. `set`
 * gets each number within the range; a typed one outside it is ignored,
 * and the field shows the last one again when it loses focus. */
function numberField(
  option: NumberOption,
  value: number,
  set: (value: number) => void
) {
  const range = { min: option.min, max: option.max, step: option.step }
  const slider = h("input", {
    type: "range",
    ...range,
    value,
    oninput: () => {
      value = field.valueAsNumber = slider.valueAsNumber
      set(value)
    }
  })
  const field = h("input", {
    type: "number",
    ...range,
    value,
    oninput: () => {
      const typed = field.valueAsNumber
      if (!(typed >= option.min && typed <= option.max)) return
      value = slider.valueAsNumber = typed
      set(value)
    },
    onchange: () => (field.valueAsNumber = value)
  })
  return [slider, field] as const
}

/** A select or a slider per option and the link to drag with the chosen
 * options. Its texts follow the chosen `lang`, so choosing one previews it;
 * `name` is the link's text, which becomes the bookmark's name. */
export function settingsView(
  definition: OptionsDefinition,
  current: Record<string, string | number>,
  name: (lang: Lang) => string
): HTMLDivElement {
  const values = { ...current }
  const fields = Object.entries(definition).map(([key, option]) => {
    const label = h("span")
    if (!("choices" in option)) {
      const [slider, field] = numberField(
        option,
        values[key] as number,
        value => {
          values[key] = value
          update()
        }
      )
      const relabel = (lang: Lang) => {
        label.textContent = option.label[lang]
        field.setAttribute("aria-label", option.label[lang])
      }
      return { relabel, element: h("label", null, label, " ", slider, field) }
    }
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
    select.value = values[key] as string
    const relabel = (lang: Lang) => {
      label.textContent = option.label[lang]
      for (const choice of select.options) {
        choice.textContent = option.choices[choice.value]![lang]
      }
    }
    return { relabel, element: h("label", null, label, " ", select) }
  })
  const hint = h("p")
  // A click would run it here, on the page
  const link = h("a", { onclick: (event: Event) => event.preventDefault() })

  function update() {
    const lang = values.lang as Lang
    for (const { relabel } of fields) relabel(lang)
    hint.textContent = settingsTexts[lang].drag
    link.textContent = name(lang)
    link.href = linkFor(values)
  }
  update()

  return h(
    "div",
    { class: "settings" },
    ...fields.map(({ element }) => element),
    hint,
    link
  )
}
