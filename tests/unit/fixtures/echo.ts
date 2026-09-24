export const defaults = { lang: "en" }

export function run(options: typeof defaults): void {
  ;(globalThis as { echoed?: unknown }).echoed = options
}
