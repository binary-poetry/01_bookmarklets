// SPDX-License-Identifier: MIT-0

import type {
  OptionsDefinition,
  OptionValues
} from "../bookmarklets/lib/options"

/** The options a bookmarklet is published with. */
export function defaultsOf<D extends OptionsDefinition>(
  definition: D
): OptionValues<D> {
  return Object.fromEntries(
    Object.entries(definition).map(([key, option]) => [key, option.default])
  ) as OptionValues<D>
}
