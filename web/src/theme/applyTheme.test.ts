import { describe, expect, it } from 'vitest'
import builtIn from './builtInTheme.json'
import { applyTheme } from './applyTheme'
import { resolveTheme, type Theme } from './theme'

/** The built-in theme, with these changes to its JSON's settings. */
function themeWith(change: (settings: Record<string, any>) => void): Theme {
  const json = structuredClone(builtIn) as Record<string, any>
  change(json.settings)
  const result = resolveTheme(json)
  if (!result.ok) throw new Error(result.problems.join('\n'))
  return result.theme
}

/** The custom properties applyTheme writes to a stand-in for the page's root. */
function propertiesOf(theme: Theme): Map<string, string> {
  const properties = new Map<string, string>()
  applyTheme({ style: { setProperty: (name: string, value: string | null) => properties.set(name, value!) } }, theme)
  return properties
}

describe('applyTheme', () => {
  it('writes each setting of the theme as a custom property, named by where it sits in the settings', () => {
    const properties = propertiesOf(
      themeWith((settings) => {
        settings.globe.surface = '#123456'
        settings.status.live.color = '#ff0000'
        settings.status.upcoming.core.radius = 4.5
        settings.cluster.glowOpacity = 0.3
        settings.selection = '#00ff00'
      }),
    )
    expect(properties.get('--globe-surface')).toBe('#123456')
    expect(properties.get('--status-live-color')).toBe('#ff0000')
    expect(properties.get('--status-upcoming-core-radius')).toBe('4.5px')
    expect(properties.get('--cluster-glow-opacity')).toBe('0.3')
    expect(properties.get('--selection')).toBe('#00ff00')
  })

  it('writes colour jobs as the colours they resolve to', () => {
    const properties = propertiesOf(themeWith((settings) => (settings.placeNames.city.color = 'navy.900')))
    expect(properties.get('--place-names-city-color')).toBe('#050b16')
  })

  it('writes a globe font as its CSS family, weight and style', () => {
    const properties = propertiesOf(themeWith((settings) => (settings.placeNames.state.font = 'Metropolis Light Italic')))
    expect(properties.get('--place-names-state-font-family')).toBe('Metropolis')
    expect(properties.get('--place-names-state-font-weight')).toBe('300')
    expect(properties.get('--place-names-state-font-style')).toBe('italic')
  })

  it('writes the scales’ steps, and the sizes, corners and cut corner that name them, in pixels', () => {
    const properties = propertiesOf(
      themeWith((settings) => {
        settings.textSizes.m = 14
        settings.spacing.l = 10
        settings.radii.s = 5
        settings.corners.menuItem = 's'
        settings.cutCorner = { on: false, size: 'l' }
      }),
    )
    expect(properties.get('--text-sizes-m')).toBe('14px')
    expect(properties.get('--spacing-l')).toBe('10px')
    expect(properties.get('--spacing-2xs')).toBe('2px')
    expect(properties.get('--radii-s')).toBe('5px')
    expect(properties.get('--corners-menu-item')).toBe('5px')
    expect(properties.get('--cut-corner-size')).toBe('10px')
    expect(properties.get('--cut-corner-on')).toBe('0')
  })

  it('writes a page font as its CSS family and weight', () => {
    const properties = propertiesOf(themeWith((settings) => (settings.fonts.card.score = { family: 'Georgia, serif', weight: 500 })))
    expect(properties.get('--fonts-card-score-family')).toBe('Georgia, serif')
    expect(properties.get('--fonts-card-score-weight')).toBe('500')
  })

  it('writes every setting', () => {
    const properties = propertiesOf(themeWith(() => {}))
    // The globe: a surface, four kinds of line and two halo colours. Four kinds of place name, each
    // with a colour, an outline and a font (its name, family, weight and style). Four statuses, each with
    // a colour, a core of four, a glow of two and a cluster opacity. A cluster's three, and the selection.
    // The page's background, sky and three stars; four kinds of text, a divider and hover; the
    // controls' surface, shadow and on (fill and text). A score card's five, the game panel's eleven
    // and the settings menu's eleven colours. Five text sizes, eight spacing steps and five radii;
    // nine page fonts (a family and a weight each) and the cluster count's (a font of four and a
    // size); five corners and the cut corner's two. Place names' sizes are for the globe, not the page.
    expect(properties.size).toBe(
      7 + 4 * 6 + 4 * 8 + 3 + 1 + (5 + 4 + 2 + 4) + 5 + 11 + 11 + (5 + 8 + 5) + (9 * 2 + 5) + (5 + 2),
    )
  })
})
