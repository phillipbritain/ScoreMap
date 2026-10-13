/**
 * A draft of the theme's JSON being tuned in the theme tuner (see ThemeTuner): reading and changing
 * its settings, stepping a colour job lighter or darker through its colour's steps, and listing what
 * differs from the built-in theme. Local runs only.
 */
import { paletteSteps, stepNames, type StepName } from '../theme/palette'

export type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json }
export type JsonObject = { readonly [key: string]: Json }

/** A theme's JSON: its colours, palette, typography, spacing, shape, statuses and components. */
export type ThemeJson = JsonObject

/** Where a setting sits in a theme, key by key: ["components", "Trail", "glow", "width"]. */
export type SettingPath = readonly string[]

const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function settingAt(json: ThemeJson, path: SettingPath): Json | undefined {
  let value: Json | undefined = json
  for (const key of path) value = isObject(value) ? value[key] : undefined
  return value
}

/** The theme with one setting changed, the rest left as they are. */
export function withSetting(json: ThemeJson, path: SettingPath, value: Json): ThemeJson {
  const set = (inside: Json | undefined, [key, ...rest]: SettingPath): Json =>
    key === undefined ? value : { ...(isObject(inside) ? inside : {}), [key]: set(isObject(inside) ? inside[key] : undefined, rest) }
  return set(json, path) as JsonObject
}

/** One of the theme's colours: its steps, lightest first, as colours. */
export interface ThemeColour {
  name: string
  steps: Record<StepName, string>
}

export function themeColours(json: ThemeJson): ThemeColour[] {
  return Object.entries(isObject(json.colors) ? json.colors : {}).flatMap(([name, colour]) => {
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

/**
 * A colour job naming a colour's step ("navy.700"), or one of the palette's colours ("primary.dark")
 * naming one in the theme, as that colour and step; null for a colour given directly.
 */
export function stepOfJob(job: string, json?: ThemeJson): { colour: string; step: StepName } | null {
  const role = json && settingAt(json, ['palette', ...job.split('.')])
  if (typeof role === 'string') return stepOfJob(role)
  const match = stepJob.exec(job)
  return match && (stepNames as readonly string[]).includes(match[2]) ? { colour: match[1], step: match[2] as StepName } : null
}

/**
 * The colour job `by` steps darker (or lighter, if negative) in the same colour, stopping at its
 * lightest and darkest; one of the palette's colours steps from the step it names in the theme. A
 * colour given directly stays as it is.
 */
export function shiftedJob(job: string, by: number, json?: ThemeJson): string {
  const named = stepOfJob(job, json)
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
  walk(from, to, [])
  return found
}

/**
 * Settings whose value is a group of sizes by zoom, read as one: `components.Globe.coastlines.width`,
 * `components.PlaceNames.city.size`.
 */
function isLeafGroup(path: SettingPath): boolean {
  const last = path.at(-1)
  return (path[1] === 'Globe' && last === 'width') || (path[1] === 'PlaceNames' && last === 'size')
}

/** The changes as lines to read or paste: `components.Trail.width: 1.25 → 2`. */
export function describeChanges(list: readonly Change[]): string {
  return list.map(({ path, from, to }) => `${path.join('.')}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`).join('\n')
}

/** Whether a setting is a text size on the globe, named by a type style: a place name's size, or a cluster count's. */
export function isTypeStyleSize(path: SettingPath): boolean {
  return (path[1] === 'PlaceNames' && path[3] === 'size') || (path[1] === 'Cluster' && path[2] === 'count' && path[3] === 'size')
}

const fractions = new Set(['opacity', 'fade', 'tint', 'clusterOpacity', 'glowOpacity', 'share'])
const emSizes = new Set(['scoreWidth', 'countWidth', 'mark'])

/** The range a number setting's slider covers, from what it is in the built-in theme. */
export function numberRange(path: SettingPath, builtIn: number): { min: number; max: number; step: number } {
  const last = path.at(-1) ?? ''
  if (fractions.has(last)) return { min: 0, max: 1, step: 0.01 }
  if (last === 'letterSpacing') return { min: -0.1, max: 0.4, step: 0.01 }
  if (emSizes.has(last)) return { min: 0, max: 6, step: 0.1 }
  if (last === 'fontWeight') return { min: 100, max: 900, step: 50 }
  // In spacing units, and in corner radii.
  if (path.at(-2) === 'cutCorner' && last === 'size') return { min: 0, max: 10, step: 0.5 }
  if (last === 'corner') return { min: 0, max: 6, step: 0.25 }
  if (last === 'x' || last === 'y') return { min: -40, max: 40, step: 1 }
  return { min: 0, max: Math.max(10, Math.ceil(builtIn * 3)), step: builtIn >= 20 ? 1 : builtIn >= 4 ? 0.25 : 0.05 }
}

/**
 * A part of the theme the tuner shows together, under one tab: a part of the whole theme (the palette,
 * say), or one component's own look.
 */
export interface TunerTab {
  name: string
  kind: 'theme' | 'component'
  paths: readonly SettingPath[]
}

/**
 * A component's name as the glossary writes it, from its name in the theme: ScoreCard is "Score card",
 * GamePanel "Game panel".
 */
export function componentName(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The tuner's tabs: first the parts of the whole theme (the palette, the typography, spacing and shape,
 * and each status's look), then a tab for each component, named as it is. Other has whatever those
 * don't, so every setting but the theme's colours themselves can be tuned; it's left out when there's
 * nothing in it.
 */
export function tunerTabs(json: ThemeJson): TunerTab[] {
  const components = isObject(json.components) ? Object.keys(json.components) : []
  const tabs: TunerTab[] = [
    { name: 'Palette', kind: 'theme', paths: [['palette']] },
    { name: 'Type', kind: 'theme', paths: [['typography']] },
    { name: 'Shape', kind: 'theme', paths: [['spacing'], ['shape']] },
    { name: 'Status', kind: 'theme', paths: [['status']] },
    ...components.map((key): TunerTab => ({ name: componentName(key), kind: 'component', paths: [['components', key]] })),
  ]
  const shown = tabs.flatMap((tab) => tab.paths)
  const startsWith = (path: SettingPath, start: SettingPath) => start.every((key, i) => path[i] === key)
  // Each setting or group no tab shows; a group partly shown elsewhere gives just its other parts.
  const rest = (value: Json, path: SettingPath): SettingPath[] => {
    if (shown.some((tabPath) => startsWith(path, tabPath))) return []
    if (!isObject(value) || !shown.some((tabPath) => startsWith(tabPath, path))) return [path]
    return Object.entries(value).flatMap(([key, inner]) => rest(inner, [...path, key]))
  }
  // The colours themselves aren't tuned here: a colour job picks one of their steps.
  const others = Object.entries(json)
    .filter(([key]) => key !== 'colors')
    .flatMap(([key, value]) => rest(value, [key]))
  return others.length ? [...tabs, { name: 'Other', kind: 'theme', paths: others }] : tabs
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
