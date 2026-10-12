import { Color } from '@maplibre/maplibre-gl-style-spec'

/*
 * What counts as a colour written out, for the tests that hold the page's CSS (indexCss.test.ts)
 * and the web app's TypeScript and map layers (lookInCode.test.ts) to the theme.
 */

/** A colour written out within some text: #rgb to #rrggbbaa, or a colour function such as rgb(…). */
const colourWithin = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i

/** A word that's a CSS colour's name, such as gold or teal. `transparent` and `currentColor` are no colour. */
const isColourName = (word: string) =>
  /^[a-z]+$/i.test(word) && !['transparent', 'currentcolor'].includes(word.toLowerCase()) && Color.parse(word) !== undefined

/** Whether text is a colour: one written out within it, or a colour's name as the whole of it. */
export const isColour = (text: string) => colourWithin.test(text) || isColourName(text.trim())

/**
 * Whether a CSS value names a colour: one written out within it, or a colour's name as any of its
 * words outside quoted text and urls, such as a font's name or an image's file.
 */
export const namesColour = (value: string) =>
  colourWithin.test(value) ||
  value
    .replace(/url\([^)]*\)|"[^"]*"|'[^']*'/g, ' ')
    .split(/[^-a-z]+/i)
    .some(isColourName)
