/**
 * A draft of the theme's JSON being tuned in the theme tuner (see ThemeTuner): reading and changing
 * its settings, stepping a colour job lighter or darker through its palette colour's steps, and
 * listing what differs from the built-in theme. Local runs only.
 */
import { paletteSteps, stepNames, type StepName } from '../theme/palette'

export type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json }
export type JsonObject = { readonly [key: string]: Json }

/** A theme's JSON: its palette and its settings. */
export interface ThemeJson {
  readonly palette: JsonObject
  readonly settings: JsonObject
}

/** Where a setting sits in a theme's settings, key by key: ["trail", "glow", "width"]. */
export type SettingPath = readonly string[]

const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function settingAt(json: ThemeJson, path: SettingPath): Json | undefined {
  let value: Json | undefined = json.settings
  for (const key of path) value = isObject(value) ? value[key] : undefined
  return value
}

/** The theme with one setting changed, the rest left as they are. */
export function withSetting(json: ThemeJson, path: SettingPath, value: Json): ThemeJson {
  const set = (inside: Json | undefined, [key, ...rest]: SettingPath): Json =>
    key === undefined ? value : { ...(isObject(inside) ? inside : {}), [key]: set(isObject(inside) ? inside[key] : undefined, rest) }
  return { ...json, settings: set(json.settings, path) as JsonObject }
}

/** A palette colour's steps, lightest first, as colours. */
export interface PaletteColour {
  name: string
  steps: Record<StepName, string>
}

export function paletteColours(json: ThemeJson): PaletteColour[] {
  return Object.entries(json.palette).flatMap(([name, colour]) => {
    if (!isObject(colour) || typeof colour.base !== 'string') return []
    const handSet = isObject(colour.steps) ? (colour.steps as Partial<Record<StepName, string>>) : {}
    try {
      return [{ name, steps: paletteSteps(colour.base, handSet) }]
    } catch {
      return []
    }
  })
}

const stepJob = /^([A-Za-z]\w*)\.(\d00)$/

/** A colour job naming a palette step ("navy.700"), as its colour and step; null for a colour given directly. */
export function stepOfJob(job: string): { colour: string; step: StepName } | null {
  const match = stepJob.exec(job)
  return match && (stepNames as readonly string[]).includes(match[2]) ? { colour: match[1], step: match[2] as StepName } : null
}

/**
 * The colour job `by` steps darker (or lighter, if negative) in the same palette colour, stopping at
 * its lightest and darkest. A colour given directly stays as it is.
 */
export function shiftedJob(job: string, by: number): string {
  const named = stepOfJob(job)
  if (!named) return job
  const i = Math.min(stepNames.length - 1, Math.max(0, stepNames.indexOf(named.step) + by))
  return `${named.colour}.${stepNames[i]}`
}

/** One setting the draft has changed from the built-in theme. */
export interface Change {
  path: SettingPath
  from: Json | undefined
  to: Json | undefined
}

/** Every setting that differs between two themes, a size by zoom or a dash pattern counting as one. */
export function changes(from: ThemeJson, to: ThemeJson): Change[] {
  const found: Change[] = []
  const walk = (a: Json | undefined, b: Json | undefined, path: SettingPath) => {
    if (isObject(a) && isObject(b) && !isLeafGroup(path)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], [...path, key])
    } else if (JSON.stringify(a) !== JSON.stringify(b)) found.push({ path, from: a, to: b })
  }
  walk(from.settings, to.settings, [])
  return found
}

/** Settings whose value is a group of numbers by zoom, read as one: `globe.coastlines.width`, `placeNames.city.size`. */
function isLeafGroup(path: SettingPath): boolean {
  const last = path.at(-1)
  return (path[0] === 'globe' && last === 'width') || (path[0] === 'placeNames' && last === 'size')
}

/** The changes as lines to read or paste: `trail.width: 1.25 → 2`. */
export function describeChanges(list: readonly Change[]): string {
  return list.map(({ path, from, to }) => `${path.join('.')}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`).join('\n')
}

/** What a scale-step setting is a step of, if it's one: a corner of the radius scale, a place name's size of the text sizes. */
export function scaleOf(path: SettingPath): 'textSizes' | 'spacing' | 'radii' | null {
  if (path[0] === 'corners') return 'radii'
  if (path[0] === 'cutCorner' && path[1] === 'size') return 'spacing'
  if (path[0] === 'placeNames' && path[2] === 'size') return 'textSizes'
  if (path[0] === 'fonts' && path[1] === 'clusterCount' && path[2] === 'size') return 'textSizes'
  return null
}

