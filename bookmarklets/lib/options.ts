// SPDX-License-Identifier: MIT-0

/** One option the page shows as a select. `choices` maps values to labels. */
type ChoiceOption = {
  label: string
  choices: Record<string, string>
  default: string
}

/** A bookmarklet's options, from which the page renders its form. Types
 * don't exist at runtime, so each bookmarklet exports this as a value. */
export type OptionsDefinition = Record<string, ChoiceOption>

/** The values `run` receives for a definition. */
export type OptionValues<D extends OptionsDefinition> = {
  [K in keyof D]: keyof D[K]["choices"] & string
}
