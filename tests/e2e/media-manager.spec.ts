// spellchecker:ignore webm ende schliessen einstellungen sprache deutsch medien pausiere spule zwei stellen einen abschnitt markieren

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { Page } from "@playwright/test"
import { expect, test } from "./fixture"
import { compileBookmarklet } from "../../pipeline/build"

// Regression test for the TypeScript port of the media manager, based on the
// spike that compared the reconstructed source with the original `mm.js`. The
// Preact + htm showcase has to behave exactly the same.

const variants = {
  "media-manager": "mini lib",
  "media-manager-preact": "Preact + htm"
}
// A 10 s, 64x64 WebM. As a data URL it is seekable without a server.
const video = readFileSync(
  new URL("fixtures/video.webm", import.meta.url)
).toString("base64")
const fixtureUrl = "http://test.local/"
const videoTag = `<video muted width="320" height="180" src="data:video/webm;base64,${video}"></video>\n`
const fixture = `<!doctype html><html><body>
</body></html>`

async function openFixture(
  page: Page,
  { head = "", csp = "", quirks = false, videos = 2 } = {}
) {
  // A routed URL gives the page a real origin, so `localStorage` works.
  await page.route(fixtureUrl, route =>
    route.fulfill({
      contentType: "text/html",
      headers: csp ? { "Content-Security-Policy": csp } : {},
      body: fixture
        .replace("<body>", `<head>${head}</head><body>`)
        // Without a doctype, tables don't inherit color and font.
        .replace(quirks ? "<!doctype html>" : "", "")
        .replace("</body>", `${videoTag.repeat(videos)}</body>`)
    })
  )
  await page.goto(fixtureUrl)
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll("video")]
        .filter(v => v.readyState < 1)
        .map(v => new Promise(r => v.addEventListener("loadedmetadata", r)))
    )
  )
}

/** Seeks video `index` to `time` and waits until the `seeked` handlers ran. */
const seek = (page: Page, index: number, time: number) =>
  page.evaluate(
    ([index, time]) =>
      new Promise(resolve => {
        const video = document.querySelectorAll("video")[index]!
        video.addEventListener("seeked", () => setTimeout(resolve, 50), {
          once: true
        })
        video.currentTime = time
      }),
    [index, time] as const
  )

/** Plays video `index` from `time` for 700 ms, returns where it ended up. */
const playFrom = (page: Page, index: number, time: number) =>
  page.evaluate(
    async ([index, time]) => {
      const video = document.querySelectorAll("video")[index]!
      await video.play()
      video.currentTime = time
      await new Promise(resolve => setTimeout(resolve, 700))
      const reached = video.currentTime
      video.pause()
      await new Promise(resolve => setTimeout(resolve, 100))
      return reached
    },
    [index, time] as const
  )

const sectionRows = (page: Page) =>
  page
    .locator("#binary-poetry-media-manager .section")
    .evaluateAll(rows =>
      rows.map(row =>
        Array.from(row.querySelectorAll("input"), input => input.value)
      )
    )

