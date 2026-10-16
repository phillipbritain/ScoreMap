import type { GameStatus } from '../games/game'
import { globeFonts, type GlobeFont } from './globeFonts'
import { isHexColor, paletteSteps, stepNames, type StepName } from './palette'

/** What resolving a theme reads from, and where it notes each problem it finds. */
interface Resolving {
  /**
   * Every colour a colour job can name: each step of the theme's colours ("navy.700") and, outside
   * the palette, each of the palette's colours ("primary.dark").
   */
  colours: ReadonlyMap<string, string | undefined>
  /** The theme's JSON, where a size reads the type style, spacing unit or corner radius it's a number of. */
  json: Readonly<Record<string, unknown>>
  problems: string[]
}

/** One setting of a theme: how to read its value from the theme's JSON. */
interface Setting<T> {
  resolve(value: unknown, path: string, resolving: Resolving): T | undefined
  /**
   * How the setting is written as a CSS custom property (see customProperties), if not as it
   * resolves: a value, or values by the end of their names.
   */
  css?(value: T): string | Readonly<Record<string, string>>
}

/**
 * A colour job: a step of the theme's colours by name ("navy.700"), outside the palette one of the
 * palette's colours ("primary.dark"), or a colour given directly ("#0b1526").
 */
const color: Setting<string> = {
  resolve(value, path, { colours, problems }) {
    if (typeof value !== 'string') {
      problems.push(`${path} is ${shown(value)}, not a colour job: a colour’s step such as "navy.700", or a colour`)
      return undefined
    }
    if (directColor.test(value)) return value
    if (looksDirect(value)) {
      problems.push(`${path} is "${value}", not a colour CSS and MapLibre both read (${directColorForms})`)
      return undefined
    }
    // One of the palette's colours with a problem of its own has it reported there.
    if (!colours.has(value)) problems.push(`${path} names "${value}", a colour the theme doesn’t have`)
    return colours.get(value)
  },
}

const number = String.raw`\d*\.?\d+`
const percent = `${number}%`
/** A colour function's three arguments and optional alpha, comma-separated or space-separated with "/ alpha". */
const colorArguments = (a: string, b: string, c: string) =>
  String.raw`\(\s*(?:${a}\s*,\s*${b}\s*,\s*${c}(?:\s*,\s*${number}%?)?|${a}\s+${b}\s+${c}(?:\s*\/\s*${number}%?)?)\s*\)`

/**
 * A colour given directly, in a form both CSS and MapLibre read: #rgb, #rgba, #rrggbb or #rrggbbaa;
 * rgb(…) or rgba(…), its channels all numbers or all percentages; hsl(…) or hsla(…); or transparent.
 */
const directColor = new RegExp(
  [
    '#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})',
    'transparent',
    `rgba?${colorArguments(number, number, number)}`,
    `rgba?${colorArguments(percent, percent, percent)}`,
    `hsla?${colorArguments(`${number}(?:deg)?`, percent, percent)}`,
  ]
    .map((form) => `^${form}$`)
    .join('|'),
  'i',
)
const directColorForms = '#rgb, #rgba, #rrggbb, #rrggbbaa, rgb(…), rgba(…), hsl(…), hsla(…) or transparent'

/** Whether a colour job means to give a colour directly, rather than name a step: a step has neither "#" nor "(". */
const looksDirect = (job: string) => /^#|\(/.test(job)

/** A value as a problem quotes it. */
const shown = (value: unknown) => JSON.stringify(value) ?? String(value)

/** A font for text on the globe: one the map's font server has, by name (ADR-0006). */
const globeFont: Setting<GlobeFont> = {
  resolve(value, path, { problems }) {
    const found = globeFonts.get(String(value))
    if (!found) problems.push(`${path} is "${String(value)}", a font fonts.openmaptiles.org doesn’t have (ADR-0006)`)
    return found
  },
}

/** A number in a range, or a problem naming what it should be. */
function numberFrom(min: number, max: number, what: string): Setting<number> {
  return {
    resolve(value, path, { problems }) {
      if (typeof value === 'number' && value >= min && value <= max) return value
      problems.push(`${path} is ${JSON.stringify(value)}, not ${what}`)
      return undefined
    },
  }
}

