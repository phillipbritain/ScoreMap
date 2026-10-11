/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Read from the file: Vitest hands CSS imports to tests empty, even ?raw ones.
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

/** The page's CSS declarations, comments left out, each as "property: value". */
function declarations(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/[;{}]/)
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter((part) => /^[-a-z]+ ?:/.test(part))
}

/** The CSS without its @keyframes: motion isn't part of the theme. */
function withoutKeyframes(source: string): string {
  let kept = ''
  let at = 0
  for (let start = source.indexOf('@keyframes'); start !== -1; start = source.indexOf('@keyframes', at)) {
    kept += source.slice(at, start)
    let depth = 0
    let i = source.indexOf('{', start)
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}' && --depth === 0) break
    }
    at = i + 1
  }
  return kept + source.slice(at)
}

const valueOf = (declaration: string) => declaration.slice(declaration.indexOf(':') + 1)

/** A colour written out: #rgb or #rrggbb, a colour function such as rgb(…), or a common colour keyword. */
const colour =
  /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(white|black|gr[ae]y|silver|red|orange|yellow|gold|green|blue|navy|purple|pink)\b/i

const propertyOf = (declaration: string) => declaration.slice(0, declaration.indexOf(':')).trim()
const withoutThemeValues = (declaration: string) => valueOf(declaration).replace(/var\(--[-a-z0-9]+\)/g, '').trim()

/** A length written out, such as 12px or 1.5em, or a percentage. */
const length = /\d*\.?\d+(px|em|rem|ex|ch|pt|vh|vw|vmin|vmax|%)/

describe('the page’s CSS', () => {
  it('writes text only in the theme’s fonts and text sizes', () => {
    const own = declarations(css)
      .filter((declaration) => /^font(-family|-weight|-size)?$/.test(propertyOf(declaration)))
      .filter((declaration) => !['', 'inherit'].includes(withoutThemeValues(declaration)))
    expect(own).toEqual([])
  })

  it('spaces everything with the spacing scale’s steps, and rounds corners only with the theme’s radii', () => {
    const own = declarations(css)
      .filter((declaration) => /^(padding|margin|gap|row-gap|column-gap|border(-[a-z]+)*-radius)/.test(propertyOf(declaration)))
      // Circles stay circles.
      .filter((declaration) => !(propertyOf(declaration) === 'border-radius' && withoutThemeValues(declaration) === '50%'))
      .filter((declaration) => length.test(withoutThemeValues(declaration)))
    expect(own).toEqual([])
  })

  it('sizes nothing in pixels of its own, but in animations and the starfield’s pattern', () => {
    const own = declarations(withoutKeyframes(css))
      // The stars behind the globe are a pattern, drawn to its own sizes.
      .filter((declaration) => !/^background-(image|size)$/.test(propertyOf(declaration)))
      .filter((declaration) => /\d*\.?\d+px/.test(withoutThemeValues(declaration)))
    expect(own).toEqual([])
  })

  it('names no colour of its own, reading every colour from the theme’s custom properties', () => {
    const own = declarations(css)
      // A mask uses only how opaque its colours are, never what colour they are.
      .filter((declaration) => !declaration.startsWith('mask-image'))
      .filter((declaration) => colour.test(valueOf(declaration).replace(/var\(--[-a-z0-9]+\)/g, '')))
    expect(own).toEqual([])
  })
})
