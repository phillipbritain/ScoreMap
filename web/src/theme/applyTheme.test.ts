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
    expect(properties.get('--status-upcoming-core-radius')).toBe('4.5')
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

  it('writes every setting', () => {
    const properties = propertiesOf(themeWith(() => {}))
    // The globe: a surface, four kinds of line and two halo colours. Four kinds of place name, each
    // with a colour, an outline and a font (its name, family, weight and style). Four statuses, each with
    // a colour, a core of four, a glow of two and a cluster opacity. A cluster's three, and the selection.
    expect(properties.size).toBe(7 + 4 * 6 + 4 * 8 + 3 + 1)
  })
})
