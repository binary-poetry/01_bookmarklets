// SPDX-License-Identifier: MIT-0

type Child = Node | string

/** Creates an element without `innerHTML`, so Trusted Types can't break it.
 * `on*` functions become listeners, known properties (`value`, `popover`,
 * `draggable`, …) are assigned, anything else becomes an attribute. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> | null = null,
  ...children: Array<Child>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [key, value] of Object.entries(props ?? {})) {
    if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2), value as EventListener)
    } else if (key in element) {
      ;(element as unknown as Record<string, unknown>)[key] = value
    } else {
      element.setAttribute(key, String(value))
    }
  }
  element.append(...children)
  return element
}
