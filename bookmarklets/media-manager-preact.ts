// SPDX-License-Identifier: MIT-0

// The media manager again, with Preact + htm instead of the mini lib, to
// compare their sizes. It behaves exactly like `media-manager.ts`.

import htm from "htm"
import { h, render } from "preact"
import { useLayoutEffect, useRef, useState } from "preact/hooks"
import { mount } from "./lib/mount"
import type { Lang } from "./lib/options"
import { linkFor, settingsTexts } from "./lib/settings"
import "./lib/third-party-licenses"
import {
  hostId,
  options,
  styles,
  texts,
  toggleOpenDialog,
  type Options
} from "./media-manager"

export { options }

const html = htm.bind(h)
const binding = Symbol.for(hostId)
type State = { mediaElementIndex: number; sections: Array<number> }

const videos = () => document.querySelectorAll("video")
const storageKey = () => `media-manager-${window.location.href}`

// One highlight at a time: a new one replaces the last
let overlay: HTMLDivElement | undefined
function highlight(element: Element) {
  overlay?.remove()
  const rect = element.getBoundingClientRect()
  // A page element: assigning `style` still works under `style-src 'none'`
  const current = (overlay = document.createElement("div"))
  current.style.cssText = `position: fixed; pointer-events: none; z-index: 1234; top: ${rect.top}px; left: ${rect.left}px; width: ${rect.width}px; height: ${rect.height}px; background-color: oklch(84% .15 90deg / 50%)`
  document.body.append(current)
  setTimeout(() => current.remove(), 3000)
}

/** Like `settingsView` in `lib/settings.ts`: a select per option and the
 * link to drag, in the chosen `lang`. */
