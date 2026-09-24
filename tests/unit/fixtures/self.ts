declare const bookmarklet: () => void

export function run(options: object): void {
  ;(globalThis as { echoed?: unknown }).echoed = {
    source: String(bookmarklet),
    options
  }
}
