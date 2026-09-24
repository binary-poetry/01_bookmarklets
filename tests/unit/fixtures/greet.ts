import { shout } from "./lib/shout"

export function run(options: { name: string }): void {
  ;(globalThis as { echoed?: unknown }).echoed = shout(options.name)
}
