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

/** A palette's step, as a colour job naming it resolves to. */
function step(palette: unknown, name: string): string {
  const json = themeJson()
  json.palette = { ...json.palette, ...(palette as object) }
  json.settings.globe.surface = name
  return resolved(json).globe.surface
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
  it("works out a palette colour's steps, lighter one way and darker the other, keeping its hue", () => {
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

  it('resolves a colour job from a step name, in any of the palette’s colours', () => {
    const palette = { navy: { base: '#2b4d7d' }, gold: { base: '#d4ac63' } }
    expect(step(palette, 'gold.500')).toBe('#d4ac63')
    expect(step(palette, 'navy.500')).toBe('#2b4d7d')
  })

  it('resolves a colour job from a colour given directly', () => {
    const json = themeJson()
    json.settings.globe.surface = '#123456'
    json.settings.globe.coastlines.color = 'rgba(255, 255, 255, 0.7)'
    const theme = resolved(json)
    expect(theme.globe.surface).toBe('#123456')
    expect(theme.globe.coastlines.color).toBe('rgba(255, 255, 255, 0.7)')
  })

  it('takes transparent as a colour given directly, for a shadow or glow that isn’t there', () => {
    const json = themeJson()
    json.settings.panel.shadow.color = 'transparent'
    expect(resolved(json).panel.shadow.color).toBe('transparent')
  })

  it('takes a colour given directly in any form both CSS and MapLibre read', () => {
    const forms = ['#abc', '#abcd', '#a1b2c3', '#A1B2C3D4', 'rgb(1, 2, 3)', 'rgba(1, 2, 3, 0.5)', 'rgb(10% 20% 30% / 50%)', 'hsl(210 40% 30%)', 'hsla(210deg, 40%, 30%, .5)']
    for (const form of forms) {
      const json = themeJson()
      json.settings.globe.surface = form
      expect(resolveTheme(json), form).toMatchObject({ ok: true, theme: { globe: { surface: form } } })
    }
  })

  it('rejects a colour given directly that isn’t well formed', () => {
    const json = themeJson()
    json.settings.globe.surface = '#12'
    json.settings.globe.halo.inner.color = 'foo('
    json.settings.globe.halo.outer.color = 'rgb(1, 2)'
    json.settings.card.fill = '#12345'
    json.settings.card.text = 'rgb(1, 2%, 3)'
    json.settings.divider = 7
    const why = 'not a colour CSS and MapLibre both read (#rgb, #rgba, #rrggbb, #rrggbbaa, rgb(…), rgba(…), hsl(…), hsla(…) or transparent)'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        `settings.globe.surface is "#12", ${why}`,
        `settings.globe.halo.inner.color is "foo(", ${why}`,
        `settings.globe.halo.outer.color is "rgb(1, 2)", ${why}`,
        'settings.divider is 7, not a colour job: a palette step such as "navy.700", or a colour',
        `settings.card.fill is "#12345", ${why}`,
        `settings.card.text is "rgb(1, 2%, 3)", ${why}`,
      ],
    })
  })

  it('rejects a theme that isn’t an object with a palette and settings, rather than failing', () => {
    for (const json of [null, undefined, 'dark', 42, []]) {
      expect(resolveTheme(json), JSON.stringify(json)).toEqual({
        ok: false,
        problems: [`a theme is ${JSON.stringify(json) ?? 'undefined'}, not an object with a palette and settings`],
      })
    }
    expect(resolveTheme({ palette: null, settings: 'dark' })).toEqual({
      ok: false,
      problems: ['palette is null, not colours by name', 'settings is "dark", not a group of settings'],
    })
  })

  it('rejects a palette colour or a group of settings that isn’t an object', () => {
    const json = themeJson()
    json.palette.teal = '#008080'
    json.settings.globe.halo = '#ffffff'
    json.settings.text = null
    const result = resolveTheme(json)
    expect(!result.ok && result.problems).toEqual([
      'palette.teal is "#008080", not a colour with a base',
      'settings.globe.halo is "#ffffff", not a group of settings',
      'settings.text is null, not a group of settings',
    ])
  })

  it('rejects settings the theme doesn’t know, alongside every other problem', () => {
    const json = themeJson()
    json.mode = 'dark'
    json.palette.navy.shade = 'deep'
    json.settings.globe.surfce = 'navy.500'
    json.settings.textSizes.xxl = 24
    json.settings.panel.shadow.spread = 4
    json.settings.divider = 'navy.950'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'mode isn’t part of a theme: a theme has a palette and settings',
        'palette.navy.shade isn’t part of a palette colour: it has a base and steps',
        'settings.textSizes.xxl isn’t a setting a theme has',
        'settings.globe.surfce isn’t a setting a theme has',
        'settings.divider names "navy.950", a step the palette doesn’t have',
        'settings.panel.shadow.spread isn’t a setting a theme has',
      ],
    })
  })

  it('rejects a colour job naming a step the palette doesn’t have', () => {
    const json = themeJson()
    json.palette.navy = { base: '#2b4d7d' }
    json.settings.globe.surface = 'navy.950'
    json.settings.globe.halo.inner.color = 'teal.500'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'settings.globe.surface names "navy.950", a step the palette doesn’t have',
        'settings.globe.halo.inner.color names "teal.500", a step the palette doesn’t have',
      ],
    })
  })

  it('gives globe text a font of the map’s font server, with the CSS family and weight to measure it by', () => {
    const json = themeJson()
    json.settings.placeNames.city.font = 'Open Sans Semibold'
    json.settings.placeNames.state.font = 'Metropolis Light Italic'
    const theme = resolved(json)
    expect(theme.placeNames.city.font).toEqual({ name: 'Open Sans Semibold', family: 'Open Sans', weight: 600, style: 'normal' })
    expect(theme.placeNames.state.font).toEqual({ name: 'Metropolis Light Italic', family: 'Metropolis', weight: 300, style: 'italic' })
  })

  it('rejects a globe font the map’s font server doesn’t have', () => {
    const json = themeJson()
    json.settings.placeNames.city.font = 'Comic Sans Regular'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: ['settings.placeNames.city.font is "Comic Sans Regular", a font fonts.openmaptiles.org doesn’t have (ADR-0006)'],
    })
  })

  it('lists every problem a theme has, not just the first', () => {
    const json = themeJson()
    delete json.settings.globe.stateLines
    json.settings.globe.surface = 'navy.950'
    json.settings.placeNames.country.font = 'Roboto Regular'
    const result = resolveTheme(json)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.problems).toEqual([
      expect.stringMatching(/^settings\.globe\.surface names "navy\.950"/),
      'settings.globe.stateLines is missing',
      expect.stringMatching(/^settings\.placeNames\.country\.font is "Roboto Regular"/),
    ])
  })

  it('rejects a palette colour that isn’t a #rrggbb colour, or a hand-set step the palette doesn’t have', () => {
    const json = themeJson()
    json.palette.teal = { base: 'teal' }
    json.palette.sand = { base: '#d4ac63', steps: { '950': '#000000', '800': 'dark' } }
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'palette.teal.base is "teal", not a #rrggbb colour',
        'palette.sand.steps.800 is "dark", not a #rrggbb colour',
        'palette.sand.steps.950 isn’t a step: steps are 100 to 900',
      ],
    })
  })

  it('rejects a size that isn’t a number of pixels, or an opacity that isn’t from 0 to 1', () => {
    const json = themeJson()
    json.settings.status.live.glow.radius = '15px'
    json.settings.status.final.core.ring = -1
    json.settings.status.upcoming.glow.opacity = 1.5
    json.settings.cluster.glowOpacity = 'half'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'settings.status.live.glow.radius is "15px", not a number of pixels',
        'settings.status.upcoming.glow.opacity is 1.5, not an opacity from 0 to 1',
        'settings.status.final.core.ring is -1, not a number of pixels',
        'settings.cluster.glowOpacity is "half", not an opacity from 0 to 1',
      ],
    })
  })

  it('rejects a shadow without its colour or with an offset that isn’t a number', () => {
    const json = themeJson()
    json.settings.panel.shadow = { x: 0, y: '8px', blur: 30 }
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: ['settings.panel.shadow.y is "8px", not a number of pixels', 'settings.panel.shadow.color is missing'],
    })
  })

  it('rejects a text size, spacing or radius that isn’t one of its scale’s steps', () => {
    const json = themeJson()
    json.settings.fonts.clusterCount.size = 'xxl'
    json.settings.placeNames.city.size = { '4': 's', '11': 12 }
    json.settings.cutCorner.size = '5xl'
    json.settings.corners.card = 'huge'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'settings.placeNames.city.size.11 is 12, not a step of the text size scale (xs, s, m, l, xl)',
        'settings.fonts.clusterCount.size is "xxl", not a step of the text size scale (xs, s, m, l, xl)',
        'settings.corners.card is "huge", not a step of the radius scale (xs, s, m, l, pill)',
        'settings.cutCorner.size is "5xl", not a step of the spacing scale (2xs, xs, s, m, l, xl, 2xl, 3xl)',
      ],
    })
  })

  it('rejects a scale whose step isn’t a number of pixels', () => {
    const json = themeJson()
    json.settings.textSizes.m = '13px'
    delete json.settings.spacing['2xl']
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: ['settings.textSizes.m is "13px", not a number of pixels', 'settings.spacing.2xl is missing'],
    })
  })

  it('gives a size, spacing or radius the pixels its scale step holds', () => {
    const json = themeJson()
    json.settings.textSizes.xl = 20
    json.settings.spacing.xl = 18
    json.settings.radii.l = 10
    json.settings.fonts.clusterCount.size = 'xl'
    json.settings.placeNames.country.size = { '1': 'xl', '4.5': 'xl' }
    json.settings.cutCorner.size = 'xl'
    json.settings.corners.menu = 'l'
    const theme = resolved(json)
    expect(theme.fonts.clusterCount.size).toBe(20)
    expect(theme.placeNames.country.size).toEqual({ '1': 20, '4.5': 20 })
    expect(theme.cutCorner.size).toBe(18)
    expect(theme.corners.menu).toBe(10)
  })

  it('rejects text on the globe sized at no zoom level, or at one that isn’t a number', () => {
    const json = themeJson()
    json.settings.placeNames.city.size = {}
    json.settings.placeNames.state.size = { far: 'xs' }
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'settings.placeNames.city.size gives no zoom levels: it needs a text size at one zoom level at least',
        'settings.placeNames.state.size.far isn’t a zoom level',
      ],
    })
  })

  it('rejects a dash pattern, a size in ems or a halo’s share of the globe that isn’t one', () => {
    const json = themeJson()
    json.settings.globe.disputedBorders.dash = [2]
    json.settings.globe.halo.inner.blur = { share: '12%', max: 60 }
    json.settings.letterSpacing.label = '0.14em'
    json.settings.sizes.panel.scoreWidth = -1
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'settings.letterSpacing.label is "0.14em", not a number of ems',
        'settings.globe.disputedBorders.dash is [2], not a dash pattern: dash and gap lengths in line widths, such as [2, 2]',
        'settings.globe.halo.inner.blur.share is "12%", not a share of the globe’s radius, such as 0.12',
        'settings.sizes.panel.scoreWidth is -1, not a number of ems',
      ],
    })
  })

  it('rejects a theme missing a setting', () => {
    const json = themeJson()
    delete json.settings.globe.coastlines
    delete json.settings.globe.halo
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: ['settings.globe.coastlines is missing', 'settings.globe.halo is missing'],
    })
  })
})

describe('the built-in theme', () => {
  it('resolves without problems', () => {
    expect(resolveTheme(builtIn)).toMatchObject({ ok: true })
  })
})
