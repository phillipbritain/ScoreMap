/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { gameLayers } from './globe/gameLayers'
import { globeStyle } from './globe/globeStyle'
import { builtInTheme } from './theme/builtInTheme'
import type { Theme } from './theme/theme'

/*
 * Every colour, size and opacity in ScoreMap comes from the theme (docs/style-guide.md). The page's
 * CSS has its own check (indexCss.test.ts); these check the web app's TypeScript outside the theme
 * module, and the globe's map layers. What may stay in code is the style guide's "What stays in
 * code" list, and nothing else.
 */

/** What the style guide lets stay in code, read from its "What stays in code" list. */
interface StillInCode {
  /** Values allowed by name, each written in the list as a code span `name: value`, such as `circle-blur: 1`. */
  values: ReadonlySet<string>
  /** Whether icons' drawings are, in their own `viewBox`'s units. */
  iconDrawings: boolean
}

function stillInCode(styleGuide: string): StillInCode {
  const section = styleGuide.split(/^### What stays in code$/m)[1]?.split(/^#{1,3} /m)[0] ?? ''
  const spans = [...section.matchAll(/`([^`]+)`/g)].map(([, span]) => span)
  return { values: new Set(spans.filter((span) => /^[-a-zA-Z]+: \S+$/.test(span))), iconDrawings: spans.includes('viewBox') }
}

const allowed = stillInCode(readFileSync(new URL('../../docs/style-guide.md', import.meta.url), 'utf8'))

const allows = (still: StillInCode, name: string, value: unknown) => still.values.has(`${name}: ${String(value)}`)

/** An opacity of 1 or 0 only shows or hides a thing. */
const showsOrHides = (name: string, value: number) => /opacity/i.test(name) && (value === 0 || value === 1)

/** A colour written out: #rgb to #rrggbbaa, or a colour function such as rgb(…). */
const colourWithin = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
/** A colour keyword, as the whole of a string. `transparent` is no colour. */
const colourKeyword = /^\s*(white|black|gr[ae]y|silver|red|orange|yellow|gold|green|blue|navy|purple|pink)\s*$/i
const isColour = (text: string) => colourWithin.test(text) || colourKeyword.test(text)

/** A size written out in pixels or ems, such as 12px or 0.14em. */
const writtenSize = /(^|[^\w.])\d*\.?\d+(px|em|rem|ex|ch)\b/

/** Markup attributes that size, place or fade what they're on. */
const lookAttribute =
  /^(width|height|(min|max)(Width|Height)|x|y|cx|cy|r|rx|ry|strokeWidth|fontSize|letterSpacing|(fill|stroke|stop)?[oO]pacity)$/

/** Inline style properties that take a number without being a size: stacking and flex. */
const unsizedStyle = /^(zIndex|order|flex|flexGrow|flexShrink)$/

/**
 * The look values written into a TypeScript file: colours anywhere in its strings, sizes in pixels
 * or ems anywhere in its strings, and numbers sizing or fading things in markup attributes and
 * inline styles. Each as "file:line text".
 */
function lookValuesWritten(file: string, source: string, still: StillInCode): string[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const code = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
  const found: string[] = []
  const report = (node: ts.Node) =>
    found.push(`${file}:${code.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${node.getText().replace(/\s+/g, ' ')}`)

  /** A literal number, or a string that's only a number, as written; undefined if anything else. */
  const numberIn = (node: ts.Node | undefined): number | undefined => {
    if (!node) return undefined
    if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node)) return numberIn(node.expression)
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
      const n = numberIn(node.operand)
      return n === undefined ? undefined : -n
    }
    if (ts.isStringLiteral(node) && /^\s*-?\d*\.?\d+\s*$/.test(node.text)) return Number(node.text)
    return undefined
  }
  const checkNumber = (node: ts.Node, name: string, value: ts.Node | undefined) => {
    const n = numberIn(value)
    if (n !== undefined && !showsOrHides(name, n) && !allows(still, name, n)) report(node)
  }
  const checkAttribute = (attribute: ts.JsxAttributeLike) => {
    if (!ts.isJsxAttribute(attribute)) return
    const name = attribute.name.getText()
    if (lookAttribute.test(name)) checkNumber(attribute, name, attribute.initializer)
    const style = attribute.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined
    if (name === 'style' && style && ts.isObjectLiteralExpression(style)) checkStyle(style)
  }
  const checkStyle = (style: ts.ObjectLiteralExpression) => {
    for (const property of style.properties) {
      if (!ts.isPropertyAssignment(property)) continue
      const name = property.name.getText().replace(/['"]/g, '')
      if (!unsizedStyle.test(name)) checkNumber(property, name, property.initializer)
    }
  }
  const isStyle = (node: ts.Node) => ts.isPropertyAccessExpression(node) && node.name.text === 'style'
  /** An <svg> drawn in its own units: everything inside it is its drawing, which the CSS sizes. */
  const isIcon = (tag: ts.JsxOpeningLikeElement) =>
    tag.tagName.getText() === 'svg' && tag.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText() === 'viewBox')

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (isColour(node.text) || writtenSize.test(node.text)) report(node)
    } else if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (still.iconDrawings && isIcon(node)) {
        // How big the icon is on the page is still the theme's.
        for (const a of node.attributes.properties) if (ts.isJsxAttribute(a) && /^(width|height)$/.test(a.name.getText())) checkAttribute(a)
        return
      }
      node.attributes.properties.forEach(checkAttribute)
      node.attributes.properties.forEach((a) => ts.forEachChild(a, visit))
      return
    } else if (ts.isJsxElement(node) && still.iconDrawings && isIcon(node.openingElement)) {
      visit(node.openingElement)
      return
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      // element.style.opacity = '0.5'
      if (ts.isPropertyAccessExpression(node.left) && isStyle(node.left.expression) && !unsizedStyle.test(node.left.name.text)) {
        checkNumber(node, node.left.name.text, node.right)
      }
    } else if (ts.isCallExpression(node) && node.expression.getText() === 'Object.assign') {
      // Object.assign(element.style, { … })
      const [target, ...styles] = node.arguments
      if (target && isStyle(target)) for (const style of styles) if (ts.isObjectLiteralExpression(style)) checkStyle(style)
    }
    ts.forEachChild(node, visit)
  }
  visit(code)
  return found
}

const nothingStill: StillInCode = { values: new Set(), iconDrawings: false }

describe('the style guide’s “What stays in code” list', () => {
  it('is found, and read', () => {
    expect(allowed.values.size + Number(allowed.iconDrawings)).toBeGreaterThan(0)
  })

  it('allows values by name, and icons’ drawings', () => {
    const guide = [
      '### What stays in code',
      '- a glow that fades out all the way (`circle-blur: 1`) and icons (`viewBox`), as in `cardLayout.ts`;',
      '## Next',
      '- `line-width: 3`',
    ].join('\n')
    expect(stillInCode(guide)).toEqual({ values: new Set(['circle-blur: 1']), iconDrawings: true })
  })
})

describe('the look values written into TypeScript', () => {
  const written = (source: string, still = nothingStill) => lookValuesWritten('Example.tsx', source, still)

  it('finds a colour in a string, but not transparent', () => {
    expect(written(`const a = '#d4ac63'; const b = \`0 0 \${blur} #000e28\`; const d = 'rgba(0, 0, 0, 0.5)'`)).toHaveLength(3)
    expect(written(`el.style.color = 'gold'`)).toEqual(["Example.tsx:1 'gold'"])
    expect(written(`const a = 'transparent'; const b = 'Gold Cup final'; const c = 'currentColor'`)).toEqual([])
  })

  it('finds a size in pixels or ems written into a string, but not one worked out', () => {
    expect(written(`const a = '12px'; const b = '0 0 0.14em'; const c = \`\${x} 2px\``)).toHaveLength(3)
    expect(written('const a = `${size}px`; const b = `${width * 2}px ${height}em`')).toEqual([])
  })

  it('finds a size in a markup attribute', () => {
    expect(written(`<img src={url} alt="" width={28} height="28" />`)).toEqual([
      'Example.tsx:1 width={28}',
      'Example.tsx:1 height="28"',
    ])
    expect(written(`<img src={url} alt="" className="game-panel__logo" />`)).toEqual([])
  })

  it('finds a size or an opacity in an inline style, but not stacking, a show or a hide', () => {
    expect(written(`<div style={{ width: 28, opacity: 0.5, zIndex: 3 }} />`)).toEqual([
      'Example.tsx:1 width: 28',
      'Example.tsx:1 opacity: 0.5',
    ])
    expect(written(`el.style.opacity = '0.6'; el.style.opacity = '1'; el.style.zIndex = '4'`)).toEqual([
      "Example.tsx:1 el.style.opacity = '0.6'",
    ])
    expect(written(`Object.assign(el.style, { opacity: 0.3, width: \`\${w}px\` })`)).toEqual(['Example.tsx:1 opacity: 0.3'])
  })

  it('leaves an icon’s drawing to it, once the style guide allows it, but not its size on the page', () => {
    const icon = `<svg viewBox="0 0 16 16" strokeWidth="2"><rect x="3.5" y="2.5" width="3" height="11" rx="1" /></svg>`
    expect(written(icon)).toHaveLength(6)
    expect(written(icon, { values: new Set(), iconDrawings: true })).toEqual([])
    expect(written(`<svg viewBox="0 0 16 16" width={16} />`, { values: new Set(), iconDrawings: true })).toEqual([
      'Example.tsx:1 width={16}',
    ])
  })

  it('leaves a value the style guide allows by name', () => {
    expect(written(`<div style={{ opacity: 0.5 }} />`, { values: new Set(['opacity: 0.5']), iconDrawings: false })).toEqual([])
  })
})

