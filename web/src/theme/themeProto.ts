// PROTOTYPE, throwaway: five color schemes for the whole app, switchable with `?themeProto=` (A to E)
// and the bar that `[` and `]` cycle (ThemeProtoSwitcher). Each is the built-in theme with its colors
// and color jobs changed, so a chosen one becomes a change to builtInTheme.json. The one setting the
// theme has no room for yet, the sea's own color (today land and sea are one), rides beside it here.
import json from './builtInTheme.json'
import { paletteSteps, type StepName } from './palette'
import { resolveTheme, type Theme } from './theme'

type Json = Record<string, unknown>

function merged(base: Json, over: Json): Json {
  const out: Json = { ...base }
  for (const [key, value] of Object.entries(over)) {
    const was = out[key]
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) && was && typeof was === 'object' && !Array.isArray(was)
        ? merged(was as Json, value as Json)
        : value
  }
  return out
}

interface Spec {
  key: string
  name: string
  /** Replaces the theme's colors outright. */
  colors: Json
  /** The sea's color, or undefined for land and sea alike. */
  ocean?: string
  over: Json
}

const statusOf = (c: string) => ({ main: `${c}.500`, light: `${c}.300`, dark: `${c}.700` })
const errors = {
  red: { base: '#cd2435' },
  orange: { base: '#e56335' },
}

/** The color jobs that name steps rather than the palette, so each scheme sets them all. */
function jobs(j: {
  states: string
  disputed: string
  haloInner: string
  haloOuter: string
  city: string
  state: string
  country: string
  outline: string
  stars: [string, string, string]
  liveCore: string
  plate: string
  scoreFill: string
  photoGlow: string
  onFill: string
  onText: string
}): Json {
  return {
    Globe: {
      stateLines: { color: j.states },
      disputedBorders: { color: j.disputed },
      halo: { inner: { color: j.haloInner }, outer: { color: j.haloOuter } },
    },
    PlaceNames: {
      city: { color: j.city, outline: { color: j.outline } },
      state: { color: j.state, outline: { color: j.outline } },
      country: { color: j.country, outline: { color: j.outline } },
    },
    Sky: { stars: { white: j.stars[0], cool: j.stars[1], warm: j.stars[2] } },
    Pin: { live: { core: { color: j.liveCore } } },
    ScoreCard: { logo: { plate: { fill: j.plate } } },
    GamePanel: { score: { fill: j.scoreFill }, photo: { glow: j.photoGlow }, logo: { plate: { fill: j.plate } } },
    Controls: { on: { fill: j.onFill, text: j.onText } },
  }
}

