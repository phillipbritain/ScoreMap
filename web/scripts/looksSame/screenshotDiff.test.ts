import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { compareScreenshots, readPng } from './screenshotDiff.ts'

type Rgba = [number, number, number, number]

const navy: Rgba = [43, 77, 125, 255]
const gold: Rgba = [212, 172, 99, 255]

/**
 * A PNG of these rows of pixels, written the way a browser might: 8-bit RGBA (or RGB, dropping
 * alpha), each row with the given filter (0 None, 1 Sub, 2 Up, 3 Average, 4 Paeth).
 */
function png(rows: Rgba[][], { filter = 0, alpha = true } = {}): Buffer {
  const channels = alpha ? 4 : 3
  const width = rows[0].length
  const raw = rows.map((row) => Buffer.from(row.flatMap((pixel) => pixel.slice(0, channels))))
  const filtered = raw.map((row, y) => {
    const above = y > 0 ? raw[y - 1] : Buffer.alloc(row.length)
    const out = Buffer.alloc(row.length + 1)
    out[0] = filter
    for (let i = 0; i < row.length; i++) {
      const left = i >= channels ? row[i - channels] : 0
      const up = above[i]
      const upLeft = i >= channels ? above[i - channels] : 0
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter]
      out[i + 1] = (row[i] - predicted) & 0xff
    }
    return out
  })
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(rows.length, 4)
  header[8] = 8
  header[9] = alpha ? 6 : 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(filtered))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

// PNG readers here don't check the CRC, so it's left as zero.
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)])
}

/** A width × height image all one colour, but for the pixels given. */
function image(width: number, height: number, colour: Rgba, except: Record<string, Rgba> = {}): Rgba[][] {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => except[`${x},${y}`] ?? colour))
}

describe('compareScreenshots', () => {
  it('finds no difference between the same screenshot taken twice', () => {
    const result = compareScreenshots(png(image(3, 2, navy)), png(image(3, 2, navy)))

    expect(result.differing).toBe(0)
  })

  it('counts each pixel that differs', () => {
    const result = compareScreenshots(
      png(image(3, 2, navy)),
      png(image(3, 2, navy, { '0,0': gold, '2,1': [43, 77, 126, 255] })),
    )

    expect(result.differing).toBe(2)
  })

  it('reads screenshots saved with any row filter, with or without alpha', () => {
    const pixels = image(4, 3, navy, { '1,1': gold, '3,2': [0, 255, 10, 255] })

    for (const filter of [0, 1, 2, 3, 4]) {
      expect(compareScreenshots(png(pixels), png(pixels, { filter, alpha: false })).differing).toBe(0)
      expect(readPng(png(pixels, { filter })).pixels).toEqual(readPng(png(pixels)).pixels)
    }
  })

  it('marks where they differ in red on the diff image, and dims the rest', () => {
    const { diff } = compareScreenshots(png(image(2, 1, navy)), png(image(2, 1, navy, { '1,0': gold })))

    const { width, height, pixels } = readPng(diff)
    expect([width, height]).toEqual([2, 1])
    expect([...pixels.subarray(4, 8)]).toEqual([255, 0, 0, 255])
    const [r, g, b] = pixels.subarray(0, 4)
    expect(r === g && g === b).toBe(true)
  })

  it('counts every pixel as differing when the sizes differ', () => {
    const result = compareScreenshots(png(image(3, 2, navy)), png(image(2, 2, navy)))

    expect(result.differing).toBe(6)
    expect(result.sizes).toEqual(['3×2', '2×2'])
  })
})