/** A number of pixels as CSS writes it ("12px"). */
const inPixels = (value: number) => `${value}px`

/** A size in pixels, written to CSS as one. */
const pixels: Setting<number> = { ...numberFrom(0, Infinity, 'a number of pixels'), css: inPixels }
const opacity = numberFrom(0, 1, 'an opacity from 0 to 1')
/** How frosted a pane of glass is, from clear (0) to opaque frosted glass (1) (ADR-0018). */
const frost = numberFrom(0, 1, 'a frost from 0 (clear glass) to 1 (opaque frosted glass)')
/** How far something is moved, in pixels, either way; written to CSS in pixels. */
const offset: Setting<number> = { ...numberFrom(-Infinity, Infinity, 'a number of pixels'), css: inPixels }

/** A number of ems as CSS writes it ("0.14em"). */
const inEms = (value: number) => `${value}em`

/** A size in ems of the text it goes with, so it grows with the text; written to CSS in ems. */
const ems: Setting<number> = { ...numberFrom(0, Infinity, 'a number of ems'), css: inEms }
/** How far apart letters are spaced, in ems, either way (less than 0 draws them closer); written to CSS in ems. */
const tracking: Setting<number> = { ...numberFrom(-Infinity, Infinity, 'a number of ems'), css: inEms }

/** A setting read by the globe, not the page's CSS, so not written to it. */
const forGlobe = <T>(setting: Setting<T>): Setting<T> => ({ ...setting, css: () => ({}) })

/** A line's dash pattern: the lengths of its dashes and of the gaps between them, in line widths ([2, 2]). */
const dashes: Setting<readonly number[]> = forGlobe({
  resolve(value, path, { problems }) {
    if (Array.isArray(value) && value.length >= 2 && value.every((length) => typeof length === 'number' && length >= 0)) {
      return value as number[]
    }
    problems.push(`${path} is ${shown(value)}, not a dash pattern: dash and gap lengths in line widths, such as [2, 2]`)
    return undefined
  },
})

interface GlobeShare {
  share: number
  max: number
}

/**
 * A size that grows with the globe on screen: this share of the globe's radius there, but never more
 * than `max` pixels.
 */
const withGlobe: Setting<GlobeShare> = forGlobe({
  resolve(value, path, resolving) {
    const parts = { share: numberFrom(0, Infinity, 'a share of the globe’s radius, such as 0.12'), max: pixels }
    return resolveAll(parts, value, path, resolving) as GlobeShare
  },
})

interface Shadow {
  x: number
  y: number
  blur: number
  color: string
}

/**
 * A shadow, or a glow, cast by a panel or control: how far it falls across and down, how far it
 * blurs, and its colour. Written to CSS as one shadow ("0px 8px 30px #000000"), for a box-shadow or a
 * drop-shadow.
 */
const shadow: Setting<Shadow> = {
  resolve(value, path, resolving) {
    const parts = { x: offset, y: offset, blur: pixels, color }
    return resolveAll(parts, value, path, resolving) as Shadow
  },
  css: ({ x, y, blur, color }) => `${inPixels(x)} ${inPixels(y)} ${inPixels(blur)} ${color}`,
}

/** On or off; written to CSS as 1 or 0, to multiply by. */
const onOff: Setting<boolean> = {
  resolve(value, path, { problems }) {
    if (typeof value === 'boolean') return value
    problems.push(`${path} is ${JSON.stringify(value)}, not true or false`)
    return undefined
  },
  css: (on) => (on ? '1' : '0'),
}

/** A CSS font family, such as "system-ui, sans-serif". */
const fontFamily: Setting<string> = {
  resolve(value, path, { problems }) {
    if (typeof value === 'string' && value.trim() !== '') return value
    problems.push(`${path} is ${JSON.stringify(value)}, not a CSS font family`)
    return undefined
  },
}

/** The theme's type styles, by name, as MUI names its typography variants (plus footnote, smaller than a caption). */
const typeStyles = ['h6', 'subtitle1', 'subtitle2', 'body1', 'body2', 'button', 'caption', 'overline', 'footnote'] as const