const fractions = new Set(['opacity', 'fade', 'headerTint', 'clusterOpacity', 'glowOpacity', 'share'])
const emSizes = new Set(['scoreWidth', 'countWidth', 'mark'])

/** The range a number setting's slider covers, from what it is in the built-in theme. */
export function numberRange(path: SettingPath, builtIn: number): { min: number; max: number; step: number } {
  const last = path.at(-1) ?? ''
  if (fractions.has(last)) return { min: 0, max: 1, step: 0.01 }
  if (path[0] === 'letterSpacing' || last === 'letterSpacing') return { min: -0.1, max: 0.4, step: 0.01 }
  if (emSizes.has(last)) return { min: 0, max: 6, step: 0.1 }
  if (last === 'weight') return { min: 100, max: 900, step: 50 }
  if (last === 'x' || last === 'y') return { min: -40, max: 40, step: 1 }
  return { min: 0, max: Math.max(10, Math.ceil(builtIn * 3)), step: builtIn >= 20 ? 1 : builtIn >= 4 ? 0.25 : 0.05 }
}

/** A part of the theme the tuner shows together, under one tab. */
export interface TunerTab {
  name: string
  paths: readonly SettingPath[]
}

const statuses = ['live', 'upcoming', 'final', 'disrupted']

/**
 * The tuner's tabs, by what they change on screen. A setting may show under more than one; Page has
 * whatever the others don't, so every setting can be tuned.
 */
export function tunerTabs(json: ThemeJson): TunerTab[] {
  const tabs: TunerTab[] = [
    { name: 'Globe', paths: [['globe'], ['page', 'sky'], ['page', 'stars']] },
    { name: 'Names', paths: [['placeNames']] },
    {
      name: 'Pins',
      paths: [
        ...statuses.flatMap((status) => [
          ['status', status, 'color'],
          ['status', status, 'core'],
          ['status', status, 'glow'],
          ['status', status, 'clusterOpacity'],
        ]),
        ['cluster'],
        ['selection'],
        ['pulse'],
        ['fonts', 'clusterCount'],
      ],
    },
    {
      name: 'Cards',
      paths: [
        ['card'],
        ...statuses.flatMap((status) => [
          ['status', status, 'color'],
          ['status', status, 'card'],
        ]),
        ['sizes', 'card'],
        ['fonts', 'card'],
        ['corners', 'card'],
        ['letterSpacing', 'cardHeader'],
      ],
    },
    { name: 'Trails', paths: [['trail']] },
    { name: 'Scales', paths: [['textSizes'], ['spacing'], ['radii'], ['strokes']] },
  ]
  const shown = tabs.flatMap((tab) => tab.paths)
  const startsWith = (path: SettingPath, start: SettingPath) => start.every((key, i) => path[i] === key)
  // Each setting or group no tab shows; a group partly shown elsewhere gives just its other parts.
  const rest = (value: Json, path: SettingPath): SettingPath[] => {
    if (shown.some((tabPath) => startsWith(path, tabPath))) return []
    if (!isObject(value) || !shown.some((tabPath) => startsWith(tabPath, path))) return [path]
    return Object.entries(value).flatMap(([key, inner]) => rest(inner, [...path, key]))
  }
  return [...tabs, { name: 'Page', paths: Object.entries(json.settings).flatMap(([key, value]) => rest(value, [key])) }]
}

const storageKey = 'scoremap.themeDraft'

/**
 * The draft saved in this browser, if it was made from this built-in theme: one made from an
 * earlier built-in theme is dropped, so a change made to the theme's JSON since isn't hidden by it.
 */
export function loadDraft(storage: Pick<Storage, 'getItem'>, builtIn: ThemeJson): ThemeJson | null {
  try {
    const saved = JSON.parse(storage.getItem(storageKey) ?? 'null') as { builtIn: ThemeJson; draft: ThemeJson } | null
    return saved && JSON.stringify(saved.builtIn) === JSON.stringify(builtIn) ? saved.draft : null
  } catch {
    return null
  }
}

/** Saves the draft in this browser, or forgets it when it's the built-in theme. */
export function saveDraft(storage: Pick<Storage, 'setItem' | 'removeItem'>, builtIn: ThemeJson, draft: ThemeJson): void {
  try {
    if (changes(builtIn, draft).length === 0) storage.removeItem(storageKey)
    else storage.setItem(storageKey, JSON.stringify({ builtIn, draft }))
  } catch {
    // The draft just won't outlast this page.
  }
}
