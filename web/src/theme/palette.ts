/**
 * A theme's colours: named base colours, each worked out into steps from light to dark (see
 * paletteSteps). The theme's palette and colour jobs name a step, such as "navy.700".
 */

/** Each of a theme's colours' steps, lightest first; the base colour is 500. */
export const stepNames = ['100', '200', '300', '400', '500', '600', '700', '800', '900'] as const
export type StepName = (typeof stepNames)[number]
const baseStep = stepNames.indexOf('500')

/**
 * A theme colour's steps, worked out in OKLCH at the base colour's hue: lighter steps go evenly in
 * lightness from the base towards white, darker ones evenly towards black, with the lightest and
 * darkest a fifth of the way short of them. Each keeps the base colour's chroma, or as much of it as
 * sRGB can show at that lightness, so its hue doesn't drift. Hand-set steps replace worked-out ones.
 */
export function paletteSteps(base: string, handSet: Partial<Record<StepName, string>> = {}): Record<StepName, string> {
  const { l, c, h } = toOklch(hexToRgb(base))
  const towardsEnds = stepNames.length - baseStep
  return Object.fromEntries(
    stepNames.map((name, i) => {
      if (handSet[name] !== undefined) return [name, handSet[name].toLowerCase()]
      if (i === baseStep) return [name, base.toLowerCase()]
      const lightness = i < baseStep ? l + ((1 - l) * (baseStep - i)) / towardsEnds : l * (1 - (i - baseStep) / towardsEnds)
      return [name, rgbToHex(inGamut(lightness, c, h))]
    }),
  ) as Record<StepName, string>
}

type Rgb = [number, number, number]

/** Whether a value is a colour as palettes give them: #rrggbb. */
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

/** A #rrggbb colour's sRGB channels, from 0 to 1. */
function hexToRgb(hex: string): Rgb {
  if (!isHexColor(hex)) throw new Error(`"${hex}" isn't a #rrggbb colour`)
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb
}

function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const fromLinear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)

/**
 * How far apart two #rrggbb colours stand in lightness, as WCAG's contrast ratio: from 1 (the same) to
 * 21 (black and white).
 */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

/** WCAG's relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Björn Ottosson's OKLab, from linear sRGB and back.
function toOklch(rgb: Rgb): { l: number; c: number; h: number } {
  const [r, g, b] = rgb.map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, c: Math.hypot(a, bb), h: Math.atan2(bb, a) }
}

/** A colour in OKLCH (hue in radians) as sRGB channels, which fall outside 0 to 1 (or are NaN) where sRGB can't show it. */
function fromOklch(lightness: number, chroma: number, hue: number): Rgb {
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => fromLinear(v)) as Rgb
}

const shows = (rgb: Rgb) => rgb.every((v) => v >= 0 && v <= 1)

/** The colour at this lightness and hue with as much of this chroma as sRGB can show. */
function inGamut(lightness: number, chroma: number, hue: number): Rgb {
  if (shows(fromOklch(lightness, chroma, hue))) return fromOklch(lightness, chroma, hue)
  let [low, high] = [0, chroma]
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2
    if (shows(fromOklch(lightness, mid, hue))) low = mid
    else high = mid
  }
  return fromOklch(lightness, low, hue)
}
