// Compares two screenshots pixel by pixel, in plain Node: PNGs are read and written with zlib, so
// the check needs no image package.
import { crc32, deflateSync, inflateSync } from 'node:zlib'

/** An image as 8-bit RGBA, row after row. */
export interface Image {
  width: number
  height: number
  pixels: Uint8Array
}

export interface ScreenshotComparison {
  /** How many pixels differ: every one of the larger, if the sizes differ. */
  differing: number
  /** Where they differ in red, over the second screenshot greyed and dimmed, as a PNG. */
  diff: Buffer
  /** Each screenshot's width × height, where they differ. */
  sizes?: [string, string]
}

/** Compares two PNG screenshots; any change at all to a pixel counts. */
export function compareScreenshots(first: Buffer, second: Buffer): ScreenshotComparison {
  const a = readPng(first)
  const b = readPng(second)
  if (a.width !== b.width || a.height !== b.height) {
    return {
      differing: Math.max(a.width * a.height, b.width * b.height),
      diff: writePng(b),
      sizes: [`${a.width}×${a.height}`, `${b.width}×${b.height}`],
    }
  }
  const diff = new Uint8Array(b.pixels.length)
  let differing = 0
  for (let i = 0; i < diff.length; i += 4) {
    const same =
      a.pixels[i] === b.pixels[i] &&
      a.pixels[i + 1] === b.pixels[i + 1] &&
      a.pixels[i + 2] === b.pixels[i + 2] &&
      a.pixels[i + 3] === b.pixels[i + 3]
    if (same) {
      const grey = Math.round((b.pixels[i] * 0.3 + b.pixels[i + 1] * 0.59 + b.pixels[i + 2] * 0.11) * 0.4)
      diff.set([grey, grey, grey, 255], i)
    } else {
      differing++
      diff.set([255, 0, 0, 255], i)
    }
  }
  return { differing, diff: writePng({ width: b.width, height: b.height, pixels: diff }) }
}

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Reads an 8-bit, non-interlaced RGB or RGBA PNG, as browsers save screenshots. */
export function readPng(file: Buffer): Image {
  if (!file.subarray(0, 8).equals(signature)) throw new Error('Not a PNG')
  let width = 0
  let height = 0
  let channels = 0
  const data: Buffer[] = []
  for (let at = 8; at < file.length; ) {
    const length = file.readUInt32BE(at)
    const type = file.toString('ascii', at + 4, at + 8)
    const body = file.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      const [depth, colourType, , , interlace] = body.subarray(8)
      channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 0
      if (depth !== 8 || !channels || interlace) {
        throw new Error(`Can't read a PNG of bit depth ${depth}, colour type ${colourType}, interlace ${interlace}`)
      }
    } else if (type === 'IDAT') data.push(body)
    else if (type === 'IEND') break
    at += length + 12
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * channels
  const rows = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const row = y * stride
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? rows[row + i - channels] : 0
      const up = y > 0 ? rows[row - stride + i] : 0
      const upLeft = y > 0 && i >= channels ? rows[row - stride + i - channels] : 0
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter]
      rows[row + i] = (line[i] + predicted) & 0xff
    }
  }
  if (channels === 4) return { width, height, pixels: rows }
  const pixels = new Uint8Array(width * height * 4)
  for (let p = 0; p < width * height; p++) pixels.set([rows[p * 3], rows[p * 3 + 1], rows[p * 3 + 2], 255], p * 4)
  return { width, height, pixels }
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft
  const toLeft = Math.abs(p - left)
  const toUp = Math.abs(p - up)
  const toUpLeft = Math.abs(p - upLeft)
  return toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft
}

/** Writes an RGBA PNG, every row unfiltered. */
export function writePng({ width, height, pixels }: Image): Buffer {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}
