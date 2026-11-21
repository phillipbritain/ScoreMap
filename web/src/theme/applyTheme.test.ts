import { describe, expect, it } from 'vitest'
import { applyTheme } from './applyTheme'
import { themeWith } from './testTheme'
import type { Theme } from './theme'

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

  it('writes color jobs as the colors they resolve to, through the palette or not', () => {
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
        json.components.EventPanel.cutCorner = { on: false, size: 3 }
      }),
    )
    expect(properties.get('--spacing')).toBe('5px')
    expect(properties.get('--shape-border-radius')).toBe('3px')
    expect(properties.get('--menu-item-corner')).toBe('6px')
    expect(properties.get('--controls-corner')).toBe('999px')
    expect(properties.get('--event-panel-cut-corner-size')).toBe('15px')
    expect(properties.get('--event-panel-cut-corner-on')).toBe('0')
  })

  it('writes the score card’s frost', () => {
    const properties = propertiesOf(themeWith((json) => (json.components.ScoreCard.frost = 0.3)))
    expect(properties.get('--score-card-frost')).toBe('0.3')
  })

  it('writes the event panel’s frost and its close tab’s size', () => {
    const properties = propertiesOf(
      themeWith((json) => {
        json.components.EventPanel.frost = 0.7
        json.components.EventPanel.size.close = { width: 30, height: 20 }
      }),
    )
    expect(properties.get('--event-panel-frost')).toBe('0.7')
    expect(properties.get('--event-panel-size-close-width')).toBe('30px')
    expect(properties.get('--event-panel-size-close-height')).toBe('20px')
  })

  it('writes the hovered card’s border width, and whether it turns solid as 1 or 0', () => {
    const properties = propertiesOf(themeWith((json) => (json.components.Hover.card = { borderWidth: 3, solid: false })))
    expect(properties.get('--hover-card-border-width')).toBe('3px')
    expect(properties.get('--hover-card-solid')).toBe('0')
  })

  it('writes a logo plate on the score card and event panel: its color, its padding in spacing units and its corner in radii, in pixels', () => {
    const properties = propertiesOf(
      themeWith((json) => {
        json.spacing = 4
        json.shape.borderRadius = 2
        json.components.ScoreCard.logo = { plate: { fill: '#f0f0f0', padding: 0.5, corner: 1 } }
        json.components.EventPanel.logo = { plate: { fill: '#e0e0e0', padding: 1, corner: 'pill' } }
      }),
    )
    expect(properties.get('--score-card-logo-plate-fill')).toBe('#f0f0f0')
    expect(properties.get('--score-card-logo-plate-padding')).toBe('2px')
    expect(properties.get('--score-card-logo-plate-corner')).toBe('2px')
    expect(properties.get('--event-panel-logo-plate-fill')).toBe('#e0e0e0')
    expect(properties.get('--event-panel-logo-plate-padding')).toBe('4px')
    expect(properties.get('--event-panel-logo-plate-corner')).toBe('999px')
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
        json.components.EventPanel.size.scoreWidth = 3
        json.components.Rail.size.countWidth = 1.1
      }),
    )
    expect(properties.get('--score-card-header-letter-spacing')).toBe('0.2em')
    expect(properties.get('--place-names-country-letter-spacing')).toBe('0.1em')
    expect(properties.get('--event-panel-size-score-width')).toBe('3em')
    expect(properties.get('--rail-size-count-width')).toBe('1.1em')
  })

  it('writes a shadow as a CSS shadow, its color resolved', () => {
    const properties = propertiesOf(
      themeWith((json) => (json.components.EventPanel.shadow = { x: 1, y: -2, blur: 12, color: 'navy.900' })),
    )
    expect(properties.get('--event-panel-shadow')).toBe('1px -2px 12px #000209')
  })

  it('writes every setting', () => {
    const properties = propertiesOf(themeWith(() => {}))
    // Widths by zoom (lines' and place names' sizes), the disputed borders' dash pattern and the halo's
    // sizes are for the globe, not the page, so aren't written.
    const written = {
      // Four color roles of four each, and three statuses' colors of three; the background's two, three
      // kinds of text, a divider and hover.
      palette: 4 * 4 + 3 * 3 + 2 + 3 + 1 + 1,
      // A font family, and eleven type styles of three.
      typography: 1 + 11 * 3,
      // The spacing unit, the corner radius and three border widths.
      shape: 1 + 1 + 3,
      // A small pin's core of four and glow of two, for each of three statuses, and its hot indicator's size, width and two opacities.
      pin: 3 * 6 + 4,
      // A surface, the sea, four kinds of line (their colors) and two halo colors.
      globe: 8,
      // Three kinds of place name (city, state and country), each with a color, an outline (its color, width and blur), a
      // font (its name, family, weight and style) and letter spacing; and a city's dot's radius and ring.
      placeNames: 3 * 9 + 2,
      // The sky's color, three stars and two star sizes.
      sky: 1 + 3 + 2,
      // A card cluster's fill, radius, glow radius, outline width and glow opacity, its count's font
      // (of four) and size, its hot indicator's four settings, and its opacity for each of three statuses.
      cluster: 5 + 5 + 4 + 3,
      // A trail's width and opacity, its glow's three, its venue's three and its card dot's radius.
      trail: 9,
      selection: 2,
      // A hovered card's border width and whether it turns solid, its trail's width and opacity, and its venue dot's radius and glow of two, and its card dot's radius.
      hover: 2 + 2 + 3 + 1,
      // Two sizes and two ring widths.
      pulse: 3,
      // A score card's fill, text, shadow, frost, header's two, corner, four sizes,
      // logo plate of three and hot indicator's seven (width, glow of three and three colors); for each of three statuses its fade and glow of two.
      scoreCard: 3 + 1 + 2 + 1 + 4 + 3 + 7 + 3 * 3,
      // The event panel's eight colors and shadows, the photo's opacity, the score block's frost, glow of
      // three, corner, cut corner's two, ten sizes (the close tab's two, the clock's two) and logo plate of three.
      eventPanel: 8 + 1 + 1 + 3 + 1 + 2 + 10 + 3,
      // A menu's corner and a menu item's.
      menus: 2,
      // The rail's eleven colors and shadows, a lit chip's outline, tint and glow of two, and six sizes.
      rail: 11 + 4 + 6,
      // The controls' surface, shadow, on (fill and text), opacity when off, two corners and two sizes.
      controls: 1 + 1 + 2 + 1 + 2 + 2,
      // A tooltip's surface and outline.
      tooltip: 2,
      // The loading screen's dim (a color and an opacity), rocket (three colors and a size), message, its
      // glow (a color, a radius and an opacity) and its ellipsis's dots (a size).
      loadingScreen: 2 + 4 + 1 + 3 + 1,
      // The welcome tour's dim opacity, arrow width and Welcome's three choices' outlines.
      welcomeTour: 2 + 3,
    }
    expect(properties.size).toBe(Object.values(written).reduce((sum, n) => sum + n))
  })
})
