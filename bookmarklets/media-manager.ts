// SPDX-License-Identifier: MIT-0
// spellchecker:ignore ende schliessen deutsch kein dieser seite sprache medien

import { h } from "./lib/h"
import { mount } from "./lib/mount"
import type { OptionsDefinition, OptionValues } from "./lib/options"
import { settingsStyles, settingsTexts, settingsView } from "./lib/settings"

export const options = {
  lang: {
    label: { en: "Language", de: "Sprache" },
    // Each language in its own, so it can be found in any
    choices: {
      en: { en: "English", de: "English" },
      de: { en: "Deutsch", de: "Deutsch" }
    },
    default: "en"
  }
} as const satisfies OptionsDefinition

export type Options = OptionValues<typeof options>

export const texts = {
  en: {
    name: "Media manager",
    video: "Video: ",
    noVideo: "No video on this page.",
    start: "Start",
    end: "End",
    close: "Close"
  },
  de: {
    name: "Medien-Manager",
    video: "Video: ",
    noVideo: "Kein Video auf dieser Seite.",
    start: "Start",
    end: "Ende",
    close: "Schliessen"
  }
}

export const hostId = "binary-poetry-media-manager"
const binding = Symbol.for(hostId)

/** Running the bookmarklet again toggles it: an open dialog closes like its
 * Close button (its closure holds the live state), a fading-out one stays
 * open. Returns whether a dialog was there. */
export function toggleOpenDialog(): boolean {
  const root = document.getElementById(hostId)?.shadowRoot
  if (!root) return false
  const dialog = root.querySelector("dialog")!
  if (dialog.classList.contains("closing")) dialog.classList.remove("closing")
  else root.querySelector<HTMLButtonElement>(".close")!.click()
  return true
}

/* The popover is in the top layer, so no z-index. Its UA styles center it
   (`inset: 0; margin: auto`); like the original, start at the top center,
   but with a gap, so the top border doesn't look cut off. */
export const styles = `
  dialog {
    color: var(--bp-text);
    background-color: var(--bp-bg);
    border: 2px solid var(--bp-control-border);
    border-radius: 4px;
    font-family: system-ui, sans-serif;
    min-width: 14em; /* the same with or without videos */
    top: 8px;
    bottom: auto;
    margin: 0 auto;
  }

  /* Transitions, not keyframes: closing during the fade-in (or cancelling
     during the fade-out) reverses from where the dialog is. */
  dialog:popover-open {
    transition: opacity 1s ease-out, transform 1s ease-out;
  }

  @starting-style {
    dialog:popover-open {
      opacity: 0;
      transform: translateY(calc(-100% - 8px));
    }
  }

  dialog:popover-open.closing {
    opacity: 0;
    transform: translateY(calc(-100% - 8px));
  }

  /* Tables in quirks mode (no doctype) don't inherit these */
  table {
    color: inherit;
    font: inherit;
  }

  input {
    width: 5ch;
  }

  button, select {
    color: inherit;
    background-color: var(--bp-control);
    border: 1px solid var(--bp-control-border);
    border-radius: 4px;
    font: inherit;
  }

  button:hover, select:hover {
    background-color: var(--bp-control-hover);
  }
${settingsStyles}`

