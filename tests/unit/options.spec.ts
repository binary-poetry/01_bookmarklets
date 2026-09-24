// spellchecker:ignore deutsch

import { describe, expect, it } from "vitest"
import { defaultsOf } from "../../pipeline/options"

describe("defaultsOf", () => {
  it("picks each option's default", () => {
    const definition = {
      lang: {
        label: "Language",
        choices: { en: "English", de: "Deutsch" },
        default: "de"
      },
      provider: {
        label: "Provider",
        choices: { gmail: "Gmail", proton: "Proton Mail" },
        default: "gmail"
      }
    } as const

    expect(defaultsOf(definition)).toEqual({ lang: "de", provider: "gmail" })
  })
})
