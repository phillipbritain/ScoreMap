import { globeFonts, type GlobeFont } from './globeFonts'
import { isHexColor, paletteSteps, stepNames, type StepName } from './palette'

/** What resolving a theme's settings reads from, and where it notes each problem it finds. */
interface Resolving {
  /** Every palette step, by its name in a colour job, such as "navy.700". */
  steps: ReadonlyMap<string, string>
  /** The theme's settings as its JSON gives them, where a size reads its scale's steps. */
  settings: Readonly<Record<string, unknown>>
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

/** A colour job: a palette step by name ("navy.700"), or a colour given directly ("#0b1526"). */
const color: Setting<string> = {
  resolve(value, path, { steps, problems }) {
    if (typeof value !== 'string') {
      problems.push(`${path} is ${shown(value)}, not a colour job: a palette step such as "navy.700", or a colour`)
      return undefined
    }
    if (directColor.test(value)) return value
    if (looksDirect(value)) {
      problems.push(`${path} is "${value}", not a colour CSS and MapLibre both read (${directColorForms})`)
      return undefined
    }
    const step = steps.get(value)
    if (step === undefined) problems.push(`${path} names "${value}", a step the palette doesn’t have`)
    return step
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

/** A size in pixels, written to CSS as one. */
const pixels: Setting<number> = { ...numberFrom(0, Infinity, 'a number of pixels'), css: (value) => `${value}px` }
const opacity = numberFrom(0, 1, 'an opacity from 0 to 1')
/** How far something is moved, in pixels, either way; written to CSS in pixels. */
const offset: Setting<number> = { ...numberFrom(-Infinity, Infinity, 'a number of pixels'), css: (value) => `${value}px` }

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
  css: ({ x, y, blur, color }) => `${x}px ${y}px ${blur}px ${color}`,
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

/** A font for text on the page: its CSS font family and its weight. */
const pageFont = { family: fontFamily, weight: numberFrom(1, 1000, 'a font weight from 1 to 1000') }

/**
 * The scales every text size, spacing, corner radius and the page's line widths (borders, dividers) are
 * a step of, and their steps' names. The page's CSS uses only these steps (as --text-sizes-m, --spacing-l,
 * --corners-card, --strokes-thin and so on), and a size elsewhere in a theme names one.
 */
const scales = {
  textSizes: { what: 'text size', steps: ['xs', 's', 'm', 'l', 'xl'] },
  spacing: { what: 'spacing', steps: ['2xs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl'] },
  radii: { what: 'radius', steps: ['xs', 's', 'm', 'l', 'pill'] },
  strokes: { what: 'stroke', steps: ['thin', 'medium', 'thick'] },
} as const

type ScaleName = keyof typeof scales

/** A scale's steps, each a number of pixels. */
function scale<const Steps extends readonly string[]>(steps: Steps): Record<Steps[number], Setting<number>> {
  return Object.fromEntries(steps.map((step) => [step, pixels])) as Record<Steps[number], Setting<number>>
}

/** A size given as a step of its scale, by name ("m"), resolving to the pixels that step holds. */
function stepOf(name: ScaleName): Setting<number> {
  const { what, steps } = scales[name]
  return {
    resolve(value, path, { settings, problems }) {
      if (typeof value === 'string' && (steps as readonly string[]).includes(value)) {
        const size = (settings[name] as Record<string, unknown> | undefined)?.[value]
        // A step that isn't a number of pixels is the scale's own problem, reported there.
        return typeof size === 'number' && size >= 0 ? size : undefined
      }
      problems.push(`${path} is ${JSON.stringify(value)}, not a step of the ${what} scale (${steps.join(', ')})`)
      return undefined
    },
    css: (value) => `${value}px`,
  }
}

const textSize = stepOf('textSizes')
const spacing = stepOf('spacing')
const radius = stepOf('radii')

/**
 * A size on the globe as the map zooms: a size at each of some zoom levels, by zoom ({ "4": "s",
 * "11": "xl" } for text, { "2": 0.6, "8": 1.2 } for a line), changing smoothly from one to the next.
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

/** A line on the globe: its colour, and its width in pixels as the map zooms. */
const globeLine = { color, width: byZoom(pixels, 'a width') }

/**
 * A kind of place's name on the globe: its colour, the outline around its letters (its colour, and
 * how wide and blurred it is), its font, and its size as the map zooms.
 */
const placeName = {
  color,
  outline: { color, width: pixels, blur: pixels },
  font: globeFont,
  size: byZoom(textSize, 'a text size'),
}

/**
 * How a game's status looks on the globe, alike on small pins, score cards and clusters: its colour,
 * the small pin's bright core (its colour, radius, opacity, and the width of the ring of status colour
 * around it) and the soft glow around that (its radius, out to where it has faded to nothing, and its
 * opacity at the middle), how opaque a pin cluster or card cluster showing as this status is (its
 * disc, outline and count alike), and its score cards: how far they fade, and how far and how strongly they glow in its colour (a radius of 0 is no glow). A
 * card stays solid as it fades: its status colour, text and logos are mixed this far into its fill
 * (0 is not at all, 1 is all the way, leaving a blank card).
 */
const statusLook = {
  color,
  core: { color, radius: pixels, opacity, ring: pixels },
  glow: { radius: pixels, opacity },
  clusterOpacity: opacity,
  card: { fade: numberFrom(0, 1, 'a fade from 0 to 1'), glow: { radius: pixels, opacity } },
}

/** Every setting a theme has, by where it sits in the theme's settings. */
const settings = {
  textSizes: scale(scales.textSizes.steps),
  spacing: scale(scales.spacing.steps),
  radii: scale(scales.radii.steps),
  strokes: scale(scales.strokes.steps),
  globe: {
    surface: color,
    coastlines: globeLine,
    countryBorders: globeLine,
    stateLines: globeLine,
    disputedBorders: globeLine,
    halo: { inner: color, outer: color },
  },
  placeNames: { city: placeName, capital: placeName, state: placeName, country: placeName },
  status: { live: statusLook, upcoming: statusLook, final: statusLook, disrupted: statusLook },
  /**
   * A cluster, pin or card, is a disc filled with this, outlined this wide and lit in its status's
   * colour, in a glow as strong as this much of its status's small pins' glow, so a cluster of a
   * status whose pins don't glow doesn't either. A pin cluster's disc and glow are as wide as these
   * radii by how many games it holds: a few (up to 4), some (up to 14) or many; a card cluster is as
   * wide as a pin cluster of some games.
   */
  cluster: {
    fill: color,
    radius: { few: pixels, some: pixels, many: pixels },
    glowRadius: { few: pixels, some: pixels, many: pixels },
    outlineWidth: pixels,
    glowOpacity: opacity,
  },
  /**
   * A moved score card's trail back to its venue: a line this wide and opaque in its game's status
   * colour, in a soft glow, to a dot ringed in that colour.
   */
  trail: {
    width: pixels,
    opacity,
    glow: { width: pixels, blur: pixels, opacity },
    venue: { radius: pixels, ring: { radius: pixels, width: pixels } },
  },
  /** The selected game's small pin ring and score card outline: their colour and width. */
  selection: { color, width: pixels },
  /**
   * The rings an animation draws over a small pin or a cluster: how wide they start, over a pin and
   * over a cluster, and how thick, for a lively animation (a score or a start) and a calm one (a finish).
   */
  pulse: { size: { pin: pixels, cluster: pixels }, ring: { lively: pixels, calm: pixels } },
  /** Behind the globe: the page itself, and the sky around the globe with its scattering of stars, white, cool and warm. */
  page: { background: color, sky: color, stars: { white: color, cool: color, warm: color } },
  /**
   * Text on the game panel, the settings menu and the scenario controls: main text, secondary text
   * (the lines under a venue or time), the accent (the game panel's league and labels, the settings
   * gear, league chips), links, and text written on a status's colour (the game panel's progress line).
   */
  text: { main: color, secondary: color, accent: color, link: color, onStatus: color },
  /** The lines between a menu's parts. */
  divider: color,
  /** Behind a control under the pointer. */
  hover: color,
  /**
   * The scenario pill, the speed keys, the scenario clock and the "No games right now." message: their
   * surface and drop shadow, and a speed key that's on.
   */
  controls: { surface: color, shadow, on: { fill: color, text: color } },
  /**
   * A score card: its fill and text, a Disrupted game's, the drop shadow a starting game's card
   * settles with, and how strongly its header is tinted with its status's colour (0 is not at all, 1
   * is the colour itself). Its outline, header line, light and glow are its status's colour.
   */
  card: { fill: color, text: color, disrupted: { fill: color, text: color }, shadow: color, headerTint: opacity },
  /**
   * The game panel: its surface and the score block's, each shading from top to bottom, a team's score,
   * unofficial stream links, the glow where the venue's photo goes, the photo's credit, the close
   * button and the panel's drop shadow. Its top edge is the game's status colour, and it glows in that
   * colour, this far up, this blurred and this strongly.
   */
  panel: {
    surface: { top: color, bottom: color },
    scoreBlock: { top: color, bottom: color },
    score: { fill: color, text: color },
    unofficial: color,
    photo: color,
    credit: { fill: color, text: color },
    close: color,
    shadow,
    glow: { y: offset, blur: pixels, opacity },
  },
  /**
   * The settings menu: its surface and drop shadow, an outline around the gear (a shadow), a tab
   * that's off, the count of a sport's leagues that are on, the hint beside "All leagues", a league
   * chip's outline and the badge counting leagues, and a tab or chip that's on.
   */
  settingsMenu: {
    surface: color,
    shadow,
    gearOutline: shadow,
    tab: color,
    count: color,
    hint: color,
    chip: { outline: color, badge: color },
    on: { fill: color, text: color },
  },
  /**
   * A font for each kind of text. On the page: body text; the game panel's headings (its league,
   * labels and progress line), team names and scores; the settings menu's tabs and sport names;
   * buttons (league chips, the game panel's close button); the scenario pill and the scenario it
   * has on; the scenario clock; and a score card's clock line, team abbreviations and scores. On the
   * globe, the count on a pin or card cluster, in a font the map's font server has (ADR-0006), and
   * its size. Place names have theirs by kind of place.
   */
  fonts: {
    body: pageFont,
    heading: pageFont,
    team: pageFont,
    score: pageFont,
    tab: pageFont,
    button: pageFont,
    scenarioPill: pageFont,
    scenarioClock: pageFont,
    card: { clock: pageFont, team: pageFont, score: pageFont },
    clusterCount: { font: globeFont, size: textSize },
  },
  /**
   * Corners, each a step of the radius scale: a score card's; the game panel's; a menu's (the settings
   * menu, the list of scenarios); an item's in a menu; a message's (such as "No games right now.");
   * and a control's (the scenario pill and clock, the speed keys, league chips).
   */
  corners: { card: radius, panel: radius, menu: radius, menuItem: radius, message: radius, control: radius },
  /** The game panel's bottom left corner cut off, like a broadcast graphic, or not: this far along each side. */
  cutCorner: { on: onOff, size: spacing },
  /**
   * How big things on the page are, in pixels. The game panel: its width at most, its height, and its
   * height on a phone, where the details go below the score block; the score block's width and how
   * far its right edge slants; the venue photo's width; a team's logo; and the close button. A score
   * card: its narrowest, a team's logo, how far its pointer reaches below it to the venue (the globe
   * reads this to place cards) and its status light. The settings menu: its width, the gear, and the
   * "All leagues" chip's height. The scenario controls: a speed key and its icon. The game panel sits
   * clear of the scenario controls by their keys' size.
   */
  sizes: {
    panel: {
      width: pixels,
      height: pixels,
      phoneHeight: pixels,
      scoreBlock: pixels,
      slant: pixels,
      photo: pixels,
      logo: pixels,
      close: pixels,
    },
    card: { minWidth: pixels, logo: pixels, pointer: pixels, light: pixels },
    settingsMenu: { width: pixels, gear: pixels, allLeagues: pixels },
    controls: { key: pixels, icon: pixels },
  },
}

type Resolved<S> = S extends Setting<infer T> ? T : { readonly [K in keyof S]: Resolved<S[K]> }

/** A theme, resolved from its JSON: every setting's value, ready to use. */
export type Theme = Resolved<typeof settings>

export type ThemeResult = { ok: true; theme: Theme } | { ok: false; problems: string[] }

/** Reads a theme from its parsed JSON. */
export function resolveTheme(json: unknown): ThemeResult {
  if (!isObject(json)) return { ok: false, problems: [`a theme is ${shown(json)}, not an object with a palette and settings`] }
  const problems: string[] = []
  for (const key of Object.keys(json)) {
    if (key !== 'palette' && key !== 'settings') problems.push(`${key} isn’t part of a theme: a theme has a palette and settings`)
  }
  const { palette, settings: values } = json
  const resolving: Resolving = {
    steps: paletteByStep(palette, problems),
    settings: isObject(values) ? values : {},
    problems,
  }
  const theme = resolveAll(settings, values, 'settings', resolving) as Theme
  return problems.length ? { ok: false, problems } : { ok: true, theme }
}

/** Whether a value from a theme's JSON is an object of named values (not an array or null). */
const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every step of the palette's colours, by its name in a colour job; a colour with problems has none. */
function paletteByStep(palette: unknown, problems: string[]): Map<string, string> {
  const byStep = new Map<string, string>()
  if (palette === undefined) problems.push('palette is missing')
  else if (!isObject(palette)) problems.push(`palette is ${shown(palette)}, not colours by name`)
  for (const [name, colour] of Object.entries(isObject(palette) ? palette : {})) {
    const path = `palette.${name}`
    if (!isObject(colour)) {
      problems.push(`${path} is ${shown(colour)}, not a colour with a base`)
      continue
    }
    const { base, steps = {}, ...unknown } = colour
    for (const key of Object.keys(unknown)) problems.push(`${path}.${key} isn’t part of a palette colour: it has a base and steps`)
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
 * theme's settings, in kebab case: `status.live.color` is --status-live-color, `spacing.l` is
 * --spacing-l and `placeNames.city.font` gives --place-names-city-font-family, -weight and -style.
 * Sizes are written in pixels ("12px"), and on or off as 1 or 0.
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
      for (const [key, inner] of Object.entries(schema)) walk(inner, values[key], `${name}-${kebabCase(key)}`)
    }
  }
  walk(settings, theme, '-')
  return properties
}

const kebabCase = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