/**
 * A type style: its weight, its size in pixels, and how far apart its letters are spaced, in ems.
 * Every type style is in the typography's font family.
 */
const typeStyle = {
  fontWeight: numberFrom(1, 1000, 'a font weight from 1 to 1000'),
  fontSize: pixels,
  letterSpacing: tracking,
}

/** A text size given as a type style by name ("caption"), resolving to that style's size in pixels. */
const textSize: Setting<number> = {
  resolve(value, path, { json, problems }) {
    if (typeof value === 'string' && (typeStyles as readonly string[]).includes(value)) {
      const size = (json.typography as Record<string, Record<string, unknown> | undefined> | undefined)?.[value]?.fontSize
      // A type style without a size in pixels is the type style's own problem, reported there.
      return typeof size === 'number' && size >= 0 ? size : undefined
    }
    problems.push(`${path} is ${JSON.stringify(value)}, not a type style (${typeStyles.join(', ')})`)
    return undefined
  },
  css: inPixels,
}

/** A size as a number of spacing units (`spacing`), as MUI's theme.spacing takes one, resolving to pixels. */
const spaces: Setting<number> = {
  resolve(value, path, resolving) {
    const units = numberFrom(0, Infinity, 'a number of spacing units').resolve(value, path, resolving)
    const unit = resolving.json.spacing
    // A spacing unit that isn't a number of pixels is its own problem, reported there.
    return units !== undefined && typeof unit === 'number' && unit >= 0 ? units * unit : undefined
  },
  css: inPixels,
}

/** How round a fully round ("pill") corner is, in pixels: more than half of anything it rounds. */
const pill = 999

/**
 * A corner's radius as a number of the theme's corner radius (`shape.borderRadius`), as MUI's sx takes
 * one, or "pill" for fully round; resolving to pixels.
 */
const corner: Setting<number> = {
  resolve(value, path, { json, problems }) {
    if (value === 'pill') return pill
    if (typeof value !== 'number' || value < 0) {
      problems.push(`${path} is ${JSON.stringify(value)}, not a number of corner radii (shape.borderRadius) or "pill"`)
      return undefined
    }
    const radius = (json.shape as Record<string, unknown> | undefined)?.borderRadius
    // A corner radius that isn't a number of pixels is its own problem, reported there.
    return typeof radius === 'number' && radius >= 0 ? value * radius : undefined
  },
  css: inPixels,
}

/**
 * A size on the globe as the map zooms: a size at each of some zoom levels, by zoom ({ "4": "caption",
 * "11": "h6" } for text, { "2": 0.6, "8": 1.2 } for a line), changing smoothly from one to the next.
 * Read by the globe, not the page's CSS, so not written to it.
 */
function byZoom(size: Setting<number>, what: string): Setting<Readonly<Record<string, number>>> {
  return {
    resolve(value, path, resolving) {
      const stops = typeof value === 'object' && value !== null ? Object.entries(value) : []
      if (stops.length === 0) {
        resolving.problems.push(`${path} gives no zoom levels: it needs ${what} at one zoom level at least`)
        return undefined
      }
      const sizes: Record<string, number> = {}
      for (const [zoom, stop] of stops) {
        if (!/^\d+(\.\d+)?$/.test(zoom)) {
          resolving.problems.push(`${path}.${zoom} isn’t a zoom level`)
          continue
        }
        const resolved = size.resolve(stop, `${path}.${zoom}`, resolving)
        if (resolved !== undefined) sizes[zoom] = resolved
      }
      return sizes
    },
    css: () => ({}),
  }
}

/** A size by zoom (see byZoom) as [zoom, size] stops, furthest out first, as a map style takes them. */
export function zoomStops(sizes: Readonly<Record<string, number>>): [number, number][] {
  return Object.entries(sizes)
    .map(([zoom, size]): [number, number] => [Number(zoom), size])
    .sort(([a], [b]) => a - b)
}

/** A line on the globe: its colour, and its width in pixels as the map zooms. */
const globeLine = { color, width: byZoom(pixels, 'a width') }

/**
 * One of the halo's glows around the globe: its colour, and how far it blurs and spreads, each
 * growing with the globe on screen up to a most.
 */
