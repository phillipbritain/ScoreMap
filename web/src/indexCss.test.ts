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

const valueOf = (declaration: string) => declaration.slice(declaration.indexOf(':') + 1)

/** A colour written out: #rgb or #rrggbb, a colour function such as rgb(…), or a common colour keyword. */
const colour =
  /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(white|black|gr[ae]y|silver|red|orange|yellow|gold|green|blue|navy|purple|pink)\b/i

describe('the page’s CSS', () => {
  it('names no colour of its own, reading every colour from the theme’s custom properties', () => {
    const own = declarations(css)
      // A mask uses only how opaque its colours are, never what colour they are.
      .filter((declaration) => !declaration.startsWith('mask-image'))
      .filter((declaration) => colour.test(valueOf(declaration).replace(/var\(--[-a-z0-9]+\)/g, '')))
    expect(own).toEqual([])
  })
})
