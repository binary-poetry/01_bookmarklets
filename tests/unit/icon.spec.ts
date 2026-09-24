import { inflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { iconDataUrl } from "../../pipeline/icon"

/** Undoes a PNG row filter (none, sub, up, average, Paeth) in place. */
function unfilter(
  line: Buffer,
  above: Buffer,
  channels: number,
  filter: number
) {
  for (let i = 0; i < line.length; i++) {
    const a = i >= channels ? line[i - channels]! : 0
    const b = above[i]!
    const c = i >= channels ? above[i - channels]! : 0
    const p = a + b - c
    const [pa, pb, pc] = [p - a, p - b, p - c].map(Math.abs) as [
      number,
      number,
      number
    ]
    const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
    const predictor = [0, a, b, (a + b) >> 1, paeth][filter]!
    line[i] = (line[i]! + predictor) & 0xff
  }
}

/** Decodes an 8-bit RGB or RGBA PNG into rows of `#rrggbb` pixels. */
function decode(dataUrl: string): Array<Array<string>> {
  const png = Buffer.from(
    dataUrl.replace(/^data:image\/png;base64,/, ""),
    "base64"
  )
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  )
  let width = 0
  let height = 0
  let channels = 0
  const idat: Array<Buffer> = []
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at)
    const type = png.toString("latin1", at + 4, at + 8)
    const data = png.subarray(at + 8, at + 8 + length)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      expect(data[8], "bit depth").toBe(8)
      channels = { 2: 3, 6: 4 }[data[9]!]!
    }
    if (type === "IDAT") idat.push(data)
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const rows: Array<Buffer> = []
  for (let y = 0; y < height; y++) {
    const line = Buffer.from(
      raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    )
    const above = rows[y - 1] ?? Buffer.alloc(stride)
    unfilter(line, above, channels, raw[y * (stride + 1)]!)
    rows.push(line)
  }
  return rows.map(line =>
    Array.from(
      { length: width },
      (_, x) => `#${line.toString("hex", x * channels, x * channels + 3)}`
    )
  )
}

const lit = "#f2cc00"
const unlit = "#151515"

describe("iconDataUrl", () => {
  it("draws the 16x16 grid as a 32x32 PNG, 2x2 pixels per cell", () => {
    const grid = Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => ((x + 2 * y) % 5 ? "." : "#")).join(
        ""
      )
    ).join("\n")

    const pixels = decode(iconDataUrl(grid))

    const cells = grid.split("\n")
    expect(pixels).toEqual(
      Array.from({ length: 32 }, (_, y) =>
        Array.from({ length: 32 }, (_, x) =>
          cells[y >> 1]![x >> 1] === "#" ? lit : unlit
        )
      )
    )
  })
  const blank = Array<string>(16).fill(".".repeat(16))

  it("accepts the file's final newline", () => {
    expect(iconDataUrl(`${blank.join("\n")}\n`)).toBe(
      iconDataUrl(blank.join("\n"))
    )
  })

  it.each([
    ["15 rows", blank.slice(1).join("\n")],
    ["a row of 17", [...blank.slice(1), ".".repeat(17)].join("\n")],
    ["other characters", [...blank.slice(1), "x".repeat(16)].join("\n")]
  ])("rejects a grid with %s", (_, grid) => {
    expect(() => iconDataUrl(grid)).toThrow(
      "An icon is 16 rows of 16 `#` (lit) or `.` (unlit)"
    )
  })
})