const haloGlow = { color, blur: withGlobe, spread: withGlobe }

/**
 * A kind of place's name on the globe: its colour, the outline around its letters (its colour, and
 * how wide and blurred it is), its font, its size as the map zooms (each a type style's size), and how
 * far apart its letters are spaced, in ems (state and country names are in capitals, which want more).
 */
const placeName = {
  color,
  outline: { color, width: pixels, blur: pixels },
  font: globeFont,
  size: byZoom(textSize, 'a text size'),
  letterSpacing: tracking,
}

/** The game statuses, by their names in the theme: each has a colour in the palette, and its own look in some components. */
const statuses = ['live', 'upcoming', 'final', 'disrupted'] as const

/**
 * A game status's name in the theme: its key among the palette's colours and the components' looks
 * by status, and so in the custom properties the page's CSS reads (--palette-live-main) and the score
 * cards' status classes (score-card--live). "live" for Live.
 */
export const statusKey = (status: GameStatus): (typeof statuses)[number] => status.toLowerCase() as Lowercase<GameStatus>

/** A setting, or group, for each game status (see statuses). */
function byStatus<S extends object>(look: S): Record<(typeof statuses)[number], S> {
  return Object.fromEntries(statuses.map((status) => [status, look])) as Record<(typeof statuses)[number], S>
}

/**
 * How a score card fades and glows for a status: how far it fades, and how far and how strongly it
 * glows in its game's colour (a radius of 0 is no glow). A card stays solid as it fades: its game's
 * colour, text and logos are mixed this far into its fill (0 is not at all, 1 is all the way, leaving
 * a blank card).
 */
const cardStatus = { fade: numberFrom(0, 1, 'a fade from 0 to 1'), glow: { radius: pixels, opacity } }

/**
 * A colour's role in the palette, as MUI's palette has them: its main shade, a lighter and a darker
 * one, and the colour of text written on its main shade.
 */
const colourRole = { main: color, light: color, dark: color, contrastText: color }

/** A game status's colour in the palette: its main shade, and a lighter and a darker one. */
const statusColour = { main: color, light: color, dark: color }

/**
 * The palette, shaped as MUI's is: what each colour is for, each naming a step of the theme's colours
 * ("navy.500") or giving a colour directly. A colour job outside the palette can name one of these
 * ("primary.dark", "text.secondary", "divider") as well as a step.
 */
/**
 * The plate a team's logo sits on, so that a logo near the colour of what's behind it can still be
 * seen: its colour, how far it reaches past the logo (in spacing units) and its corners.
 */
const logoPlate = { fill: color, padding: spaces, corner }

const palette = {
  primary: colourRole,
  secondary: colourRole,
  error: colourRole,
  warning: colourRole,
  /**
   * Each game status's colour, as MUI's palette takes colours of a theme's own: the colour a game
   * shows in, by its status, unless the viewer picked one for its sport or league (see gameColour): a
   * small pin's ring and glow, its score card's outline, header, status light and glow, its trail, a
   * cluster's outline, glow and count, its pulse, and the game panel's top edge and progress line.
   * Text written on it is the theme's main text or paper surface, whichever reads better on the colour
   * (see palette's textOn), so a status has no contrastText of its own.
   */
  ...byStatus(statusColour),
  /** The page behind everything, and the surfaces on it: the game panel, the menus and the controls. */
  background: { default: color, paper: color },
  /**
   * Text on the game panel, the rail and the scenario controls: main text; secondary text (the game
   * panel's league and labels and the lines under a venue or time, league chips that are off and the
   * count on the "All leagues" chip); and links.
   */
  text: { primary: color, secondary: color, link: color },
  /** The lines between a menu's parts. */
  divider: color,
  /** Behind a control under the pointer. */
  action: { hover: color },
}

