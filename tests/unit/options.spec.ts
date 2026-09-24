// spellchecker:ignore deutsch sprache anbieter breite

import { describe, expect, it } from "vitest"
import { defaultsOf } from "../../pipeline/options"

describe("defaultsOf", () => {
  it("picks each option's default", () => {
    const definition = {
      lang: {
        label: { en: "Language", de: "Sprache" },
        choices: {
          en: { en: "English", de: "English" },
          de: { en: "Deutsch", de: "Deutsch" }
        },
        default: "de"
      },
      provider: {
        label: { en: "Provider", de: "Anbieter" },
        choices: {
          gmail: { en: "Gmail", de: "Gmail" },
          proton: { en: "Proton Mail", de: "Proton Mail" }
        },
        default: "gmail"
      }
    } as const

    expect(defaultsOf(definition)).toEqual({ lang: "de", provider: "gmail" })
  })

  it("keeps a number option's default a number", () => {
    const definition = {
      width: {
        label: { en: "Width", de: "Breite" },
        min: 480,
        max: 1920,
        step: 10,
        default: 960
      }
    } as const

    const width: number = defaultsOf(definition).width

    expect(width).toBe(960)
  })
})
