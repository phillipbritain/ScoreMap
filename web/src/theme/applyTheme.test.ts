import { describe, expect, it } from 'vitest'
import builtIn from './builtInTheme.json'
import { applyTheme } from './applyTheme'
import { resolveTheme, type Theme } from './theme'

/** The built-in theme, with these changes to its JSON. */
function themeWith(change: (json: Record<string, any>) => void): Theme {
  const json = structuredClone(builtIn) as Record<string, any>
  change(json)
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
  it('writes each setting of the theme as a custom property, named by where it sits in the theme, a component’s by the component', () => {
    const properties = propertiesOf(
      themeWith((json) => {
        json.palette.text.primary = '#eeeeee'
        json.components.Globe.surface = '#123456'
        json.palette.live.main = '#ff0000'
        json.components.Pin.upcoming.core.radius = 4.5
        json.components.Cluster.glowOpacity = 0.3
        json.components.ScoreCard.header.tint = 0.4
        json.components.Selection = { color: '#00ff00', width: 3 }
      }),
    )
    expect(properties.get('--palette-text-primary')).toBe('#eeeeee')
    expect(properties.get('--globe-surface')).toBe('#123456')
    expect(properties.get('--palette-live-main')).toBe('#ff0000')
    expect(properties.get('--pin-upcoming-core-radius')).toBe('4.5px')
    expect(properties.get('--cluster-glow-opacity')).toBe('0.3')
    expect(properties.get('--score-card-header-tint')).toBe('0.4')
    expect(properties.get('--selection-color')).toBe('#00ff00')
    expect(properties.get('--selection-width')).toBe('3px')
  })

  it('writes colour jobs as the colours they resolve to, through the palette or not', () => {
    const properties = propertiesOf(
      themeWith((json) => {
        json.palette.primary.dark = 'navy.900'
        json.components.PlaceNames.city.color = 'navy.900'
        json.components.ScoreCard.fill = 'primary.dark'
      }),
    )
    expect(properties.get('--palette-primary-dark')).toBe('#000209')
    expect(properties.get('--place-names-city-color')).toBe('#000209')
    expect(properties.get('--score-card-fill')).toBe('#000209')
  })

  it('writes a globe font as its CSS family, weight and style', () => {
    const properties = propertiesOf(themeWith((json) => (json.components.PlaceNames.state.font = 'Metropolis Light Italic')))
    expect(properties.get('--place-names-state-font-family')).toBe('Metropolis')
    expect(properties.get('--place-names-state-font-weight')).toBe('300')
    expect(properties.get('--place-names-state-font-style')).toBe('italic')
  })

  it('writes the spacing unit, and the corners and cut corner that are a number of their units, in pixels', () => {
    const properties = propertiesOf(
      themeWith((json) => {
        json.spacing = 5
        json.shape.borderRadius = 3
        json.components.MenuItem.corner = 2
        json.components.Controls.corner = 'pill'
        json.components.GamePanel.cutCorner = { on: false, size: 3 }
      }),
    )
    expect(properties.get('--spacing')).toBe('5px')
    expect(properties.get('--shape-border-radius')).toBe('3px')
    expect(properties.get('--menu-item-corner')).toBe('6px')
    expect(properties.get('--controls-corner')).toBe('999px')
    expect(properties.get('--game-panel-cut-corner-size')).toBe('15px')
    expect(properties.get('--game-panel-cut-corner-on')).toBe('0')
  })

  it('writes the score card’s and the trail’s see-through switch as 1 or 0, with its opacity', () => {
    const properties = propertiesOf(
      themeWith((json) => {
        json.components.ScoreCard.seeThrough = { on: true, opacity: 0.6 }
        json.components.Trail.seeThrough = { on: false, opacity: 0.5 }
      }),
    )
    expect(properties.get('--score-card-see-through-on')).toBe('1')
    expect(properties.get('--score-card-see-through-opacity')).toBe('0.6')
    expect(properties.get('--trail-see-through-on')).toBe('0')
    expect(properties.get('--trail-see-through-opacity')).toBe('0.5')
  })

  it('writes the hovered card’s border width, and whether it turns solid as 1 or 0', () => {
    const properties = propertiesOf(themeWith((json) => (json.components.Hover.card = { borderWidth: 3, solid: false })))
    expect(properties.get('--hover-card-border-width')).toBe('3px')
    expect(properties.get('--hover-card-solid')).toBe('0')
  })

  it('writes the typography as its font family and each type style’s weight, size in pixels and letter spacing in ems', () => {
    const properties = propertiesOf(
      themeWith((json) => {
        json.typography.fontFamily = 'Georgia, serif'
        json.typography.h6 = { fontWeight: 500, fontSize: 22, letterSpacing: 0.02 }
      }),
    )
    expect(properties.get('--typography-font-family')).toBe('Georgia, serif')
    expect(properties.get('--typography-h6-font-weight')).toBe('500')
    expect(properties.get('--typography-h6-font-size')).toBe('22px')
    expect(properties.get('--typography-h6-letter-spacing')).toBe('0.02em')
  })

  it('writes letter spacing and the sizes that go with their text in ems', () => {
    const properties = propertiesOf(
      themeWith((json) => {
        json.components.ScoreCard.header.letterSpacing = 0.2
        json.components.PlaceNames.country.letterSpacing = 0.1
        json.components.GamePanel.size.scoreWidth = 3
        json.components.SettingsMenu.size.mark = 1.1
      }),
    )
    expect(properties.get('--score-card-header-letter-spacing')).toBe('0.2em')
    expect(properties.get('--place-names-country-letter-spacing')).toBe('0.1em')
    expect(properties.get('--game-panel-size-score-width')).toBe('3em')
    expect(properties.get('--settings-menu-size-mark')).toBe('1.1em')
  })

  it('writes a shadow as a CSS shadow, its colour resolved', () => {
    const properties = propertiesOf(
      themeWith((json) => (json.components.GamePanel.shadow = { x: 1, y: -2, blur: 12, color: 'navy.900' })),
    )
    expect(properties.get('--game-panel-shadow')).toBe('1px -2px 12px #000209')
  })

  it('writes every setting', () => {
    const properties = propertiesOf(themeWith(() => {}))
    // Widths by zoom (lines' and place names' sizes), the disputed borders' dash pattern and the halo's
    // sizes are for the globe, not the page, so aren't written.
    const written = {
      // Four colour roles and four statuses' colours, of four each; the background's two, three kinds of
      // text, a divider and hover.
      palette: 8 * 4 + 2 + 3 + 1 + 1,
      // A font family, and nine type styles of three.
      typography: 1 + 9 * 3,
      // The spacing unit, the corner radius and three border widths.
      shape: 1 + 1 + 3,
      // A small pin's core of four and glow of two, for each of four statuses.
      pin: 4 * 6,
      // A surface, four kinds of line (their colours) and two halo colours.
      globe: 7,
      // Three kinds of place name (city, state and country), each with a colour, an outline (its colour, width and blur), a
      // font (its name, family, weight and style) and letter spacing.
      placeNames: 3 * 9,
      // The sky's colour, three stars and two star sizes.
      sky: 1 + 3 + 2,
      // A cluster's fill, three radii, three glow radii, outline width and glow opacity, its count's
      // font (of four) and size, and its opacity for each of four statuses.
      cluster: 9 + 5 + 4,
      // A trail's width and opacity, its see-through switch and opacity, its glow's three and its venue's three.
      trail: 10,
      selection: 2,
      // A hovered card's border width and whether it turns solid, its trail's width and opacity, and its venue dot's radius and glow of two.
      hover: 2 + 2 + 3,
      // Two sizes and two ring widths.
      pulse: 4,
      // A score card's fill, text, shadow, see-through switch and opacity, header's two, corner and five
      // sizes; for each of four statuses its fade and glow of two, and a Disrupted card's fill and text.
      scoreCard: 3 + 2 + 2 + 1 + 5 + 4 * 3 + 2,
      // The game panel's eleven colours and shadows, glow of three, corner, cut corner's two and nine sizes.
      gamePanel: 11 + 3 + 1 + 2 + 9,
      // A menu's corner and a menu item's.
      menus: 2,
      // The settings menu's eleven colours and shadows and five sizes.
      settingsMenu: 11 + 5,
      // The controls' surface, shadow, on (fill and text), opacity when off, two corners and two sizes.
      controls: 1 + 1 + 2 + 1 + 2 + 2,
      // The loading screen's dim (a colour and an opacity), spinner (two colours and a size) and message.
      loadingScreen: 2 + 3 + 1,
    }
    expect(properties.size).toBe(Object.values(written).reduce((sum, n) => sum + n))
  })
})
