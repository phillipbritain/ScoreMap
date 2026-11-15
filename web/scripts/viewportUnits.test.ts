// Holds web/src off the vh unit: on iOS Safari 100vh is the height with the toolbar hidden, taller than
// the window while it shows, so whatever is sized or placed by it runs off the bottom (see
// docs/style-guide.md, Other sizes). Comments may still name it.
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = join(import.meta.dirname, '../src')

// A number then vh, as a CSS length (`100vh`, `.5vh`), but not dvh, svh, lvh or a name with vh in it.
const vhUnit = /(?<![\w.-])(?:\d+\.?\d*|\.\d+)vh\b/g

// Strings are kept, so a vh in an inline style is found, and only the comments between them dropped.
const tsComments = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
const cssComments = /\/\*[\s\S]*?\*\//g

/** The `line: unit` of each vh unit in a file's code, outside its comments, keeping its line numbers. */
function vhUnits(text: string, kind: 'css' | 'ts'): string[] {
  const blank = (comment: string) => comment.replace(/[^\n]/g, ' ')
  const code =
    kind === 'css'
      ? text.replace(cssComments, blank)
      : text.replace(tsComments, (match, string?: string) => string ?? blank(match))
  return code.split('\n').flatMap((line, i) => [...line.matchAll(vhUnit)].map(([unit]) => `${i + 1}: ${unit}`))
}

describe('viewport units', () => {
  it('finds vh in code but not in comments, nor dvh, svh or lvh', () => {
    const css = '/* 100vh is too tall */\n.a { height: 100vh; max-height: min(70vh, 100dvh); top: 1svh; }'
    expect(vhUnits(css, 'css')).toEqual(['2: 100vh', '2: 70vh'])
    const ts = "// 100vh is too tall\n/* 50vh\n */ const s = { height: '100vh', top: '.5vh' }; const a = 'it\\'s 1lvh'"
    expect(vhUnits(ts, 'ts')).toEqual(['3: 100vh', '3: .5vh'])
  })

  it('web/src uses no vh unit', () => {
    const found = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((file) => ['.css', '.ts', '.tsx'].includes(extname(file)))
      .flatMap((file) => {
        const text = readFileSync(join(src, file), 'utf8')
        return vhUnits(text, extname(file) === '.css' ? 'css' : 'ts').map((at) => `${file}:${at}`)
      })
    expect(
      found,
      'vh is taller than the window on iOS Safari while its toolbar shows: use dvh (the window as it is), ' +
        'svh (the toolbar showing) or lvh (the toolbar hidden) instead',
    ).toEqual([])
  })
})