/** The web app's own TypeScript, outside the theme module and the tests, by its path from src. */
function webAppTypeScript(): { file: string; source: string }[] {
  const src = new URL('./', import.meta.url)
  return readdirSync(src, { recursive: true, encoding: 'utf8' })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.startsWith('theme/'))
    .map((file) => ({ file, source: readFileSync(new URL(file, src), 'utf8') }))
}

describe('the web app’s TypeScript, outside the theme module', () => {
  it('writes no colour, and no size or opacity into markup or inline styles, but what the style guide leaves in code', () => {
    const files = webAppTypeScript()
    expect(files.length).toBeGreaterThan(0)
    expect(files.flatMap(({ file, source }) => lookValuesWritten(file, source, allowed))).toEqual([])
  })
})

/*
 * Map layers write sizes as bare numbers, so they can't be told from any other number by looking.
 * Instead the layers are built twice, with the built-in theme and with one where every number and
 * colour is different: a look value in a layer's paint or layout that comes out the same both times
 * didn't come from the theme.
 */

/** A layer's paint and layout properties that are part of its look. */
const lookProperty = /-(color|width|radius|size|blur|opacity|dasharray|letter-spacing)$/

/** The theme with every number and colour in it changed, each differently. */
function everyValueChanged(theme: Theme): Theme {
  let changes = 0
  const changed = (value: unknown): unknown => {
    if (typeof value === 'number') return value * 1.5 + ++changes / 100
    if (typeof value === 'string' && /^(#|rgb|hsl|transparent$)/.test(value)) return `#${(++changes).toString(16).padStart(6, '0')}`
    if (Array.isArray(value)) return value.map(changed)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, changed(v)]))
    return value
  }
  return changed(theme) as Theme
}

