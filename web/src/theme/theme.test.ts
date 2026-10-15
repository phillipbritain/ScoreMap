import { describe, expect, it } from 'vitest'
import builtIn from './builtInTheme.json'
import { resolveTheme, type Theme } from './theme'

/** A theme's JSON to change in a test: the built-in theme's, so it has every setting. */
function themeJson(): Record<string, any> {
  return structuredClone(builtIn)
}

function resolved(json: unknown): Theme {
  const result = resolveTheme(json)
  if (!result.ok) throw new Error(result.problems.join('\n'))
  return result.theme
}

/** A step of the theme's colours, with these colours too, as a colour job naming it resolves to. */
function step(colors: unknown, name: string): string {
  const json = themeJson()
  json.colors = { ...json.colors, ...(colors as object) }
  json.components.Globe.surface = name
  return resolved(json).components.Globe.surface
}

/**
 * A colour's lightness, chroma and hue (in degrees) in OKLCH, measured here independently of the
 * theme's own maths (Björn Ottosson's OKLab, from linear sRGB). Checked against known values below.
 */
function oklch(hex: string): { l: number; c: number; h: number } {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lab = {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
  return { l: lab.l, c: Math.hypot(lab.a, lab.b), h: ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360 }
}

describe('oklch, the tests’ measure', () => {
  it('measures known colours as the CSS Color 4 spec gives them', () => {
    const red = oklch('#ff0000')
    expect(red.l).toBeCloseTo(0.628, 3)
    expect(red.c).toBeCloseTo(0.2577, 3)
    expect(red.h).toBeCloseTo(29.23, 1)
    expect(oklch('#ffffff').l).toBeCloseTo(1, 3)
  })
})

const steps = ['100', '200', '300', '400', '500', '600', '700', '800', '900']

describe('resolveTheme', () => {
  it("works out a colour's steps, lighter one way and darker the other, keeping its hue", () => {
    const navy = { navy: { base: '#2b4d7d' } }
    expect(step(navy, 'navy.500')).toBe('#2b4d7d')
    const looks = steps.map((name) => oklch(step(navy, `navy.${name}`)))
    for (let i = 1; i < looks.length; i++) expect(looks[i].l, steps[i]).toBeLessThan(looks[i - 1].l - 0.05)
    const hue = oklch('#2b4d7d').h
    for (const [i, look] of looks.entries()) expect(Math.abs(look.h - hue), steps[i]).toBeLessThan(3)
  })

  it('replaces a worked-out step with a hand-set one, and only that one', () => {
    const workedOut = { navy: { base: '#2b4d7d' } }
    const handSet = { navy: { base: '#2b4d7d', steps: { '800': '#0a1020' } } }
    expect(step(handSet, 'navy.800')).toBe('#0a1020')
    for (const name of steps.filter((s) => s !== '800')) {
      expect(step(handSet, `navy.${name}`), name).toBe(step(workedOut, `navy.${name}`))
    }
  })

  it('resolves a colour job from a step name, in any of the theme’s colours', () => {
    const colors = { navy: { base: '#2b4d7d' }, gold: { base: '#d4ac63' } }
    expect(step(colors, 'gold.500')).toBe('#d4ac63')
    expect(step(colors, 'navy.500')).toBe('#2b4d7d')
  })

  it('resolves a colour job outside the palette from one of the palette’s colours, as the palette has it', () => {
    const json = themeJson()
    json.palette.primary.dark = 'navy.800'
    json.palette.divider = '#123456'
    json.components.Globe.surface = 'primary.dark'
    json.components.ScoreCard.fill = 'divider'
    json.components.Pin.live.core.color = 'background.paper'
    const theme = resolved(json)
    expect(theme.palette.primary.dark).toBe(step({}, 'navy.800'))
    expect(theme.components.Globe.surface).toBe(theme.palette.primary.dark)
    expect(theme.components.ScoreCard.fill).toBe('#123456')
    expect(theme.components.Pin.live.core.color).toBe(theme.palette.background.paper)
  })

  it('rejects a palette colour naming another of the palette’s, or a colour named as one of the palette’s are, but only there', () => {
    const json = themeJson()
    json.colors.primary = { base: '#2b4d7d' }
    json.palette.secondary.main = 'primary.main'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'colors.primary is named as one of the palette’s colours are, so a colour job naming it would be unclear',
        'palette.secondary.main names "primary.main", a colour the theme doesn’t have',
      ],
    })
  })

  it('resolves a colour job from a colour given directly', () => {
    const json = themeJson()
    json.components.Globe.surface = '#123456'
    json.components.Globe.coastlines.color = 'rgba(255, 255, 255, 0.7)'
    const theme = resolved(json)
    expect(theme.components.Globe.surface).toBe('#123456')
    expect(theme.components.Globe.coastlines.color).toBe('rgba(255, 255, 255, 0.7)')
  })

  it('takes transparent as a colour given directly, for a shadow or glow that isn’t there', () => {
    const json = themeJson()
    json.components.GamePanel.shadow.color = 'transparent'
    expect(resolved(json).components.GamePanel.shadow.color).toBe('transparent')
  })

  it('takes a colour given directly in any form both CSS and MapLibre read', () => {
    const forms = ['#abc', '#abcd', '#a1b2c3', '#A1B2C3D4', 'rgb(1, 2, 3)', 'rgba(1, 2, 3, 0.5)', 'rgb(10% 20% 30% / 50%)', 'hsl(210 40% 30%)', 'hsla(210deg, 40%, 30%, .5)']
    for (const form of forms) {
      const json = themeJson()
      json.components.Globe.surface = form
      expect(resolveTheme(json), form).toMatchObject({ ok: true, theme: { components: { Globe: { surface: form } } } })
    }
  })

  it('rejects a colour given directly that isn’t well formed', () => {
    const json = themeJson()
    json.components.Globe.surface = '#12'
    json.components.Globe.halo.inner.color = 'foo('
    json.components.Globe.halo.outer.color = 'rgb(1, 2)'
    json.components.ScoreCard.fill = '#12345'
    json.components.ScoreCard.text = 'rgb(1, 2%, 3)'
    json.palette.divider = 7
    const why = 'not a colour CSS and MapLibre both read (#rgb, #rgba, #rrggbb, #rrggbbaa, rgb(…), rgba(…), hsl(…), hsla(…) or transparent)'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'palette.divider is 7, not a colour job: a colour’s step such as "navy.700", or a colour',
        `components.Globe.surface is "#12", ${why}`,
        `components.Globe.halo.inner.color is "foo(", ${why}`,
        `components.Globe.halo.outer.color is "rgb(1, 2)", ${why}`,
        `components.ScoreCard.fill is "#12345", ${why}`,
        `components.ScoreCard.text is "rgb(1, 2%, 3)", ${why}`,
      ],
    })
  })

  it('rejects a theme that isn’t an object of its parts, rather than failing', () => {
    const parts = 'colors, palette, typography, spacing, shape, components'
    for (const json of [null, undefined, 'dark', 42, []]) {
      expect(resolveTheme(json), JSON.stringify(json)).toEqual({
        ok: false,
        problems: [`a theme is ${JSON.stringify(json) ?? 'undefined'}, not an object with ${parts}`],
      })
    }
    expect(resolveTheme({ ...themeJson(), components: 'dark' })).toEqual({
      ok: false,
      problems: ['components is "dark", not a group of settings'],
    })
    const colourless = resolveTheme({ ...themeJson(), colors: null })
    expect(!colourless.ok && colourless.problems[0]).toBe('colors is null, not colours by name')
  })

  it('rejects one of the theme’s colours or a group of settings that isn’t an object', () => {
    const json = themeJson()
    json.colors.teal = '#008080'
    json.components.Globe.halo = '#ffffff'
    json.palette.text = null
    const result = resolveTheme(json)
    expect(!result.ok && result.problems).toEqual([
      'colors.teal is "#008080", not a colour with a base',
      'palette.text is null, not a group of settings',
      'components.Globe.halo is "#ffffff", not a group of settings',
    ])
  })

  it('rejects settings the theme doesn’t know, alongside every other problem', () => {
    const json = themeJson()
    json.mode = 'dark'
    json.colors.navy.shade = 'deep'
    json.components.Globe.surfce = 'navy.500'
    json.typography.h1 = { fontWeight: 300, fontSize: 96, letterSpacing: 0 }
    json.components.GamePanel.shadow.spread = 4
    json.palette.divider = 'navy.950'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'mode isn’t part of a theme: a theme has colors, palette, typography, spacing, shape, components',
        'colors.navy.shade isn’t part of a colour: it has a base and steps',
        'palette.divider names "navy.950", a colour the theme doesn’t have',
        'typography.h1 isn’t a setting a theme has',
        'components.Globe.surfce isn’t a setting a theme has',
        'components.GamePanel.shadow.spread isn’t a setting a theme has',
      ],
    })
  })

  it('has no capital look: national capitals are named in the city look', () => {
    const json = themeJson()
    json.components.PlaceNames.capital = { ...json.components.PlaceNames.city }
    expect(resolveTheme(json)).toEqual({ ok: false, problems: ['components.PlaceNames.capital isn’t a setting a theme has'] })
  })

  it('rejects a colour job naming a colour the theme doesn’t have', () => {
    const json = themeJson()
    json.colors.navy = { base: '#2b4d7d' }
    json.components.Globe.surface = 'navy.950'
    json.components.Globe.halo.inner.color = 'teal.500'
    json.components.Globe.halo.outer.color = 'primary.darker'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'components.Globe.surface names "navy.950", a colour the theme doesn’t have',
        'components.Globe.halo.inner.color names "teal.500", a colour the theme doesn’t have',
        'components.Globe.halo.outer.color names "primary.darker", a colour the theme doesn’t have',
      ],
    })
  })

  it('gives globe text a font of the map’s font server, with the CSS family and weight to measure it by', () => {
    const json = themeJson()
    json.components.PlaceNames.city.font = 'Open Sans Semibold'
    json.components.PlaceNames.state.font = 'Metropolis Light Italic'
    const theme = resolved(json)
    expect(theme.components.PlaceNames.city.font).toEqual({ name: 'Open Sans Semibold', family: 'Open Sans', weight: 600, style: 'normal' })
    expect(theme.components.PlaceNames.state.font).toEqual({ name: 'Metropolis Light Italic', family: 'Metropolis', weight: 300, style: 'italic' })
  })

  it('rejects a globe font the map’s font server doesn’t have', () => {
    const json = themeJson()
    json.components.PlaceNames.city.font = 'Comic Sans Regular'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: ['components.PlaceNames.city.font is "Comic Sans Regular", a font fonts.openmaptiles.org doesn’t have (ADR-0006)'],
    })
  })

  it('lists every problem a theme has, not just the first', () => {
    const json = themeJson()
    delete json.components.Globe.stateLines
    json.components.Globe.surface = 'navy.950'
    json.components.PlaceNames.country.font = 'Roboto Regular'
    const result = resolveTheme(json)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.problems).toEqual([
      expect.stringMatching(/^components\.Globe\.surface names "navy\.950"/),
      'components.Globe.stateLines is missing',
      expect.stringMatching(/^components\.PlaceNames\.country\.font is "Roboto Regular"/),
    ])
  })

  it('rejects one of the theme’s colours that isn’t a #rrggbb colour, or a hand-set step it doesn’t have', () => {
    const json = themeJson()
    json.colors.teal = { base: 'teal' }
    json.colors.sand = { base: '#d4ac63', steps: { '950': '#000000', '800': 'dark' } }
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'colors.teal.base is "teal", not a #rrggbb colour',
        'colors.sand.steps.800 is "dark", not a #rrggbb colour',
        'colors.sand.steps.950 isn’t a step: steps are 100 to 900',
      ],
    })
  })

  it('rejects a size that isn’t a number of pixels, or an opacity that isn’t from 0 to 1', () => {
    const json = themeJson()
    json.components.Pin.live.glow.radius = '15px'
    json.components.Pin.final.core.ring = -1
    json.components.Pin.upcoming.glow.opacity = 1.5
    json.components.Cluster.glowOpacity = 'half'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'components.Pin.live.glow.radius is "15px", not a number of pixels',
        'components.Pin.upcoming.glow.opacity is 1.5, not an opacity from 0 to 1',
        'components.Pin.final.core.ring is -1, not a number of pixels',
        'components.Cluster.glowOpacity is "half", not an opacity from 0 to 1',
      ],
    })
  })

  it('rejects a shadow without its colour or with an offset that isn’t a number', () => {
    const json = themeJson()
    json.components.GamePanel.shadow = { x: 0, y: '8px', blur: 30 }
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: ['components.GamePanel.shadow.y is "8px", not a number of pixels', 'components.GamePanel.shadow.color is missing'],
    })
  })

  it('rejects a text size that isn’t a type style, or a spacing or corner that isn’t a number of its unit', () => {
    const json = themeJson()
    json.components.Cluster.count.size = 'h1'
    json.components.PlaceNames.city.size = { '4': 'caption', '11': 12 }
    json.components.GamePanel.cutCorner.size = 'xl'
    json.components.ScoreCard.corner = 'huge'
    const styles = 'h6, subtitle1, subtitle2, body1, body2, button, caption, overline, footnote'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        `components.PlaceNames.city.size.11 is 12, not a type style (${styles})`,
        `components.Cluster.count.size is "h1", not a type style (${styles})`,
        'components.ScoreCard.corner is "huge", not a number of corner radii (shape.borderRadius) or "pill"',
        'components.GamePanel.cutCorner.size is "xl", not a number of spacing units',
      ],
    })
  })

  it('rejects a type style, spacing unit or corner radius that isn’t a number of pixels', () => {
    const json = themeJson()
    json.typography.body2.fontSize = '13px'
    delete json.typography.caption.letterSpacing
    json.spacing = '4px'
    json.shape.borderRadius = -2
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'typography.body2.fontSize is "13px", not a number of pixels',
        'typography.caption.letterSpacing is missing',
        'spacing is "4px", not a number of pixels',
        'shape.borderRadius is -2, not a number of pixels',
      ],
    })
  })

  it('gives a text size its type style’s size, a spacing its units in pixels and a corner its radii in pixels', () => {
    const json = themeJson()
    json.typography.h6.fontSize = 22
    json.spacing = 5
    json.shape.borderRadius = 3
    json.components.Cluster.count.size = 'h6'
    json.components.PlaceNames.country.size = { '1': 'h6', '4.5': 'h6' }
    json.components.GamePanel.cutCorner.size = 2.5
    json.components.Menu.corner = 2
    json.components.Controls.corner = 'pill'
    const theme = resolved(json)
    expect(theme.components.Cluster.count.size).toBe(22)
    expect(theme.components.PlaceNames.country.size).toEqual({ '1': 22, '4.5': 22 })
    expect(theme.components.GamePanel.cutCorner.size).toBe(12.5)
    expect(theme.components.Menu.corner).toBe(6)
    expect(theme.components.Controls.corner).toBe(999)
  })

  it('rejects text on the globe sized at no zoom level, or at one that isn’t a number', () => {
    const json = themeJson()
    json.components.PlaceNames.city.size = {}
    json.components.PlaceNames.state.size = { far: 'footnote' }
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'components.PlaceNames.city.size gives no zoom levels: it needs a text size at one zoom level at least',
        'components.PlaceNames.state.size.far isn’t a zoom level',
      ],
    })
  })

  it('rejects a dash pattern, a size in ems or a halo’s share of the globe that isn’t one', () => {
    const json = themeJson()
    json.components.Globe.disputedBorders.dash = [2]
    json.components.Globe.halo.inner.blur = { share: '12%', max: 60 }
    json.typography.overline.letterSpacing = '0.14em'
    json.components.GamePanel.size.scoreWidth = -1
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'typography.overline.letterSpacing is "0.14em", not a number of ems',
        'components.Globe.disputedBorders.dash is [2], not a dash pattern: dash and gap lengths in line widths, such as [2, 2]',
        'components.Globe.halo.inner.blur.share is "12%", not a share of the globe’s radius, such as 0.12',
        'components.GamePanel.size.scoreWidth is -1, not a number of ems',
      ],
    })
  })

  it('rejects a theme missing a setting', () => {
    const json = themeJson()
    delete json.components.Globe.coastlines
    delete json.components.Globe.halo
    delete json.palette.warning
    delete json.components.ScoreCard.logo
    delete json.components.GamePanel.logo.plate
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'palette.warning is missing',
        'components.Globe.coastlines is missing',
        'components.Globe.halo is missing',
        'components.ScoreCard.logo is missing',
        'components.GamePanel.logo.plate is missing',
      ],
    })
  })
  it('rejects a theme without a glass’s frost, or with one past opaque', () => {
    const json = themeJson()
    delete json.components.ScoreCard.frost
    json.components.Rail.frost = 1.5
    expect(resolveTheme(json)).toEqual({ ok: false, problems: ['components.ScoreCard.frost is missing', 'components.Rail.frost is 1.5, not a frost from 0 (clear glass) to 1 (opaque frosted glass)'] })
  })
  it('rejects a theme without its hover settings', () => {
    const json = themeJson()
    delete json.components.Hover.card.solid
    delete json.components.Hover.venue
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: ['components.Hover.card.solid is missing', 'components.Hover.venue is missing'],
    })
  })
})

describe('the built-in theme', () => {
  it('resolves without problems', () => {
    expect(resolveTheme(builtIn)).toMatchObject({ ok: true })
  })
})