/** Every setting a theme has but its colours, by where it sits in the theme. */
const settings = {
  palette,
  /**
   * The page's text, shaped as MUI's typography is: one font family, and type styles, each a weight,
   * size and letter spacing. Body text is body1, and the game panel and menus body2; the game panel's
   * team names are subtitle1, its scores h6, and its league, labels and progress line overline (the
   * labels tracked out, like the country names on the globe); a score card's clock line is subtitle2,
   * its team abbreviations subtitle1's weight and scores h6's; tabs, chips, buttons and the scenario
   * pill are button, and the scenario clock body2; captions and footnotes are the smaller lines.
   */
  typography: {
    fontFamily,
    ...(Object.fromEntries(typeStyles.map((name) => [name, typeStyle])) as Record<(typeof typeStyles)[number], typeof typeStyle>),
  },
  /** The spacing unit, in pixels: every space on the page is a number of these, as MUI's theme.spacing gives them. */
  spacing: pixels,
  /**
   * The corner radius every corner is a number of (see corner), and the page's line widths (borders,
   * dividers): thin, medium and thick.
   */
  shape: { borderRadius: pixels, borderWidth: { thin: pixels, medium: pixels, thick: pixels } },
  /** How each part of ScoreMap looks, by part, as MUI's components hold each component's own look. */
  components: {
    /**
     * The globe: its surface (land and sea alike); its coastlines, country borders, state lines and
     * disputed borders, the disputed ones dashed in this pattern; and the halo around its edge, a glow
     * close to the edge and a wider, fainter one outside it.
     */
    Globe: {
      surface: color,
      coastlines: globeLine,
      countryBorders: globeLine,
      stateLines: globeLine,
      disputedBorders: { ...globeLine, dash: dashes },
      halo: { inner: haloGlow, outer: haloGlow },
    },
    PlaceNames: { city: placeName, state: placeName, country: placeName },
    /** The sky around the globe, behind it, with its scattering of stars: white, cool and warm, small and large. */
    Sky: { color, stars: { white: color, cool: color, warm: color, size: { small: pixels, large: pixels } } },
    /**
     * A game's small pin, by its status: its bright core (its colour, radius, opacity, and the width of
     * the ring of the game's colour around it) and the soft glow around that, in the game's colour (its
     * radius, out to where it has faded to nothing, and its opacity at the middle). A core whose colour
     * is just its status's palette colour is in the game's colour; any other (Live's paler core, say)
     * stays as given, so status still shows by brightness. Small pins gather into pin clusters by the
     * widest glow.
     */
    Pin: byStatus({ core: { color, radius: pixels, opacity, ring: pixels }, glow: { radius: pixels, opacity } }),
    /**
     * A cluster, pin or card, is a disc filled with this, outlined this wide and lit in its games'
     * colour (the theme's accent where they differ), in a glow as strong as this much of its status's small pins' glow, so a cluster of a
     * status whose pins don't glow doesn't either. A pin cluster's disc and glow are as wide as these
     * radii by how many games it holds: a few (up to 4), some (up to 14) or many; a card cluster is as
     * wide as a pin cluster of some games. Its count is in a font the map's font server has (ADR-0006),
     * at a type style's size. By the status it shows as, how opaque it is: its disc, outline and count alike.
     */
    Cluster: {
      fill: color,
      radius: { few: pixels, some: pixels, many: pixels },
      glowRadius: { few: pixels, some: pixels, many: pixels },
      outlineWidth: pixels,
      glowOpacity: opacity,
      count: { font: globeFont, size: textSize },
      ...byStatus({ opacity }),
    },
    /**
     * A moved score card's trail back to its venue: a line this wide and opaque in its game's colour
     * (below 1, the map shows through it), in a soft glow, to a dot ringed in that colour.
     */
    Trail: {
      width: pixels,
      opacity,
      glow: { width: pixels, blur: pixels, opacity },
      venue: { radius: pixels, ring: { radius: pixels, width: pixels } },
    },
    /** The selected game's small pin ring and score card outline: their colour and width. */
    Selection: { color, width: pixels },
    /**
     * A score card the pointer is on, and its game on the globe, picked out: the card's border this
     * wide, and solid whatever the cards' fill opacity, or not; its trail this wide and opaque (in place
     * of the trail's own opacity); and the venue dot its trail ends at this
     * big, in a glow of its game's colour this wide and strong. Its card doesn't move. Where the game
     * is also the selected one, selection's look wins where they differ.
     */
    Hover: {
      card: { borderWidth: pixels, solid: onOff },
      trail: { width: pixels, opacity },
      venue: { radius: pixels, glow: { radius: pixels, opacity } },
    },
    /**
     * The rings an animation draws over a small pin or a cluster: how wide they start, over a pin and
     * over a cluster, and how thick, for a lively animation (a score or a start) and a calm one (a finish).
     */
    Pulse: { size: { pin: pixels, cluster: pixels }, ring: { lively: pixels, calm: pixels } },
    /**
     * A score card: its fill and text, the drop shadow a starting game's card settles with, its header (how strongly it's
     * tinted with its game's colour, 0 not at all and 1 the colour itself, its text then the card's text
     * or fill, whichever reads better on the tint, and how far apart its letters are spaced, in ems) and
     * its corners. Its outline, header line, light and glow are its game's colour. Its size: its narrowest, a team's
     * logo, how far above its venue it sits at the least, its trail between (the globe places cards by this),
     * its status light, and how far it keeps clear of the letters of a city named for its game (the
     * globe lays cards out by this). The plate each logo sits on (see logoPlate). By its status, how it
     * fades and glows (see cardStatus), and a Disrupted game's fill and text. Its glass's frost: its fill,
     * drop shadow, header tint, glow inside and logo plates clear with it, while its text, logos, scores,
     * outline and status light stay solid.
     */
    ScoreCard: {
      fill: color,
      text: color,
      shadow: color,
      frost,
      header: { tint: opacity, letterSpacing: tracking },
      corner,
      size: { minWidth: pixels, logo: pixels, venueGap: pixels, light: pixels, nameClearance: pixels },
      logo: { plate: logoPlate },
      live: cardStatus,
      upcoming: cardStatus,
      final: cardStatus,
      disrupted: { fill: color, text: color, ...cardStatus },
    },
    /**
     * The game panel: its surface and the score block's, each shading from top to bottom, a team's score,
     * unofficial stream links, the glow where the venue's photo goes, the photo's credit, the close
     * button and the panel's drop shadow. Its top edge is the game's colour, and it glows in that
     * colour, this far up, this blurred and this strongly. Its corners, and its bottom left corner cut
     * off, like a broadcast graphic, or not: this many spacing units along each side. Its size: its
     * width at most, its height, and its height on a phone, where the details go below the score block;
     * the score block's width and how far its right edge slants; the venue photo's width; a team's logo;
     * the close button; and a team's score box, in ems of its digits. The plate each logo sits on (see
     * logoPlate). It sits clear of the scenario
     * controls by their keys' size. Its glass's frost: its surface, score block, score boxes and logo
     * plates clear with it.
     */
    GamePanel: {
      frost,
      surface: { top: color, bottom: color },
      scoreBlock: { top: color, bottom: color },
      score: { fill: color, text: color },
      unofficial: color,
      photo: color,
      credit: { fill: color, text: color },
      close: color,
      shadow,
      glow: { y: offset, blur: pixels, opacity },
      corner,
      cutCorner: { on: onOff, size: spaces },
      logo: { plate: logoPlate },
      size: {
        width: pixels,
        height: pixels,
        phoneHeight: pixels,
        scoreBlock: pixels,
        slant: pixels,
        photo: pixels,
        logo: pixels,
        close: pixels,
        scoreWidth: ems,
      },
    },
    /** A menu's corners (the rail and its popovers, the list of scenarios). */
    Menu: { corner },
    /** An item's corners in a menu. */
    MenuItem: { corner },
    /**
     * The rail, its popovers (Leagues and Colours) and its toast: their surface and drop shadow; a toggle
     * button's icon that's on and one that's off; the count of a sport's leagues that are on, the hint
     * beside "All leagues", a league chip's outline and the badge counting leagues, and a chip that's
     * on. Its size: a button and its icon, a popover's width, the "All leagues" chip's height, and on
     * that chip, the narrowest its count is and the box its mark (✓ or –) sits in, in ems. The frost
     * of their glass.
     */
    Rail: {
      frost,
      surface: color,
      shadow,
      toggle: { on: color, off: color },
      count: color,
      hint: color,
      chip: { outline: color, badge: color },
      on: { fill: color, text: color },
      size: { button: pixels, icon: pixels, width: pixels, allLeagues: pixels, countWidth: ems, mark: ems },
    },
    /**
     * The scenario pill, the speed keys, the scenario clock and the "No games right now." message: their
     * surface and drop shadow, a speed key that's on, and how opaque one that's off is. A control's
     * corners (the scenario pill and clock, the speed keys, league chips) and the message's. Its size: a
     * speed key and its icon. The frost of their glass.
     */
    Controls: {
      frost,
      surface: color,
      shadow,
      on: { fill: color, text: color },
      off: { opacity },
      corner,
      message: { corner },
      size: { key: pixels, icon: pixels },
    },
    /** A tooltip: its surface, tinting its glass, and the frost of its glass. */
    Tooltip: { frost, surface: color },
    /**
     * The loading screen, shown over the globe until ScoreMap is ready: the dim over the globe (its colour,
     * and how opaque it is, so the globe still shows through) and the flying rocket (its body and speed
     * lines, its flame, and how big its box is across), and the text of the message under the rocket
     * when loading is slow.
     */
    LoadingScreen: { dim: { color, opacity }, rocket: { color, flame: color, size: pixels }, message: color },
  },
}