/**
 * Which arguments of an expression are its structure (its input, the zoom levels it steps or
 * interpolates at, what it matches, its conditions) rather than its outputs.
 */
function isStructure(expression: readonly unknown[], index: number): boolean {
  const last = expression.length - 1
  switch (expression[0]) {
    case 'interpolate':
      return index <= 2 || index % 2 === 1
    case 'step':
      return index === 1 || (index >= 3 && index % 2 === 1)
    case 'match':
      return index === 1 || (index < last && index % 2 === 0)
    case 'case':
      return index < last && index % 2 === 1
    default:
      return index === 0
  }
}

/**
 * The look values in a layer's paint or layout that are the same however the theme changes: written
 * into code, not taken from the theme. Each as "layer property: value".
 */
function valuesNotFromTheme(built: readonly LayerSpecification[], rebuilt: readonly LayerSpecification[], still: StillInCode): string[] {
  const found: string[] = []
  const compare = (where: string, property: string, a: unknown, b: unknown) => {
    if (Array.isArray(a) && Array.isArray(b)) {
      const expression = typeof a[0] === 'string'
      a.forEach((item, i) => (expression && isStructure(a, i) ? undefined : compare(where, property, item, b[i])))
    } else if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const [key, item] of Object.entries(a)) compare(where, property, item, (b as Record<string, unknown>)[key])
    } else if (a === b && (typeof a === 'number' || (typeof a === 'string' && isColour(a)))) {
      if (typeof a === 'number' && showsOrHides(property, a)) return
      if (!allows(still, property, a)) found.push(`${where} ${property}: ${JSON.stringify(a)}`)
    }
  }
  built.forEach((layer, i) => {
    const again = rebuilt[i] as Record<string, unknown>
    for (const part of ['paint', 'layout'] as const) {
      const properties = (layer as Record<string, unknown>)[part] as Record<string, unknown> | undefined
      const againProperties = again[part] as Record<string, unknown> | undefined
      for (const [property, value] of Object.entries(properties ?? {})) {
        if (lookProperty.test(property)) compare(layer.id, property, value, againProperties?.[property])
      }
    }
  })
  return found
}

