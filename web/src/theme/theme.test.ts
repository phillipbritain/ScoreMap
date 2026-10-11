import { describe, expect, it } from 'vitest'
import builtIn from './builtInTheme.json'
import { globeFonts } from './globeFonts'
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
    json.settings.globe.coastlines = 'rgba(255, 255, 255, 0.7)'
    const theme = resolved(json)
    expect(theme.globe.surface).toBe('#123456')
    expect(theme.globe.coastlines).toBe('rgba(255, 255, 255, 0.7)')
  })

  it('rejects a colour job naming a step the palette doesn’t have', () => {
    const json = themeJson()
    json.palette.navy = { base: '#2b4d7d' }
    json.settings.globe.surface = 'navy.950'
    json.settings.globe.halo.inner = 'teal.500'
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'settings.globe.surface names "navy.950", a step the palette doesn’t have',
        'settings.globe.halo.inner names "teal.500", a step the palette doesn’t have',
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
    json.palette.gold = { base: '#d4ac63', steps: { '950': '#000000', '800': 'dark' } }
    expect(resolveTheme(json)).toEqual({
      ok: false,
      problems: [
        'palette.teal.base is "teal", not a #rrggbb colour',
        'palette.gold.steps.800 is "dark", not a #rrggbb colour',
        'palette.gold.steps.950 isn’t a step: steps are 100 to 900',
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

  it('draws the globe and its place names in today’s colours', () => {
    const { globe, placeNames } = resolved(builtIn)
    expect(globe).toEqual({
      surface: '#0b1526',
      coastlines: 'rgba(255, 255, 255, 0.7)',
      countryBorders: 'rgba(255, 255, 255, 0.7)',
      stateLines: 'rgba(255, 255, 255, 0.3)',
      disputedBorders: 'rgba(255, 255, 255, 0.5)',
      halo: { inner: 'rgb(110 168 255 / 0.55)', outer: 'rgb(60 120 255 / 0.25)' },
    })
    const look = (kind: keyof typeof placeNames) => {
      const { size: _size, ...colours } = placeNames[kind]
      return { ...colours, font: placeNames[kind].font.name }
    }
    expect(look('city')).toEqual({ color: '#f1e6cc', outline: '#050b16', font: 'Open Sans Semibold' })
    expect(look('capital')).toEqual({ color: '#fff4dc', outline: '#050b16', font: 'Open Sans Bold' })
    expect(look('state')).toEqual({ color: '#9a8a62', outline: '#050b16', font: 'Open Sans Regular' })
    expect(look('country')).toEqual({ color: '#d8c9a4', outline: '#050b16', font: 'Open Sans Bold' })
  })

  it('draws pins, clusters and the selection in today’s look', () => {
    const { status, cluster, selection } = resolved(builtIn)
    expect(status).toEqual({
      live: {
        color: '#e4572e',
        core: { color: '#ffd9c8', radius: 3.5, opacity: 1, ring: 1.5 },
        glow: { radius: 15, opacity: 0.7 },
        clusterOpacity: 1,
      },
      upcoming: {
        color: '#f2a541',
        core: { color: '#f2a541', radius: 3, opacity: 0.8, ring: 0 },
        glow: { radius: 10, opacity: 0.45 },
        clusterOpacity: 0.85,
      },
      final: {
        color: '#8a8f98',
        core: { color: '#8a8f98', radius: 2.5, opacity: 0.55, ring: 0 },
        glow: { radius: 7, opacity: 0.25 },
        clusterOpacity: 0.6,
      },
      disrupted: {
        color: '#c3c6cc',
        core: { color: '#c3c6cc', radius: 2.5, opacity: 0.6, ring: 0 },
        glow: { radius: 7, opacity: 0.25 },
        clusterOpacity: 0.6,
      },
    })
    expect(cluster).toEqual({ fill: 'rgba(6, 12, 24, 0.88)', outlineWidth: 1.5, glowOpacity: 0.45 })
    expect(selection).toBe('#2f80ed')
  })

  it('colours the page, its score cards, panels, menus and controls in today’s colours', () => {
    const { page, text, divider, hover, controls, card, panel, settingsMenu } = resolved(builtIn)
    expect(page).toEqual({
      background: '#0b1020',
      sky: '#03050c',
      stars: { white: '#ffffff', cool: 'rgb(200 220 255)', warm: 'rgb(255 240 220)' },
    })
    expect(text).toEqual({ main: '#ffffff', secondary: 'rgb(255 255 255 / 0.55)', accent: '#d8c9a4', link: '#8fc1ff' })
    expect(divider).toBe('rgba(255, 255, 255, 0.1)')
    expect(hover).toBe('rgba(255, 255, 255, 0.12)')
    expect(controls).toEqual({
      surface: 'rgba(11, 16, 32, 0.85)',
      shadow: 'rgba(0, 0, 0, 0.3)',
      on: { fill: '#ffffff', text: '#0b1020' },
    })
    expect(card).toEqual({
      fill: 'rgb(6 12 24 / 0.85)',
      text: '#d9f0ff',
      disrupted: { fill: 'rgb(12 14 20 / 0.85)', text: '#8b93a3' },
      shadow: 'rgb(0 0 0 / 0.45)',
    })
    expect(panel).toEqual({
      surface: { top: 'rgb(18 28 56 / 0.98)', bottom: 'rgb(8 12 26 / 0.98)' },
      scoreBlock: { top: '#1d2d55', bottom: '#121c38' },
      score: { fill: '#ffffff', text: '#0b1020' },
      unofficial: 'rgb(255 255 255 / 0.45)',
      photo: 'rgb(42 62 112 / 0.5)',
      credit: { fill: 'rgb(0 0 0 / 0.6)', text: 'rgb(255 255 255 / 0.75)' },
      close: 'rgb(0 0 0 / 0.55)',
      shadow: 'rgb(0 0 0 / 0.6)',
    })
    expect(settingsMenu).toEqual({
      surface: '#0b1020',
      shadow: 'rgba(0, 0, 0, 0.4)',
      gearOutline: '#050b16',
      tab: 'rgba(255, 255, 255, 0.6)',
      count: 'rgba(255, 255, 255, 0.5)',
      hint: 'rgba(255, 255, 255, 0.4)',
      chip: { outline: 'rgba(216, 201, 164, 0.45)', badge: 'rgba(216, 201, 164, 0.15)' },
      on: { fill: '#d8c9a4', text: '#0b1020' },
    })
  })

  it('writes text in today’s fonts: the system font on the page (but the browser’s Arial on its buttons), monospace on score cards, Open Sans on the globe', () => {
    const { fonts, placeNames } = resolved(builtIn)
    const system = 'system-ui, sans-serif'
    const mono = "ui-monospace, 'Cascadia Mono', Consolas, monospace"
    expect(fonts).toEqual({
      body: { family: system, weight: 400 },
      heading: { family: system, weight: 800 },
      team: { family: system, weight: 700 },
      score: { family: system, weight: 800 },
      tab: { family: 'Arial', weight: 600 },
      button: { family: 'Arial', weight: 400 },
      scenarioPill: { family: system, weight: 600 },
      scenarioClock: { family: system, weight: 400 },
      card: { clock: { family: mono, weight: 400 }, team: { family: mono, weight: 600 }, score: { family: mono, weight: 700 } },
      clusterCount: { font: globeFonts.get('Open Sans Bold'), size: 11 },
    })
    expect(placeNames.city.font.family).toBe('Open Sans')
  })

  it('holds scales close to today’s sizes, spacing and corners, with the game panel’s corner cut', () => {
    const { textSizes, spacing, radii, corners, cutCorner, placeNames } = resolved(builtIn)
    expect(textSizes).toEqual({ xs: 10, s: 11, m: 13, l: 15, xl: 18 })
    expect(spacing).toEqual({ '2xs': 2, xs: 4, s: 6, m: 8, l: 12, xl: 16, '2xl': 24, '3xl': 32 })
    expect(radii).toEqual({ xs: 3, s: 6, m: 8, l: 12, pill: 999 })
    expect(corners).toEqual({ card: 3, menu: 12, menuItem: 6, message: 8, control: 999 })
    expect(cutCorner).toEqual({ on: true, size: 16 })
    // Today's sizes were 12, 14 and 18 for cities, 12.5, 15 and 19 for capitals, 9 and 13 for states
    // and 9 and 16 for countries.
    expect(placeNames.city.size).toEqual({ '4': 11, '7': 13, '11': 18 })
    expect(placeNames.capital.size).toEqual({ '4': 13, '7': 15, '11': 18 })
    expect(placeNames.state.size).toEqual({ '3': 10, '8': 13 })
    expect(placeNames.country.size).toEqual({ '1': 10, '4': 15 })
  })
})