type Resolved<S> = S extends Setting<infer T> ? T : { readonly [K in keyof S]: Resolved<S[K]> }

/** A theme, resolved from its JSON: every setting's value, ready to use. */
export type Theme = Resolved<typeof settings>

export type ThemeResult = { ok: true; theme: Theme } | { ok: false; problems: string[] }

/** The parts of a theme's JSON: its colours, and its settings. */
const parts = ['colors', ...Object.keys(settings)]

/** Reads a theme from its parsed JSON. */
export function resolveTheme(json: unknown): ThemeResult {
  if (!isObject(json)) return { ok: false, problems: [`a theme is ${shown(json)}, not an object with ${parts.join(', ')}`] }
  const problems: string[] = []
  for (const key of Object.keys(json)) {
    if (!parts.includes(key)) problems.push(`${key} isn’t part of a theme: a theme has ${parts.join(', ')}`)
  }
  // The palette names the colours' steps; everything else may name its colours too.
  const steps = stepsOfColours(json.colors, problems)
  const resolvedPalette = resolveAll(palette, json.palette, 'palette', { colours: steps, json, problems })
  const colours = new Map<string, string | undefined>([...steps, ...paletteColours(resolvedPalette)])
  const { palette: _, ...rest } = settings
  const resolving: Resolving = { colours, json, problems }
  const theme = {
    palette: resolvedPalette,
    ...Object.fromEntries(Object.entries(rest).map(([key, schema]) => [key, resolveAll(schema, json[key], key, resolving)])),
  } as Theme
  return problems.length ? { ok: false, problems } : { ok: true, theme }
}