for (const [id, base] of Object.entries(variants)) {
  test.describe(`media manager bookmarklet (${base})`, () => {
    const entry = fileURLToPath(
      new URL(`../../bookmarklets/${id}.ts`, import.meta.url)
    )
    let bookmarklet: string

    test.beforeAll(async () => {
      bookmarklet = (await compileBookmarklet(entry, { lang: "en" })).minified
    })

    const runBookmarklet = (page: Page) => page.evaluate(bookmarklet)

    test("names itself at the top", async ({ page }) => {
      await openFixture(page)

      await runBookmarklet(page)

      const dialog = page.locator("#binary-poetry-media-manager dialog")
      await expect(dialog.getByRole("heading")).toHaveText("Media manager")
    })

    test("opens a dialog with one option per video", async ({ page }) => {
      await openFixture(page)

      await runBookmarklet(page)

      const dialog = page.locator("#binary-poetry-media-manager dialog")
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole("combobox")).toHaveValue("0")
      expect(
        await dialog
          .getByRole("option")
          .evaluateAll(options =>
            options.map(o => [(o as HTMLOptionElement).value, o.textContent])
          )
      ).toEqual([
        ["0", "0"],
        ["1", "1"]
      ])
      await expect(dialog.locator("th")).toHaveText(["Start", "End", ""])
    })

    test("explains how to mark a section while there is none", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)
      const dialog = page.locator("#binary-poetry-media-manager dialog")
      const hint = dialog.getByText(
        "Pause the video and seek to two points to mark a section."
      )
      await expect(hint).toBeVisible()

      for (const time of [1, 2]) await seek(page, 0, time)
      await expect(hint).toBeHidden()

      await dialog.locator(".section-delete").click()
      await expect(hint).toBeVisible()
    })

    test("marks a section per two seeks of the paused video", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)

      for (const time of [1, 2, 4, 5]) await seek(page, 0, time)

      expect(await sectionRows(page)).toEqual([
        ["1", "2"],
        ["4", "5"]
      ])
    })

    test("marks a section from its two points in either order", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)

      for (const time of [5, 2]) await seek(page, 0, time)
      const fromBefore = await playFrom(page, 0, 1)

      expect(await sectionRows(page)).toEqual([["2", "5"]])
      expect(fromBefore, "jumps to the start").toBeGreaterThanOrEqual(2)
      expect(fromBefore).toBeLessThan(3)
    })

    test("ignores an edit that would put the end before the start", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [2, 5]) await seek(page, 0, time)
      const boundary = (name: string) =>
        page.locator(`#binary-poetry-media-manager .section-${name}`)

      await boundary("start").focus()
      await seek(page, 0, 7)
      await boundary("end").focus()
      await seek(page, 0, 1)
      await boundary("end").blur()
      const fromAfterEnd = await playFrom(page, 0, 6)

      expect(await sectionRows(page)).toEqual([["2", "5"]])
      expect(fromAfterEnd, "still plays 2–5").toBeGreaterThanOrEqual(2)
      expect(fromAfterEnd).toBeLessThan(3)
    })

    test("updates the focused boundary on seek instead of adding one", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [1, 2, 4, 5]) await seek(page, 0, time)

      const firstStart = page
        .locator("#binary-poetry-media-manager .section-start")
        .first()
      await firstStart.focus()
      await seek(page, 0, 1.6)
      await firstStart.blur()
      for (const time of [7, 8]) await seek(page, 0, time)

      expect(await sectionRows(page)).toEqual([
        ["2", "2"],
        ["4", "5"],
        ["7", "8"]
      ])
    })

    test("plays only the marked sections", async ({ page }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [1, 2, 4, 5]) await seek(page, 0, time)

      const fromGap = await playFrom(page, 0, 2.5)
      const fromAfterEnd = await playFrom(page, 0, 5.5)
      const fromInside = await playFrom(page, 0, 1.2)

      expect(fromGap, "skips the gap to the next start").toBeGreaterThanOrEqual(
        4
      )
      expect(fromGap).toBeLessThan(5)
      expect(
        fromAfterEnd,
        "jumps back to the first start"
      ).toBeGreaterThanOrEqual(1)
      expect(fromAfterEnd).toBeLessThan(2)
      expect(fromInside, "keeps playing inside a section").toBeGreaterThan(1.2)
      expect(fromInside).toBeLessThan(2.5)
      expect(await sectionRows(page), "playback marks nothing").toHaveLength(2)
    })

    test("deletes a section", async ({ page }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [1, 2, 4, 5, 7, 8]) await seek(page, 0, time)

      await page
        .locator("#binary-poetry-media-manager .section-delete")
        .nth(1)
        .click()
      const fromDeletedSection = await playFrom(page, 0, 4.2)

      expect(await sectionRows(page)).toEqual([
        ["1", "2"],
        ["7", "8"]
      ])
      expect(
        fromDeletedSection,
        "skips the deleted section"
      ).toBeGreaterThanOrEqual(7)
    })

    test("drags the dialog by where it was grabbed, inside the viewport", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)
      const dialog = page.locator("#binary-poetry-media-manager dialog")
      // The fade-in animation moves the dialog
      await dialog.evaluate(dialog =>
        Promise.all(dialog.getAnimations().map(animation => animation.finished))
      )
      /* Dispatches dragstart 10 px inside the dialog's top-left corner, then
       dragend at (x, y), and returns the dialog's new position. */
      const dragTo = (x: number, y: number) =>
        dialog.evaluate(
          (dialog, [x, y]) => {
            const before = dialog.getBoundingClientRect()
            dialog.dispatchEvent(
              new DragEvent("dragstart", {
                clientX: before.left + 10,
                clientY: before.top + 10
              })
            )
            dialog.dispatchEvent(
              new DragEvent("dragend", { clientX: x, clientY: y })
            )
            const after = dialog.getBoundingClientRect()
            return {
              left: after.left,
              top: after.top,
              maxLeft: document.documentElement.clientWidth - after.width
            }
          },
          [x, y]
        )

      const inside = await dragTo(110, 60)
      const beyond = await dragTo(5000, -20)

      // Event coordinates are whole pixels, the centered start position
      // isn't, so the grab point is off by less than a pixel
      expect(Math.abs(inside.left - 100)).toBeLessThan(1)
      expect(Math.abs(inside.top - 50)).toBeLessThan(1)
      expect(beyond.left).toBe(beyond.maxLeft)
      expect(beyond.top).toBe(0)
    })

    test("saves the sections per URL on close and restores them", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [1, 2, 4, 5]) await seek(page, 0, time)

      await page.getByRole("button", { name: "Close" }).click()
      await expect(page.locator("#binary-poetry-media-manager")).toHaveCount(0)
      const saved = await page.evaluate(() =>
        localStorage.getItem(`media-manager-${location.href}`)
      )
      await runBookmarklet(page)
      const fromGap = await playFrom(page, 0, 2.5)

      expect(JSON.parse(saved ?? "null")).toEqual({
        mediaElementIndex: 0,
        sections: [1, 2, 4, 5]
      })
      expect(await sectionRows(page)).toEqual([
        ["1", "2"],
        ["4", "5"]
      ])
      expect(fromGap, "plays the restored sections").toBeGreaterThanOrEqual(4)
    })

    test("shows no video picker for a single video", async ({ page }) => {
      await openFixture(page, { videos: 1 })

      await runBookmarklet(page)

      const dialog = page.locator("#binary-poetry-media-manager dialog")
      await expect(dialog.locator("th").first()).toBeVisible()
      await expect(dialog).not.toContainText("Video:")
      await expect(dialog.getByRole("combobox")).toHaveCount(0)
    })

    test("highlights the video it controls when it opens", async ({ page }) => {
      await openFixture(page)

      await runBookmarklet(page)

      const highlight = page.locator(
        "body > div:not(#binary-poetry-media-manager)"
      )
      expect(await highlight.boundingBox()).toEqual(
        await page.locator("video").first().boundingBox()
      )
      // The site's amber, see-through
      await expect(highlight).toHaveCSS(
        "background-color",
        "oklch(0.84 0.15 90 / 0.5)"
      )
    })

    test("highlights a newly picked video and plays its sections", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [1, 2, 4, 5]) await seek(page, 0, time)
      const highlight = page.locator(
        "body > div:not(#binary-poetry-media-manager)"
      )

      await page.getByRole("combobox").selectOption("1")
      const secondVideo = await page.locator("video").nth(1).boundingBox()
      const highlighted = await highlight.boundingBox()
      const fromBeforeFirstStart = await playFrom(page, 1, 0.2)

      expect(highlighted).toEqual(secondVideo)
      expect(fromBeforeFirstStart).toBeGreaterThanOrEqual(1)
      expect(fromBeforeFirstStart).toBeLessThan(2)
      await expect(highlight, "fades after 3 s").toHaveCount(0, {
        timeout: 5000
      })
    })

    test("closes when run again, keeping its sections", async ({ page }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [1, 2]) await seek(page, 0, time)

      await runBookmarklet(page)
      await expect(page.locator("#binary-poetry-media-manager")).toHaveCount(0)
      await runBookmarklet(page)

      expect(await sectionRows(page)).toEqual([["1", "2"]])
    })

    test("says so when the page has no video", async ({ page }) => {
      await openFixture(page)
      await runBookmarklet(page)
      const dialog = page.locator("#binary-poetry-media-manager dialog")
      const { width } = (await dialog.boundingBox())!

      await openFixture(page, { videos: 0 })
      await runBookmarklet(page)

      await expect(dialog).toContainText("No video on this page.")
      await expect(dialog.getByRole("combobox")).toHaveCount(0)
      expect((await dialog.boundingBox())!.width, "no collapse").toBe(width)
    })

    test("keeps the saved sections when there is no video", async ({
      page
    }) => {
      await openFixture(page, { videos: 0 })
      const saved = JSON.stringify({ mediaElementIndex: 0, sections: [1, 2] })
      await page.evaluate(
        saved => localStorage.setItem(`media-manager-${location.href}`, saved),
        saved
      )

      await runBookmarklet(page)
      await page.getByRole("button", { name: "Close" }).click()
      await expect(page.locator("#binary-poetry-media-manager")).toHaveCount(0)

      expect(
        await page.evaluate(() =>
          localStorage.getItem(`media-manager-${location.href}`)
        )
      ).toBe(saved)
    })

    for (const [scheme, colors] of Object.entries({
      light: { background: "rgb(255, 255, 255)", text: "rgb(60, 60, 67)" },
      dark: { background: "rgb(27, 27, 31)", text: "rgb(223, 223, 214)" }
    })) {
      test(`uses the site's ${scheme} colors`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme as "light" | "dark" })
        await openFixture(page, { quirks: true })

        await runBookmarklet(page)

        const dialog = page.locator("#binary-poetry-media-manager dialog")
        await expect(dialog).toHaveCSS("background-color", colors.background)
        await expect(dialog.locator("th").first()).toHaveCSS(
          "color",
          colors.text
        )
        await expect(dialog.getByRole("button", { name: "Close" })).toHaveCSS(
          "background-color",
          scheme === "light" ? "oklch(0.84 0.15 90)" : "oklch(0.51 0.15 90)"
        )
      })
    }

    test("stays readable and clickable on a hostile page", async ({ page }) => {
      await openFixture(page, {
        head: `<style>
        body { color: white; font: 40px serif; }
        .cover { position: fixed; inset: 0; z-index: 2147483647; }
      </style>`
      })
      await page.evaluate(() =>
        document.body.append(
          Object.assign(document.createElement("div"), { className: "cover" })
        )
      )
      await runBookmarklet(page)
      const header = page.locator("#binary-poetry-media-manager th").first()

      await expect(header, "no inherited page color").toHaveCSS(
        "color",
        "rgb(60, 60, 67)" // the site's light text color
      )
      await expect(header, "no inherited page font").toHaveCSS(
        "font-size",
        "16px"
      )
      // A covered button fails the click: the dialog must be in the top layer
      await page.getByRole("button", { name: "Close" }).click()
      await expect(page.locator("#binary-poetry-media-manager")).toHaveCount(0)
    })

    test("works under a strict CSP with Trusted Types", async ({ page }) => {
      // The fixtures (auto) fail the test on CSP violations and page errors
      await openFixture(page, {
        csp: "default-src 'none'; media-src data:; require-trusted-types-for 'script'"
      })
      await runBookmarklet(page)
      for (const time of [1, 2]) await seek(page, 0, time)
      await page.getByRole("combobox").selectOption("1")
      await page.getByRole("button", { name: "Close" }).click()

      await expect(page.locator("#binary-poetry-media-manager")).toHaveCount(0)
    })

    test("speaks German with lang: de", async ({ page }) => {
      const { minified } = await compileBookmarklet(entry, { lang: "de" })
      await openFixture(page)

      await page.evaluate(minified)

      const dialog = page.locator("#binary-poetry-media-manager dialog")
      await expect(dialog.getByRole("heading")).toHaveText("Medien-Manager")
      await expect(dialog.locator("th")).toHaveText(["Start", "Ende", ""])
      await expect(dialog).toContainText(
        "Pausiere das Video und spule zu zwei Stellen, um einen Abschnitt zu markieren."
      )
      await expect(
        dialog.getByRole("button", { name: "Schliessen" })
      ).toBeVisible()
      await expect(
        dialog.getByRole("button", { name: "Einstellungen" })
      ).toBeVisible()
    })

    test("releases the previous video after switching", async ({ page }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [1, 2, 4, 5]) await seek(page, 0, time)

      await page.getByRole("combobox").selectOption("1")
      const fromGap = await playFrom(page, 0, 2.5)
      for (const time of [6, 7]) await seek(page, 0, time)

      expect(fromGap, "no longer skips gaps").toBeLessThan(4)
      expect(await sectionRows(page), "no longer marks seeks").toHaveLength(2)
    })

    test("leaves the page's own video handlers in place", async ({ page }) => {
      await openFixture(page)
      await page.evaluate(() => {
        const video = document.querySelector("video")!
        video.onseeked = () => document.body.classList.add("page-saw-seek")
      })
      await runBookmarklet(page)

      await seek(page, 0, 1)

      await expect(page.locator("body")).toHaveClass("page-saw-seek")
    })

    test("drops the previous run's sections after close and rerun", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [1, 2, 4, 5]) await seek(page, 0, time)
      await page.getByRole("button", { name: "Close" }).click()
      await expect(page.locator("#binary-poetry-media-manager")).toHaveCount(0)

      await runBookmarklet(page)
      const deleteButtons = page.locator(
        "#binary-poetry-media-manager .section-delete"
      )
      await deleteButtons.nth(1).click()
      await deleteButtons.nth(0).click()
      const fromGap = await playFrom(page, 0, 2.5)

      expect(fromGap, "the old sections no longer apply").toBeLessThan(4)
    })

    /* Runs `action` 300 ms into the current fade and returns the dialog's
       top right before it and one frame after it. */
    const topAroundAction = (page: Page, action: string) =>
      page.evaluate(async action => {
        const dialog = () =>
          document
            .getElementById("binary-poetry-media-manager")!
            .shadowRoot!.querySelector("dialog")!
        await new Promise(resolve => setTimeout(resolve, 300))
        const before = dialog().getBoundingClientRect().top
        ;(0, eval)(action)
        await new Promise(requestAnimationFrame)
        return { before, after: dialog().getBoundingClientRect().top }
      }, action)
    const clickClose = `document.getElementById("binary-poetry-media-manager").shadowRoot.querySelector(".close").click()`

    test("opens with a gap to the viewport's top edge", async ({ page }) => {
      await openFixture(page)
      await runBookmarklet(page)
      const dialog = page.locator("#binary-poetry-media-manager dialog")
      await dialog.evaluate(dialog =>
        Promise.all(dialog.getAnimations().map(animation => animation.finished))
      )

      const top = await dialog.evaluate(
        dialog => dialog.getBoundingClientRect().top
      )

      expect(top, "the top border isn't flush with the edge").toBe(8)
    })

    test("closes during the fade-in from where the dialog is", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)

      const { before, after } = await topAroundAction(page, clickClose)

      expect(Math.abs(after - before), "no jump").toBeLessThan(10)
    })

    test("cancels closing from where the dialog is", async ({ page }) => {
      await openFixture(page)
      await runBookmarklet(page)
      await page.waitForTimeout(1100) // fully faded in
      await page.getByRole("button", { name: "Close" }).click()

      const { before, after } = await topAroundAction(page, bookmarklet)

      expect(Math.abs(after - before), "no jump").toBeLessThan(10)
    })

    test("cancels closing when run again during the fade-out", async ({
      page
    }) => {
      await openFixture(page)
      await runBookmarklet(page)
      for (const time of [1, 2]) await seek(page, 0, time)

      await page.getByRole("button", { name: "Close" }).click()
      await runBookmarklet(page)
      await page.waitForTimeout(1500) // longer than the 1 s fade-out
      for (const time of [4, 5]) await seek(page, 0, time)

      await expect(
        page.locator("#binary-poetry-media-manager dialog")
      ).toBeVisible()
      expect(await sectionRows(page)).toEqual([
        ["1", "2"],
        ["4", "5"]
      ])
    })

    test.describe("settings", () => {
      test("speak the chosen language, starting with the running one", async ({
        page
      }) => {
        const { minified } = await compileBookmarklet(entry, { lang: "de" })
        await openFixture(page)
        await page.evaluate(minified)
        const dialog = page.locator("#binary-poetry-media-manager dialog")

        await dialog.getByRole("button", { name: "Einstellungen" }).click()
        const language = dialog.getByLabel("Sprache")
        await expect(language).toHaveValue("de")
        // Each language in its own, so it can be found in any
        await expect(language.getByRole("option")).toHaveText([
          "English",
          "Deutsch"
        ])
        await expect(dialog.getByRole("link")).toHaveText("Medien-Manager")

        await language.focus()
        await language.selectOption("en")

        // Relabeled, not rebuilt: a keyboard user stays on the select
        await expect(dialog.getByLabel("Language")).toBeFocused()
        await expect(dialog).toContainText(
          "Drag this link into your bookmarks bar"
        )
        await expect(dialog.getByRole("link")).toHaveText("Media manager")
      })

      test("drags the link out of a Trusted Types page, without moving the dialog", async ({
        page
      }) => {
        await openFixture(page, {
          csp: "require-trusted-types-for 'script'; script-src 'none'"
        })
        await runBookmarklet(page)
        const dialog = page.locator("#binary-poetry-media-manager dialog")
        await dialog.getByRole("button", { name: "Settings" }).click()
        // The bookmarks bar can't be automated: a drop zone on the page gets
        // the same drag data
        await page.evaluate(() => {
          const zone = document.createElement("div")
          zone.id = "drop-zone"
          zone.style.cssText =
            "position: fixed; bottom: 0; width: 100%; height: 50px"
          zone.addEventListener("dragover", event => event.preventDefault())
          zone.addEventListener("drop", event => {
            event.preventDefault()
            zone.dataset.dropped = event.dataTransfer!.getData("text/plain")
          })
          document.body.append(zone)
        })
        const link = dialog.getByRole("link")
        await dialog.evaluate(dialog =>
          Promise.all(
            dialog.getAnimations().map(animation => animation.finished)
          )
        )
        const box = await dialog.boundingBox()

        await link.dragTo(page.locator("#drop-zone"))

        await expect(page.locator("#drop-zone")).toHaveAttribute(
          "data-dropped",
          (await link.getAttribute("href"))!
        )
        expect(await dialog.boundingBox()).toEqual(box)
      })

      test("doesn't run the link on click", async ({ page }) => {
        await openFixture(page)
        await runBookmarklet(page)
        const dialog = page.locator("#binary-poetry-media-manager dialog")
        await dialog.getByRole("button", { name: "Settings" }).click()

        await dialog.getByRole("link").click()
        await page.waitForTimeout(1500) // longer than the 1 s fade-out

        // Running it would toggle the dialog closed
        await expect(dialog).toBeVisible()
      })

      test("offers a link to the build with the chosen options", async ({
        page
      }) => {
        await openFixture(page)
        await runBookmarklet(page)
        const dialog = page.locator("#binary-poetry-media-manager dialog")

        await dialog.getByRole("button", { name: "Settings" }).click()
        await dialog.getByLabel("Language").selectOption("de")

        // The same link the site builds for these options
        const german = await compileBookmarklet(entry, { lang: "de" })
        await expect(dialog.getByRole("link")).toHaveAttribute(
          "href",
          german.href
        )
      })
    })
  })
}
