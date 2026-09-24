// spellchecker:ignore spinbutton breite

import { fileURLToPath } from "node:url"
import type { Page } from "@playwright/test"
import { expect, test } from "./fixture"
import { compileBookmarklet } from "../../pipeline/build"

// The settings view (`lib/settings.ts`) for the option kinds no published
// bookmarklet tests yet, on a test bookmarklet that only shows it.
const entry = fileURLToPath(
  new URL("fixtures/number-option.ts", import.meta.url)
)
const fixtureUrl = "http://test.local/"

async function runWith(page: Page, options: object) {
  await page.route(fixtureUrl, route =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body></body></html>"
    })
  )
  await page.goto(fixtureUrl)
  await page.evaluate((await compileBookmarklet(entry, options)).minified)
  return page.locator("#number-option .settings")
}

test.describe("the settings view's number option", () => {
  test("shows a slider and a number field with the running value", async ({
    page
  }) => {
    const settings = await runWith(page, { lang: "en", width: 720 })

    await expect(settings.getByRole("slider", { name: "Width" })).toHaveValue(
      "720"
    )
    await expect(
      settings.getByRole("spinbutton", { name: "Width" })
    ).toHaveValue("720")
  })

  test("moves the number field and the link with the slider", async ({
    page
  }) => {
    const settings = await runWith(page, { lang: "en", width: 960 })

    await settings.getByRole("slider", { name: "Width" }).fill("1280")

    await expect(
      settings.getByRole("spinbutton", { name: "Width" })
    ).toHaveValue("1280")
    const built = await compileBookmarklet(entry, { lang: "en", width: 1280 })
    await expect(settings.getByRole("link")).toHaveAttribute("href", built.href)
  })

  test("takes any typed number within the range", async ({ page }) => {
    const settings = await runWith(page, { lang: "en", width: 960 })

    await settings.getByRole("spinbutton", { name: "Width" }).fill("1234")

    // The slider moves in steps, the link keeps the number
    await expect(settings.getByRole("slider", { name: "Width" })).toHaveValue(
      "1230"
    )
    const built = await compileBookmarklet(entry, { lang: "en", width: 1234 })
    await expect(settings.getByRole("link")).toHaveAttribute("href", built.href)
  })

  test("ignores a typed number outside the range", async ({ page }) => {
    const settings = await runWith(page, { lang: "en", width: 960 })
    const field = settings.getByRole("spinbutton", { name: "Width" })
    const href = await settings.getByRole("link").getAttribute("href")

    await field.fill("5000")
    await expect(settings.getByRole("link")).toHaveAttribute("href", href!)
    await field.blur()

    await expect(field).toHaveValue("960")
    await expect(settings.getByRole("slider", { name: "Width" })).toHaveValue(
      "960"
    )
  })

  test("relabels the number option in the chosen language", async ({
    page
  }) => {
    const settings = await runWith(page, { lang: "en", width: 960 })

    await settings
      .getByRole("combobox", { name: "Language" })
      .selectOption("de")

    await expect(settings.getByRole("slider", { name: "Breite" })).toBeVisible()
    await expect(
      settings.getByRole("spinbutton", { name: "Breite" })
    ).toBeVisible()
  })
})