const specs: Spec[] = [
  { key: 'A', name: 'Navy and gold (today)', colors: json.colors, over: {} },
  {
    key: 'B',
    name: 'Midnight ink',
    colors: { ink: { base: '#26334a' }, cyan: { base: '#3ec6e0' }, cloud: { base: '#e8edf3' }, ...errors },
    ocean: 'ink.700',
    over: {
      palette: {
        primary: { main: 'ink.500', light: 'ink.400', dark: 'ink.600', contrastText: 'cloud.500' },
        secondary: { main: 'cyan.500', light: 'cyan.300', dark: 'cyan.700', contrastText: 'ink.800' },
        error: { contrastText: 'cloud.500' },
        warning: { contrastText: 'ink.800' },
        live: statusOf('cyan'),
        upcoming: statusOf('cyan'),
        final: statusOf('cyan'),
        background: { default: 'ink.900', paper: 'ink.700' },
        text: { primary: 'cloud.500', secondary: 'cloud.600', link: 'cyan.300' },
        divider: 'ink.500',
        action: { hover: 'ink.500' },
      },
      components: merged(
        {
          Globe: { surface: 'ink.500', coastlines: { color: 'ink.300' }, countryBorders: { color: 'ink.300' } },
          Selection: { color: 'cloud.500' },
          Tooltip: { surface: 'ink.700', outline: 'ink.500' },
          Cluster: { fill: 'ink.700' },
          ScoreCard: { fill: 'ink.700' },
          GamePanel: { scoreBlock: { top: 'ink.600', bottom: 'ink.800' } },
          Rail: { chip: { outline: 'ink.400', badge: 'ink.600' }, on: { fill: 'ink.700' } },
        },
        jobs({
          states: 'ink.400',
          disputed: 'ink.400',
          haloInner: 'cyan.700',
          haloOuter: 'ink.700',
          city: 'cloud.600',
          state: 'ink.200',
          country: 'cloud.500',
          outline: 'ink.700',
          stars: ['cloud.500', 'cyan.200', 'cloud.300'],
          liveCore: 'cyan.100',
          plate: 'cloud.500',
          scoreFill: 'ink.500',
          photoGlow: 'cyan.800',
          onFill: 'cyan.500',
          onText: 'ink.800',
        }),
      ),
    },
  },
  {
    key: 'C',
    name: 'Daylight atlas',
    colors: {
      sand: { base: '#e6dcc4' },
      sea: { base: '#7fb0cc' },
      slate: { base: '#3a4c60' },
      coral: { base: '#e0533a' },
      ...errors,
    },
    ocean: 'sea.300',
    over: {
      palette: {
        primary: { main: 'sand.500', light: 'sand.300', dark: 'sand.100', contrastText: 'slate.700' },
        secondary: { main: 'coral.500', light: 'coral.600', dark: 'coral.700', contrastText: 'sand.100' },
        error: { contrastText: 'sand.100' },
        warning: { contrastText: 'slate.800' },
        live: { main: 'coral.500', light: 'coral.400', dark: 'coral.700' },
        upcoming: { main: 'coral.500', light: 'coral.400', dark: 'coral.700' },
        final: { main: 'coral.500', light: 'coral.400', dark: 'coral.700' },
        background: { default: 'sea.200', paper: 'sand.100' },
        text: { primary: 'slate.700', secondary: 'slate.400', link: 'coral.600' },
        divider: 'sand.600',
        action: { hover: 'sand.300' },
      },
      components: merged(
        {
          Globe: { surface: 'sand.500', coastlines: { color: 'sea.600' }, countryBorders: { color: 'slate.300' } },
          Selection: { color: 'slate.800' },
          Tooltip: { surface: 'sand.100', outline: 'sand.600' },
          Cluster: { fill: 'sand.100' },
          ScoreCard: { fill: 'sand.100', shadow: 'slate.400', frost: 0.85 },
          GamePanel: {
            scoreBlock: { top: 'sand.200', bottom: 'sand.400' },
            shadow: { y: 4, blur: 18, color: 'rgba(17, 34, 51, 0.25)' },
          },
          Rail: {
            chip: { outline: 'sand.600', badge: 'sand.400' },
            on: { fill: 'sand.100', text: 'coral.600' },
            shadow: { y: 2, blur: 10, color: 'rgba(17, 34, 51, 0.2)' },
          },
          Controls: { shadow: { y: 2, blur: 10, color: 'rgba(17, 34, 51, 0.2)' } },
          LoadingScreen: { dim: { color: 'sand.100' } },
        },
        jobs({
          states: 'sand.600',
          disputed: 'slate.300',
          haloInner: 'sea.100',
          haloOuter: 'sea.300',
          city: 'slate.600',
          state: 'slate.300',
          country: 'slate.500',
          outline: 'sand.200',
          stars: ['sea.100', 'sea.100', 'sand.100'],
          liveCore: 'coral.100',
          plate: 'sand.100',
          scoreFill: 'sand.300',
          photoGlow: 'sea.300',
          onFill: 'slate.700',
          onText: 'sand.100',
        }),
      ),
    },
  },
  {
    key: 'D',
    name: 'Aurora',
    colors: {
      pine: { base: '#1f5a52' },
      mint: { base: '#4fe3a8' },
      violet: { base: '#7b5cff' },
      frost: { base: '#eefaf6' },
      ...errors,
    },
    ocean: 'pine.700',
    over: {
      palette: {
        primary: { main: 'pine.600', light: 'pine.400', dark: 'pine.700', contrastText: 'frost.500' },
        secondary: { main: 'mint.500', light: 'mint.300', dark: 'mint.700', contrastText: 'pine.800' },
        error: { contrastText: 'frost.500' },
        warning: { contrastText: 'pine.800' },
        live: statusOf('mint'),
        upcoming: statusOf('mint'),
        final: statusOf('mint'),
        background: { default: 'violet.900', paper: 'pine.800' },
        text: { primary: 'frost.500', secondary: 'frost.600', link: 'mint.300' },
        divider: 'pine.600',
        action: { hover: 'pine.600' },
      },
      components: merged(
        {
          Globe: { surface: 'pine.500', coastlines: { color: 'pine.300' }, countryBorders: { color: 'pine.300' } },
          Selection: { color: 'frost.500' },
          Tooltip: { surface: 'pine.800', outline: 'pine.500' },
          Cluster: { fill: 'pine.800' },
          ScoreCard: { fill: 'pine.800' },
          GamePanel: { scoreBlock: { top: 'pine.700', bottom: 'violet.800' } },
          Rail: { chip: { outline: 'pine.500', badge: 'pine.700' }, on: { fill: 'pine.800' } },
        },
        jobs({
          states: 'pine.400',
          disputed: 'pine.400',
          haloInner: 'mint.600',
          haloOuter: 'violet.600',
          city: 'frost.600',
          state: 'pine.200',
          country: 'mint.200',
          outline: 'pine.800',
          stars: ['frost.500', 'mint.200', 'violet.200'],
          liveCore: 'mint.100',
          plate: 'frost.500',
          scoreFill: 'pine.600',
          photoGlow: 'violet.700',
          onFill: 'mint.500',
          onText: 'pine.800',
        }),
      ),
    },
  },
  {
    key: 'E',
    name: 'Neon night',
    colors: {
      plum: { base: '#43215f' },
      magenta: { base: '#ff3fa4' },
      neon: { base: '#2de2ff' },
      haze: { base: '#f3eafc' },
      ...errors,
    },
    ocean: 'plum.700',
    over: {
      palette: {
        primary: { main: 'plum.500', light: 'plum.400', dark: 'plum.700', contrastText: 'haze.500' },
        secondary: { main: 'magenta.500', light: 'magenta.300', dark: 'magenta.700', contrastText: 'plum.800' },
        error: { contrastText: 'haze.500' },
        warning: { contrastText: 'plum.800' },
        live: statusOf('neon'),
        upcoming: statusOf('neon'),
        final: statusOf('neon'),
        background: { default: 'plum.900', paper: 'plum.800' },
        text: { primary: 'haze.500', secondary: 'haze.600', link: 'neon.300' },
        divider: 'plum.600',
        action: { hover: 'plum.600' },
      },
      components: merged(
        {
          Globe: { surface: 'plum.500', coastlines: { color: 'magenta.600' }, countryBorders: { color: 'magenta.700' } },
          Selection: { color: 'haze.500' },
          Tooltip: { surface: 'plum.800', outline: 'plum.500' },
          Cluster: { fill: 'plum.800' },
          ScoreCard: { fill: 'plum.800' },
          GamePanel: { scoreBlock: { top: 'plum.600', bottom: 'plum.800' } },
          Rail: { open: 'neon.500', chip: { outline: 'plum.400', badge: 'plum.600' }, on: { fill: 'plum.800' } },
        },
        jobs({
          states: 'plum.300',
          disputed: 'magenta.700',
          haloInner: 'magenta.600',
          haloOuter: 'neon.800',
          city: 'haze.600',
          state: 'plum.200',
          country: 'magenta.200',
          outline: 'plum.800',
          stars: ['haze.500', 'neon.200', 'magenta.200'],
          liveCore: 'neon.100',
          plate: 'haze.500',
          scoreFill: 'plum.600',
          photoGlow: 'magenta.700',
          onFill: 'neon.500',
          onText: 'plum.800',
        }),
      ),
    },
  },
]

const oceans = new WeakMap<Theme, string>()

/** The sea's color in a prototype scheme, or undefined for land and sea alike. */
export function oceanColor(theme: Theme): string | undefined {
  return oceans.get(theme)
}

export interface ProtoTheme {
  key: string
  name: string
  theme: Theme
}

export const protoThemes: ProtoTheme[] = specs.map(({ key, name, colors, ocean, over }) => {
  const result = resolveTheme(merged({ ...json, colors }, over))
  if (!result.ok) throw new Error(`Prototype theme ${key} has problems:\n${result.problems.join('\n')}`)
  if (ocean) oceans.set(result.theme, resolveStep(colors, ocean))
  return { key, name, theme: result.theme }
})

function resolveStep(colors: Json, step: string): string {
  const [color, name] = step.split('.')
  const { base } = colors[color] as { base: string }
  return paletteSteps(base)[name as StepName]
}

export const param = 'themeProto'

/** The scheme the URL names, or undefined for none (the built-in theme). */
export function protoThemeFromUrl(): Theme | undefined {
  const key = new URLSearchParams(location.search).get(param)
  return protoThemes.find((t) => t.key === key)?.theme
}
