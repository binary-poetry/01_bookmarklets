// SPDX-License-Identifier: MIT-0
// spellchecker:ignore sprache deutsch breite

import { h } from "../../../bookmarklets/lib/h"
import { mount } from "../../../bookmarklets/lib/mount"
import type {
  OptionsDefinition,
  OptionValues
} from "../../../bookmarklets/lib/options"
import {
  settingsStyles,
  settingsView
} from "../../../bookmarklets/lib/settings"

/** Not a bookmarklet: only the settings view for a number option. */
export const options = {
  lang: {
    label: { en: "Language", de: "Sprache" },
    choices: {
      en: { en: "English", de: "English" },
      de: { en: "Deutsch", de: "Deutsch" }
    },
    default: "en"
  },
  width: {
    label: { en: "Width", de: "Breite" },
    min: 480,
    max: 1920,
    step: 10,
    default: 960
  }
} as const satisfies OptionsDefinition

export function run(chosen: OptionValues<typeof options>): void {
  mount(
    "number-option",
    settingsStyles,
    h(
      "div",
      null,
      settingsView(options, chosen, lang => `Number option (${lang})`)
    )
  )
}