/**
 * Each of the palette's colours, by its name in a colour job ("primary.dark", "divider"), and what it
 * resolved to: nothing, where it has a problem.
 */
function paletteColours(resolved: unknown): [string, string | undefined][] {
  const found: [string, string | undefined][] = []
  const walk = (schema: object, value: unknown, name: string) => {
    if (isSetting(schema)) found.push([name, typeof value === 'string' ? value : undefined])
    else for (const [key, inner] of Object.entries(schema)) walk(inner, isObject(value) ? value[key] : undefined, name ? `${name}.${key}` : key)
  }
  walk(palette, resolved, '')
  return found
}

/** Whether a value from a theme's JSON is an object of named values (not an array or null). */
const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every step of the theme's colours, by its name in a colour job; a colour with problems has none. */
function stepsOfColours(colors: unknown, problems: string[]): Map<string, string> {
  const byStep = new Map<string, string>()
  if (colors === undefined) problems.push('colors is missing')
  else if (!isObject(colors)) problems.push(`colors is ${shown(colors)}, not colours by name`)
  for (const [name, colour] of Object.entries(isObject(colors) ? colors : {})) {
    const path = `colors.${name}`
    if (Object.hasOwn(palette, name)) {
      problems.push(`${path} is named as one of the palette’s colours are, so a colour job naming it would be unclear`)
      continue
    }
    if (!isObject(colour)) {
      problems.push(`${path} is ${shown(colour)}, not a colour with a base`)
      continue
    }
    const { base, steps = {}, ...unknown } = colour
    for (const key of Object.keys(unknown)) problems.push(`${path}.${key} isn’t part of a colour: it has a base and steps`)
    // A colour that can't be worked out has no steps; one with only an unknown part still does.
    const before = problems.length
    if (!isHexColor(base)) problems.push(`${path}.base is ${shown(base)}, not a #rrggbb colour`)
    if (!isObject(steps)) problems.push(`${path}.steps is ${shown(steps)}, not steps by name`)
    const handSet = isObject(steps) ? steps : {}
    for (const [step, value] of Object.entries(handSet)) {
      if (!(stepNames as readonly string[]).includes(step)) {
        problems.push(`${path}.steps.${step} isn’t a step: steps are ${stepNames[0]} to ${stepNames.at(-1)}`)
      } else if (!isHexColor(value)) problems.push(`${path}.steps.${step} is ${shown(value)}, not a #rrggbb colour`)
    }
    if (problems.length > before) continue
    const worked = paletteSteps(base as string, handSet as Partial<Record<StepName, string>>)
    for (const [step, value] of Object.entries(worked)) byStep.set(`${name}.${step}`, value)
  }
  return byStep
}

