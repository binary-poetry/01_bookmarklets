// SPDX-License-Identifier: MIT-0

/** The languages of every bookmarklet's UI (its `lang` option). */
export type Lang = "en" | "de"

/** One option the page shows as a select. `choices` maps values to labels.
 * Labels come in every language, so a form shows them in its own. */
type ChoiceOption = {
  label: Record<Lang, string>
  choices: Record<string, Record<Lang, string>>
  default: string
}

/** One option the page shows as a slider with a number field: any number
 * from `min` to `max`, the slider moving in `step`s. */
export type NumberOption = {
  label: Record<Lang, string>
  min: number
  max: number
  step: number
  default: number
}

/** A bookmarklet's options, from which the page renders its form. Types
 * don't exist at runtime, so each bookmarklet exports this as a value. */
export type OptionsDefinition = Record<string, ChoiceOption | NumberOption>

/** The values `run` receives for a definition. */
export type OptionValues<D extends OptionsDefinition> = {
  [K in keyof D]: D[K] extends ChoiceOption
    ? keyof D[K]["choices"] & string
    : number
}
