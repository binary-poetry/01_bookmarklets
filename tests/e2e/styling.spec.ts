import type { Page } from "@playwright/test"
import { expect, test as base } from "./fixture"

// The browser behavior `lib/mount.ts` and the post "Styling a bookmarklet"
// rely on, from the spikes that decided it. A CSP logs what it blocks as a
// console error, so these tests assert the errors themselves.
const test = base.extend<{ consoleErrors: Array<string> }>({
  consoleErrors: async ({ page }, use) => {
    const errors: Array<string> = []
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text())
    })
    await use(errors)
  },
  // Playwright needs the destructuring pattern to see the dependencies.
  // eslint-disable-next-line no-empty-pattern
  noWarningsOrErrorsInConsole: async ({}, use) => {
    await use()
  }
})

const url = "http://test.local/"
const red = "rgb(255, 0, 0)"

async function open(page: Page, csp: string, body: string) {
  await page.route(url, route =>
    route.fulfill({
      contentType: "text/html",
      headers: { "Content-Security-Policy": csp },
      body: `<!doctype html>${body}`
    })
  )
  await page.goto(url)
}

type Row = {
  method: string
  /** Tries to make an element red and returns it. */
  run: () => Element
  applies: boolean
  /** Blocked by the CSP, which logs a violation. */
  blocked: boolean
}

/** Checks whether `row` turns its element red, and that only a blocked row
 * logs a CSP violation. */
async function tryRow(page: Page, consoleErrors: Array<string>, row: Row) {
  const element = await page.evaluateHandle(row.run)
  const color = await element.evaluate(e => getComputedStyle(e).color)
  expect(color === red).toBe(row.applies)
  if (row.blocked) {
    await expect
      .poll(() => consoleErrors)
      .toEqual([expect.stringContaining("Content Security Policy")])
  } else {
    expect(consoleErrors).toEqual([])
  }
}

test.describe("under style-src 'none'", () => {
  const rows: Array<Row> = [
    {
      method: "<style> injected into the document",
      run: () => {
        const style = document.createElement("style")
        style.textContent = ".x { color: red }"
        document.head.append(style)
        const p = document.createElement("p")
        p.className = "x"
        document.body.append(p)
        return p
      },
      applies: false,
      blocked: true
    },
    {
      method: "<style> inside a shadow root",
      run: () => {
        const root = document.body
          .appendChild(document.createElement("div"))
          .attachShadow({ mode: "open" })
        const style = document.createElement("style")
        style.textContent = "p { color: red }"
        root.append(style)
        return root.appendChild(document.createElement("p"))
      },
      applies: false,
      blocked: true
    },
    {
      method: 'element.setAttribute("style", "…")',
      run: () => {
        const p = document.body.appendChild(document.createElement("p"))
        p.setAttribute("style", "color: red")
        return p
      },
      applies: false,
      blocked: true
    },
    {
      method: 'element.style = "…"',
      run: () => {
        const p = document.body.appendChild(document.createElement("p"))
        p.style = "color: red"
        return p
      },
      applies: true,
      blocked: false
    },
    {
      method: "adoptedStyleSheets with a CSSStyleSheet",
      run: () => {
        const root = document.body
          .appendChild(document.createElement("div"))
          .attachShadow({ mode: "open" })
        const sheet = new CSSStyleSheet()
        sheet.replaceSync("p { color: red }")
        root.adoptedStyleSheets = [sheet]
        return root.appendChild(document.createElement("p"))
      },
      applies: true,
      blocked: false
    }
  ]

  for (const row of rows) {
    test(`${row.method} ${row.applies ? "applies" : "doesn't apply"}`, async ({
      page,
      consoleErrors
    }) => {
      await open(page, "default-src 'none'; style-src 'none'", "<p>page</p>")

      await tryRow(page, consoleErrors, row)
    })
  }
})

test.describe("against a page rule with !important", () => {
  const rows: Array<Row> = [
    {
      method: 'el.style.color = "red"',
      run: () => {
        const p = document.getElementById("x")!
        p.style.color = "red"
        return p
      },
      applies: false,
      blocked: false
    },
    {
      method: 'el.style.setProperty("color", "red", "important")',
      run: () => {
        const p = document.getElementById("x")!
        p.style.setProperty("color", "red", "important")
        return p
      },
      applies: true,
      blocked: false
    },
    {
      method: 'el.style = "color: red !important"',
      run: () => {
        const p = document.getElementById("x")!
        p.style = "color: red !important"
        return p
      },
      applies: true,
      blocked: false
    },
    {
      method: 'el.setAttribute("style", "color: red !important")',
      run: () => {
        const p = document.getElementById("x")!
        p.setAttribute("style", "color: red !important")
        return p
      },
      applies: false,
      blocked: true
    },
    {
      method: "adopted document sheet, #id { color: red !important }",
      run: () => {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync("#x { color: red !important }")
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
        return document.getElementById("x")!
      },
      applies: true,
      blocked: false
    },
    {
      method: "adopted document sheet, p#id { color: red } (more specific)",
      run: () => {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync("p#x { color: red }")
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
        return document.getElementById("x")!
      },
      applies: false,
      blocked: false
    }
  ]

  for (const row of rows) {
    test(`${row.method} ${row.applies ? "wins" : "loses"}`, async ({
      page,
      consoleErrors
    }) => {
      await open(
        page,
        "default-src 'none'; style-src 'nonce-abc'",
        `<style nonce="abc">p { color: blue !important }</style><p id="x">page</p>`
      )

      await tryRow(page, consoleErrors, row)
    })
  }
})

test.describe("inherited page styles", () => {
  const styleOf = async (page: Page, hostCss: string) => {
    await open(
      page,
      "default-src 'none'; style-src 'nonce-abc'",
      `<style nonce="abc">body { color: rgb(0, 128, 0); font-size: 20px }</style>`
    )
    return page.evaluate(css => {
      const root = document.body
        .appendChild(document.createElement("div"))
        .attachShadow({ mode: "open" })
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(css)
      root.adoptedStyleSheets = [sheet]
      const { color, fontSize } = getComputedStyle(
        root.appendChild(document.createElement("p"))
      )
      return { color, fontSize }
    }, hostCss)
  }

  test("leak into a shadow root", async ({ page }) => {
    expect(await styleOf(page, "")).toEqual({
      color: "rgb(0, 128, 0)",
      fontSize: "20px"
    })
  })

  test("stay out with :host { all: initial }", async ({ page }) => {
    expect(await styleOf(page, ":host { all: initial }")).toEqual({
      color: "rgb(0, 0, 0)",
      fontSize: "16px"
    })
  })
})