function isSetting(schema: unknown): schema is Setting<unknown> {
  return typeof (schema as Setting<unknown>).resolve === 'function'
}

/**
 * Resolves a setting, or a group of them: each setting the group has, and a problem for each it
 * doesn't, so a misspelt setting shows as itself rather than as the real one missing.
 */
function resolveAll(schema: object, value: unknown, path: string, resolving: Resolving): unknown {
  if (value === undefined) {
    resolving.problems.push(`${path} is missing`)
    return undefined
  }
  if (isSetting(schema)) return schema.resolve(value, path, resolving)
  if (!isObject(value)) {
    resolving.problems.push(`${path} is ${shown(value)}, not a group of settings`)
    return undefined
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(schema, key)) resolving.problems.push(`${path}.${key} isn’t a setting a theme has`)
  }
  return Object.fromEntries(
    Object.entries(schema).map(([key, inner]) => [key, resolveAll(inner, value[key], `${path}.${key}`, resolving)]),
  )
}

/**
 * The resolved theme as CSS custom properties, one for each setting, named by where it sits in the
 * theme, in kebab case, as MUI's CSS theme variables are: `palette.text.primary` is
 * --palette-text-primary, `typography.body2.fontSize` is --typography-body2-font-size and `spacing`
 * is --spacing. A component's settings are named by the component alone: `components.ScoreCard.fill`
 * is --score-card-fill, and `components.PlaceNames.city.font` gives --place-names-city-font-family,
 * -weight and -style. Sizes are written in pixels ("12px"), or in ems where they go with their text
 * ("0.14em"), and on or off as 1 or 0. What only the globe reads (sizes by zoom, a dash pattern, the
 * halo's sizes) isn't written.
 */
export function customProperties(theme: Theme): Map<string, string> {
  const properties = new Map<string, string>()
  const write = (value: unknown, name: string) => {
    if (typeof value !== 'object' || value === null) properties.set(name, String(value))
    else for (const [key, inner] of Object.entries(value)) write(inner, `${name}-${kebabCase(key)}`)
  }
  const walk = (schema: object, value: unknown, name: string) => {
    if (isSetting(schema)) write(schema.css ? schema.css(value) : value, name)
    else {
      const values = value as Record<string, unknown>
      for (const [key, inner] of Object.entries(schema)) {
        // A component's settings are named by the component alone.
        walk(inner, values[key], schema === settings && key === 'components' ? name : `${name}-${kebabCase(key)}`)
      }
    }
  }
  walk(settings, theme, '-')
  return properties
}

/** A setting's name in kebab case: "contrastText" is "contrast-text" and "ScoreCard" "score-card". */
const kebabCase = (key: string) => key.replace(/[A-Z]/g, (letter, at: number) => `${at ? '-' : ''}${letter.toLowerCase()}`)
