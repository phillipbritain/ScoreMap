import { globeFonts, type GlobeFont } from './globeFonts'
import { isHexColor, paletteSteps, stepNames, type StepName } from './palette'

/** What resolving a theme's settings reads from, and where it notes each problem it finds. */
interface Resolving {
  /** Every palette step, by its name in a colour job, such as "navy.700". */
  steps: ReadonlyMap<string, string>
  problems: string[]
}

/** One setting of a theme: how to read its value from the theme's JSON. */
interface Setting<T> {
  resolve(value: unknown, path: string, resolving: Resolving): T | undefined
}

/** A colour job: a palette step by name ("navy.700"), or a colour given directly ("#0b1526"). */
const color: Setting<string> = {
  resolve(value, path, { steps, problems }) {
    const job = String(value)
    if (isColor(job)) return job
    const step = steps.get(job)
    if (step === undefined) problems.push(`${path} names "${job}", a step the palette doesn’t have`)
    return step
  },
}

/** Whether a colour job gives a colour directly, as a CSS colour such as "#0b1526" or "rgb(…)", rather than naming a step. */
const isColor = (job: string) => /^(#|[a-z]+\()/i.test(job)

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

/** A size in pixels. */
const pixels = numberFrom(0, Infinity, 'a number of pixels')
const opacity = numberFrom(0, 1, 'an opacity from 0 to 1')

/** A kind of place's name on the globe: its colour, the outline around its letters, and its font. */
const placeName = { color, outline: color, font: globeFont }

/**
 * How a game's status looks on the globe, alike on small pins, score cards and clusters: its colour,
 * the small pin's bright core (its colour, radius, opacity, and the width of the ring of status colour
 * around it) and the soft glow around that (its radius, out to where it has faded to nothing, and its
 * opacity at the middle), and how opaque a cluster showing as this status is.
 */
const statusLook = {
  color,
  core: { color, radius: pixels, opacity, ring: pixels },
  glow: { radius: pixels, opacity },
  clusterOpacity: opacity,
}

/** Every setting a theme has, by where it sits in the theme's settings. */
const settings = {
  globe: {
    surface: color,
    coastlines: color,
    countryBorders: color,
    stateLines: color,
    disputedBorders: color,
    halo: { inner: color, outer: color },
  },
  placeNames: { city: placeName, capital: placeName, state: placeName, country: placeName },
  status: { live: statusLook, upcoming: statusLook, final: statusLook, disrupted: statusLook },
  /**
   * A cluster, pin or card, is a disc filled with this, outlined this wide and lit in its status's
   * colour, with a glow this much of its opacity.
   */
  cluster: { fill: color, outlineWidth: pixels, glowOpacity: opacity },
  /** The selected game's small pin ring and score card outline. */
  selection: color,
  /** Behind the globe: the page itself, and the sky around the globe with its scattering of stars, white, cool and warm. */
  page: { background: color, sky: color, stars: { white: color, cool: color, warm: color } },
  /**
   * Text on the game panel, the settings menu and the scenario controls: main text, secondary text
   * (the lines under a venue or time), the accent (the game panel's league and labels, the settings
   * gear, league chips) and links.
   */
  text: { main: color, secondary: color, accent: color, link: color },
  /** The lines between a menu's parts. */
  divider: color,
  /** Behind a control under the pointer. */
  hover: color,
  /**
   * The scenario pill, the speed keys, the scenario clock and the "No games right now." message: their
   * surface and drop shadow, and a speed key that's on.
   */
  controls: { surface: color, shadow: color, on: { fill: color, text: color } },
  /**
   * A score card: its fill and text, a Disrupted game's, and the drop shadow a starting game's card
   * settles with. Its outline, header, light and glow are its status's colour.
   */
  card: { fill: color, text: color, disrupted: { fill: color, text: color }, shadow: color },
  /**
   * The game panel: its surface and the score block's, each shading from top to bottom, a team's score,
   * unofficial stream links, the glow where the venue's photo goes, the photo's credit, the close
   * button and the panel's drop shadow. Its top edge is the game's status colour.
   */
  panel: {
    surface: { top: color, bottom: color },
    scoreBlock: { top: color, bottom: color },
    score: { fill: color, text: color },
    unofficial: color,
    photo: color,
    credit: { fill: color, text: color },
    close: color,
    shadow: color,
  },
  /**
   * The settings menu: its surface and drop shadow, the dark outline around the gear, a tab that's off,
   * the count of a sport's leagues that are on, the hint beside "All leagues", a league chip's outline
   * and the badge counting leagues, and a tab or chip that's on.
   */
  settingsMenu: {
    surface: color,
    shadow: color,
    gearOutline: color,
    tab: color,
    count: color,
    hint: color,
    chip: { outline: color, badge: color },
    on: { fill: color, text: color },
  },
}

type Resolved<S> = S extends Setting<infer T> ? T : { readonly [K in keyof S]: Resolved<S[K]> }

/** A theme, resolved from its JSON: every setting's value, ready to use. */
export type Theme = Resolved<typeof settings>

export type ThemeResult = { ok: true; theme: Theme } | { ok: false; problems: string[] }

interface ThemeJson {
  palette: Record<string, { base: string; steps?: Partial<Record<StepName, string>> }>
  settings: unknown
}

/** Reads a theme from its parsed JSON. */
export function resolveTheme(json: unknown): ThemeResult {
  const { palette, settings: values } = json as ThemeJson
  const problems: string[] = []
  const resolving: Resolving = { steps: paletteByStep(palette, problems), problems }
  const theme = resolveAll(settings, values, 'settings', resolving) as Theme
  return problems.length ? { ok: false, problems } : { ok: true, theme }
}

/** Every step of the palette's colours, by its name in a colour job; a colour with problems has none. */
function paletteByStep(palette: ThemeJson['palette'] | undefined, problems: string[]): Map<string, string> {
  const byStep = new Map<string, string>()
  if (palette === undefined) problems.push('palette is missing')
  for (const [name, { base, steps = {} }] of Object.entries(palette ?? {})) {
    const before = problems.length
    if (!isHexColor(base)) problems.push(`palette.${name}.base is "${base}", not a #rrggbb colour`)
    for (const [step, value] of Object.entries(steps)) {
      if (!(stepNames as readonly string[]).includes(step)) {
        problems.push(`palette.${name}.steps.${step} isn’t a step: steps are ${stepNames[0]} to ${stepNames.at(-1)}`)
      } else if (!isHexColor(value)) problems.push(`palette.${name}.steps.${step} is "${value}", not a #rrggbb colour`)
    }
    if (problems.length > before) continue
    for (const [step, value] of Object.entries(paletteSteps(base, steps))) byStep.set(`${name}.${step}`, value)
  }
  return byStep
}

function isSetting(schema: unknown): schema is Setting<unknown> {
  return typeof (schema as Setting<unknown>).resolve === 'function'
}

function resolveAll(schema: object, value: unknown, path: string, resolving: Resolving): unknown {
  if (value === undefined) {
    resolving.problems.push(`${path} is missing`)
    return undefined
  }
  if (isSetting(schema)) return schema.resolve(value, path, resolving)
  const values = value as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(schema).map(([key, inner]) => [key, resolveAll(inner, values[key], `${path}.${key}`, resolving)]),
  )
}
