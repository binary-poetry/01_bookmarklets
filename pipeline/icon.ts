// SPDX-License-Identifier: MIT-0

// Node only (`node:zlib`): the website's build turns each bookmarklet's icon
// into a data URL for its bookmarks file.

import { crc32, deflateSync } from "node:zlib"

/** The binary poetry logo's colors: lit and unlit pixels. A lit pixel in
 * the logo is #ffdf00 at 80 % over rgb(192,128,0). */
const lit = [0xf2, 0xcc, 0x00]
const unlit = [0x15, 0x15, 0x15]
/** Pixels per grid cell, so the icon stays sharp on HiDPI screens. */
const scale = 2

/** Draws a 16x16 grid (`#` lit, `.` unlit, one row per line) as a PNG data
 * URL. PNG, because Chrome drops SVG icons on bookmark import. */
export function iconDataUrl(grid: string): string {
  const cells = grid.replace(/\n$/, "").split("\n")
  if (cells.length !== 16 || !cells.every(line => /^[#.]{16}$/.test(line))) {
    throw new Error("An icon is 16 rows of 16 `#` (lit) or `.` (unlit)")
  }
  const row = (line: string) =>
    Buffer.from([
      0, // filter: none
      ...[...line].flatMap(cell =>
        Array<Array<number>>(scale)
          .fill(cell === "#" ? lit : unlit)
          .flat()
      )
    ])
  const pixels = Buffer.concat(
    cells.flatMap(line => Array<Buffer>(scale).fill(row(line)))
  )
  const size = 16 * scale
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // RGB
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0))
  ])
  return `data:image/png;base64,${png.toString("base64")}`
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "latin1"), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}
