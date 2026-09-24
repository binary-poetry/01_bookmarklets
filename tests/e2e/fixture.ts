import { test as base, expect, type Page } from "@playwright/test"

/** Fails a test on console warnings and errors, and on uncaught exceptions,
 * so a bookmarklet that breaks quietly on a page still fails. */
export const test = base.extend<{
  noWarningsOrErrorsInConsole: void
  noUncaughtExceptions: void
}>({
  noWarningsOrErrorsInConsole: [
    async ({ page }: { page: Page }, use) => {
      const messages: Array<string> = []
      page.on("console", message => {
        if (message.type() === "warning" || message.type() === "error") {
          messages.push(`${message.type()}: ${message.text()}`)
        }
      })
      await use()
      expect(messages).toEqual([])
    },
    { auto: true }
  ],
  noUncaughtExceptions: [
    async ({ page }: { page: Page }, use) => {
      const errors: Array<Error> = []
      page.on("pageerror", error => errors.push(error))
      await use()
      expect(errors).toEqual([])
    },
    { auto: true }
  ]
})

export { expect } from "@playwright/test"