/** The base style's layers the globe keeps, as the base style gives them (with none of their look). */
const tiles = { source: 'openmaptiles' } as const
const base: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'https://example.test' } },
  layers: [
    { id: 'boundary_3', type: 'line', ...tiles, 'source-layer': 'boundary' },
    { id: 'boundary_2', type: 'line', ...tiles, 'source-layer': 'boundary' },
    { id: 'boundary_disputed', type: 'line', ...tiles, 'source-layer': 'boundary' },
    { id: 'label_city', type: 'symbol', ...tiles, 'source-layer': 'place', filter: ['==', ['get', 'class'], 'city'] },
    { id: 'label_town', type: 'symbol', ...tiles, 'source-layer': 'place' },
    { id: 'label_state', type: 'symbol', ...tiles, 'source-layer': 'place' },
    { id: 'label_city_capital', type: 'symbol', ...tiles, 'source-layer': 'place' },
    { id: 'label_country_1', type: 'symbol', ...tiles, 'source-layer': 'place' },
  ],
}

/** Every layer the globe draws: its style's, then the games'. */
function globeLayers(theme: Theme): LayerSpecification[] {
  const games = gameLayers(theme, 'game-1')
  return [...globeStyle(base, theme).layers, ...games.belowNames, ...games.onTop]
}

describe('the look values not from the theme in map layers', () => {
  const circle = (paint: Record<string, unknown>): LayerSpecification[] => [
    { id: 'pins', type: 'circle', source: 'pins', paint } as LayerSpecification,
  ]

  it('finds a value that stays the same as the theme changes, in an expression’s outputs or a list', () => {
    const built = circle({ 'circle-radius': ['match', ['get', 'status'], 'live', 4, 'final', 3, 2], 'circle-blur': 0.4 })
    const rebuilt = circle({ 'circle-radius': ['match', ['get', 'status'], 'live', 6, 'final', 3, 2], 'circle-blur': 0.4 })
    expect(valuesNotFromTheme(built, rebuilt, nothingStill)).toEqual([
      'pins circle-radius: 3',
      'pins circle-radius: 2',
      'pins circle-blur: 0.4',
    ])
    expect(valuesNotFromTheme(circle({ 'circle-color': '#ffffff' }), circle({ 'circle-color': '#ffffff' }), nothingStill)).toEqual([
      'pins circle-color: "#ffffff"',
    ])
  })

  it('leaves an expression’s structure, a show or a hide, transparent, what isn’t look, and what the style guide allows', () => {
    const paint = {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 8, 1.2],
      'circle-opacity': 0,
      'circle-color': 'transparent',
      'circle-sort-key': 3,
      'circle-blur': 1,
    }
    const changed = { ...paint, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 0.8, 8, 1.9] }
    expect(valuesNotFromTheme(circle(paint), circle(changed), nothingStill)).toEqual(['pins circle-blur: 1'])
    expect(valuesNotFromTheme(circle(paint), circle(changed), { values: new Set(['circle-blur: 1']), iconDrawings: false })).toEqual([])
  })
})

describe('the globe’s map layers', () => {
  it('take every colour, width, radius, size, blur and opacity from the theme, but what the style guide leaves in code', () => {
    const built = globeLayers(builtInTheme)
    const rebuilt = globeLayers(everyValueChanged(builtInTheme))
    expect(rebuilt.map((layer) => layer.id)).toEqual(built.map((layer) => layer.id))
    expect(valuesNotFromTheme(built, rebuilt, allowed)).toEqual([])
  })
})