function Settings(props: { chosen: Options; hidden: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(props.chosen)
  const lang = values.lang as Lang
  return html`<div class="settings" hidden=${props.hidden}>
    ${Object.entries(options).map(
      ([key, option]) =>
        html`<label
          ><span>${option.label[lang]}</span> <select
            value=${values[key]}
            onChange=${(event: Event) =>
              setValues({
                ...values,
                [key]: (event.target as HTMLSelectElement).value
              })}
          >
            ${Object.entries(option.choices).map(
              ([value, labels]) =>
                html`<option value=${value}>${labels[lang]}</option>`
            )}
          </select></label
        >`
    )}
    <p>${settingsTexts[lang].drag}</p>
    <a
      href=${linkFor(values)}
      onClick=${(event: Event) => event.preventDefault()}
      >${texts[lang].name}</a
    >
  </div>`
}

function MediaManager(props: {
  chosen: Options
  text: (typeof texts)["en"]
  saved: State
  /** The saved video, if the page no longer has it */
  gone: number | undefined
  hasVideo: boolean
  close: (state: State) => void
  setDynamicCss: (css: string) => void
}) {
  const { text, saved } = props
  // flat: [start0, end0, start1, …] in s
  const [sections, setSections] = useState(saved.sections)
  const [videoIndex, setVideoIndex] = useState(saved.mediaElementIndex)
  const [gone, setGone] = useState(props.gone)
  // Preact renders asynchronously, so the video's listeners read refs.
  const live = useRef(sections)
  live.current = sections
  // The focused start/end input: a paused seek updates it instead of
  // appending a boundary
  const seekTarget = useRef<number>()
  // Where the dialog was grabbed, relative to its top-left corner
  const grab = useRef({ x: 0, y: 0 })
  // The settings view takes the main view's place
  const [showSettings, setShowSettings] = useState(false)

  /* Listens on the picked video only. The controller sits on the page's
     global object, so a later run (after close) releases this binding too.
     No cleanup: the sections keep playing after close. */
  useLayoutEffect(() => {
    if (!props.hasVideo) return
    const global = globalThis as { [binding]?: AbortController }
    global[binding]?.abort()
    const { signal } = (global[binding] = new AbortController())
    const media = videos()[videoIndex]!
    media.addEventListener(
      "timeupdate",
      () => {
        if (media.paused) return
        const time = media.currentTime
        const sections = live.current
        if (time < sections[0]! || time > sections[sections.length - 1]!) {
          media.currentTime = sections[0]!
        } else {
          for (let i = 1; i < sections.length - 1; i += 2) {
            if (time > sections[i]! && time < sections[i + 1]!) {
              media.currentTime = sections[i + 1]!
            }
          }
        }
      },
      { signal }
    )
    media.addEventListener(
      "seeked",
      () => {
        if (!media.paused) return
        const target = seekTarget.current
        setSections(sections =>
          target === undefined
            ? sections.length % 2
              ? // Two points make a section, whichever came first
                [
                  ...sections.slice(0, -1),
                  ...[sections.at(-1)!, media.currentTime].sort((a, b) => a - b)
                ]
              : [...sections, media.currentTime]
            : // An end before its start can't play: ignore such a seek
              (
                  target % 2
                    ? media.currentTime < sections[target ^ 1]!
                    : media.currentTime > sections[target ^ 1]!
                )
              ? sections
              : sections.map((time, index) =>
                  index === target ? media.currentTime : time
                )
        )
      },
      { signal }
    )
  }, [videoIndex])

  const boundary = (className: string, index: number) =>
    html`<input
      class=${className}
      type="text"
      readonly
      value=${Math.round(sections[index]!)}
      onFocus=${() => (seekTarget.current = index)}
      onBlur=${() => (seekTarget.current = undefined)}
    />`

  const rows = []
  for (let i = 0; i < sections.length - 1; i += 2) {
    rows.push(
      html`<tr class="section">
        <td>${boundary("section-start", i)}</td>
        <td>${boundary("section-end", i + 1)}</td>
        <td>
          <button
            class="section-delete"
            onClick=${() => setSections(sections => sections.toSpliced(i, 2))}
          >
            ❌
          </button>
        </td>
      </tr>`
    )
  }

  return html`<dialog
    popover="manual"
    draggable
    onDragStart=${(event: DragEvent) => {
      // Dragging the settings link bubbles here too: it moves no dialog
      if (event.target !== event.currentTarget) return
      const rect = (event.currentTarget as Element).getBoundingClientRect()
      grab.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }
    }}
    onDragEnd=${(event: DragEvent) => {
      if (event.target !== event.currentTarget) return
      const html = document.documentElement
      const rect = (event.currentTarget as Element).getBoundingClientRect()
      const maxLeft = html.clientWidth - rect.width
      const maxTop = html.clientHeight - rect.height
      const left = Math.min(
        Math.max(event.clientX - grab.current.x, 0),
        maxLeft
      )
      const top = Math.min(Math.max(event.clientY - grab.current.y, 0), maxTop)
      props.setDynamicCss(
        `dialog { top: ${top}px; left: ${left}px; right: auto; margin: 0; }`
      )
    }}
  >
    <header>
      <h2>${text.name}</h2>
      <button
        class="settings-toggle"
        aria-label=${settingsTexts[props.chosen.lang].settings}
        aria-expanded=${showSettings}
        onClick=${() => setShowSettings(show => !show)}
      >
        ⚙
      </button>
      <button
        class="close"
        aria-label=${text.close}
        onClick=${() => props.close({ mediaElementIndex: videoIndex, sections })}
      >
        ✕
      </button>
    </header>
    <div hidden=${showSettings}>
    ${
      gone !== undefined &&
      html`<p class="notice">
      <span>${text.gone(gone)}</span>
      <button
        aria-label=${text.dismiss}
        onClick=${() => setGone(undefined)}
      >
        ✕
      </button>
    </p>`
    }
    ${
      props.hasVideo
        ? // A single video needs no picker: the highlight shows which one
          html`${
            videos().length > 1 &&
            html`<div>
            ${text.video}
            <select
              class="video-select"
              value=${videoIndex}
              onChange=${(event: Event) => {
                const index = Number((event.target as HTMLSelectElement).value)
                const selected = videos()[index]
                if (selected) {
                  setVideoIndex(index)
                  highlight(selected)
                }
              }}
            >
              ${Array.from(
                videos(),
                (_, index) => html`<option value=${index}>${index}</option>`
              )}
            </select>
          </div>`
          }
          <table>
            <tbody>
              <tr>
                <th>${text.start}</th>
                <th>${text.end}</th>
                <th></th>
              </tr>
              ${rows}
            </tbody>
          </table>
          <p class="hint">${text.hint}</p>`
        : html`<p>${text.noVideo}</p>`
    }
    </div>
    <${Settings} chosen=${props.chosen} hidden=${!showSettings} />
  </dialog>`
}

export function run(chosen: Options): void {
  if (toggleOpenDialog()) return
  const { lang } = chosen
  // Without a video there is nothing to bind, and closing must not
  // overwrite saved sections (the video may just not be loaded yet).
  const hasVideo = document.querySelector("video") !== null
  const saved = (JSON.parse(
    window.localStorage.getItem(storageKey()) ?? "null"
  ) as State | null) ?? { mediaElementIndex: 0, sections: [] }
  // The page may have fewer videos now: fall back to the first one
  const gone =
    hasVideo && !videos()[saved.mediaElementIndex]
      ? saved.mediaElementIndex
      : undefined
  if (gone !== undefined) saved.mediaElementIndex = 0

  const { host, root, setDynamicCss } = mount(hostId, styles)
  function close(state: State) {
    if (hasVideo) {
      window.localStorage.setItem(storageKey(), JSON.stringify(state))
    }
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
  render(
    html`<${MediaManager}
      chosen=${chosen}
      text=${texts[lang]}
      saved=${saved}
      gone=${gone}
      hasVideo=${hasVideo}
      close=${close}
      setDynamicCss=${setDynamicCss}
    />`,
    root
  )
  const dialog = root.querySelector("dialog")!
  dialog.showPopover()
  if (hasVideo) highlight(videos()[saved.mediaElementIndex]!)
}