export function run(chosen: Options): void {
  if (toggleOpenDialog()) return
  const { lang } = chosen
  const text = texts[lang]
  // Without a video there is nothing to bind, and closing must not
  // overwrite saved sections (the video may just not be loaded yet).
  const hasVideo = document.querySelector("video") !== null
  const sections: Array<number> = [] // flat: [start0, end0, start1, …] in s
  let videoIndex = 0
  const videos = () => document.querySelectorAll("video")
  const video = () => videos()[videoIndex]!
  const storageKey = () => `media-manager-${window.location.href}`

  // The focused start/end input: a paused seek updates it instead of
  // appending a boundary
  let seekTarget: HTMLInputElement | undefined

  /* Listens on the picked video only. The controller sits on the page's
     global object, so a later run (after close) releases this binding too. */
  function playOnlySections() {
    const global = globalThis as { [binding]?: AbortController }
    global[binding]?.abort()
    const { signal } = (global[binding] = new AbortController())
    const media = video()
    media.addEventListener("timeupdate", () => onTimeUpdate(media), { signal })
    media.addEventListener("seeked", () => onSeeked(media), { signal })
  }

  function onTimeUpdate(media: HTMLVideoElement) {
    if (media.paused) return
    const time = media.currentTime
    if (time < sections[0]! || time > sections[sections.length - 1]!) {
      media.currentTime = sections[0]!
    } else {
      for (let i = 1; i < sections.length - 1; i += 2) {
        if (time > sections[i]! && time < sections[i + 1]!) {
          media.currentTime = sections[i + 1]!
        }
      }
    }
  }

  function onSeeked(media: HTMLVideoElement) {
    if (!media.paused) return
    if (seekTarget) {
      seekTarget.value = `${Math.round(media.currentTime)}`
      const inputs = root.querySelectorAll(".section-start, .section-end")
      for (const [index, candidate] of inputs.entries()) {
        if (candidate === seekTarget) sections[index] = media.currentTime
      }
      return
    }
    sections.push(media.currentTime)
    if (sections.length % 2 === 0) {
      addSectionRow(
        sections[sections.length - 2]!,
        sections[sections.length - 1]!
      )
    }
  }

  function addSectionRow(start: number, end: number) {
    const input = (className: string, value: number): HTMLInputElement =>
      h("input", {
        class: className,
        type: "text",
        readOnly: true,
        value: `${Math.round(value)}`,
        onfocus: (event: FocusEvent) =>
          (seekTarget = event.target as HTMLInputElement),
        onblur: () => (seekTarget = undefined)
      })
    const row = h(
      "tr",
      { class: "section" },
      h("td", null, input("section-start", start)),
      h("td", null, input("section-end", end)),
      h(
        "td",
        null,
        h(
          "button",
          { class: "section-delete", onclick: () => deleteSection(row) },
          "❌"
        )
      )
    )
    sectionRows.append(row)
  }

  function deleteSection(row: HTMLTableRowElement) {
    const index = [...root.querySelectorAll(".section")].indexOf(row)
    row.remove()
    sections.splice(2 * index, 2)
  }

  function highlight(element: Element) {
    const rect = element.getBoundingClientRect()
    // A page element: assigning `style` still works under `style-src 'none'`
    const overlay = h("div", {
      style: `position: fixed; pointer-events: none; z-index: 1234; top: ${rect.top}px; left: ${rect.left}px; width: ${rect.width}px; height: ${rect.height}px; background-color: rgb(0 255 0 / 50%)`
    })
    document.body.append(overlay)
    setTimeout(() => overlay.remove(), 3000)
  }

  const select = h(
    "select",
    {
      class: "video-select",
      onchange: () => {
        const selected = videos()[Number(select.value)]
        if (selected) {
          videoIndex = Number(select.value)
          highlight(selected)
          playOnlySections()
        }
      }
    },
    ...Array.from(videos(), (_, index) =>
      h("option", { value: `${index}` }, `${index}`)
    )
  )
  const sectionRows = h(
    "tbody",
    null,
    h("tr", null, h("th", null, text.start), h("th", null, text.end), h("th"))
  )

  function saveState() {
    window.localStorage.setItem(
      storageKey(),
      JSON.stringify({ mediaElementIndex: videoIndex, sections })
    )
  }

  function closeDialog() {
    if (hasVideo) saveState()
    dialog.classList.add("closing")
    dialog.addEventListener(
      "transitionend",
      () => {
        if (!dialog.classList.contains("closing")) return // canceled
        dialog.hidePopover()
        host.remove()
      },
      { once: true }
    )
  }

  function restoreState() {
    const state = JSON.parse(
      window.localStorage.getItem(storageKey()) ?? "null"
    ) as { mediaElementIndex: number; sections: Array<number> } | null
    if (!state) return
    videoIndex = state.mediaElementIndex
    select.value = `${videoIndex}`
    sections.push(...state.sections)
    for (let i = 0; i < sections.length - 1; i += 2) {
      addSectionRow(sections[i]!, sections[i + 1]!)
    }
  }

  // The settings view takes the main view's place
  const main = h(
    "div",
    null,
    ...(hasVideo
      ? [h("div", null, text.video, select), h("table", null, sectionRows)]
      : [h("p", null, text.noVideo)])
  )
  const settings = settingsView(options, chosen, lang => texts[lang].name)
  settings.hidden = true
  const toggle = h(
    "button",
    {
      class: "settings-toggle",
      "aria-label": settingsTexts[lang].settings,
      "aria-expanded": false,
      onclick: () => {
        main.hidden = settings.hidden
        settings.hidden = !main.hidden
        toggle.setAttribute("aria-expanded", `${main.hidden}`)
      }
    },
    "⚙"
  )

  // Where the dialog was grabbed, relative to its top-left corner
  let grabX = 0
  let grabY = 0
  const dialog = h(
    "dialog",
    {
      popover: "manual",
      draggable: true,
      // Dragging the settings link bubbles here too: it moves no dialog
      ondragstart: (event: DragEvent) => {
        if (event.target !== dialog) return
        const rect = dialog.getBoundingClientRect()
        grabX = event.clientX - rect.left
        grabY = event.clientY - rect.top
      },
      ondragend: (event: DragEvent) => {
        if (event.target !== dialog) return
        const html = document.documentElement
        const rect = dialog.getBoundingClientRect()
        const maxLeft = html.clientWidth - rect.width
        const maxTop = html.clientHeight - rect.height
        const left = Math.min(Math.max(event.clientX - grabX, 0), maxLeft)
        const top = Math.min(Math.max(event.clientY - grabY, 0), maxTop)
        setDynamicCss(
          `dialog { top: ${top}px; left: ${left}px; right: auto; margin: 0; }`
        )
      }
    },
    toggle,
    main,
    settings,
    h("button", { class: "close", onclick: closeDialog }, text.close)
  )
  const { host, root, setDynamicCss } = mount(hostId, styles, dialog)
  dialog.showPopover()
  if (hasVideo) {
    restoreState()
    playOnlySections()
  }
}
