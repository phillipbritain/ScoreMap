// PROTOTYPE, throwaway: color schemes for the whole app, switchable with `?themeProto=` (F, O, P;
// F with none) and the bar that `[` and `]` cycle (ThemeProtoSwitcher). Each is the built-in theme
// with its color jobs changed, so a chosen one becomes a change to builtInTheme.json. The one setting
// the theme has no room for yet, the sea's own color (today land and sea are one), rides beside it here.
// The earlier rounds (A-E, G-N) are in this branch's history.
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
  colors: Json
  /** The sea's color: a step or a hex color. */
  ocean: string
  over: Json
}

const outline = (color: string): Json => ({
  PlaceNames: { city: { outline: { color } }, state: { outline: { color } }, country: { outline: { color } } },
})

// F: today's navy and gold with a darker globe (land a step darker, the sea darker again) and
// brighter, wider map lines, so the globe reads behind score cards.
const f: Spec = {
  key: 'F',
  name: 'Navy darker',
  colors: json.colors,
  ocean: 'navy.800',
  over: {
    components: merged(
      {
        Globe: {
          surface: 'navy.600',
          coastlines: { color: 'navy.200', width: { '2': 0.9, '8': 1.6 } },
          countryBorders: { color: 'navy.200', width: { '2': 0.9, '8': 1.8 } },
          stateLines: { color: 'navy.300', width: { '3': 0.6, '8': 1.2 } },
          disputedBorders: { color: 'navy.300' },
        },
      },
      outline('navy.800'),
    ),
  },
}

const specs: Spec[] = [
  f,
  // F with a lighter sea.
  { ...f, key: 'O', name: 'F, sea a little lighter', ocean: '#071a3c' },
  { ...f, key: 'P', name: 'F, lighter sea', ocean: 'navy.700' },
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
  oceans.set(result.theme, resolveStep(colors, ocean))
  return { key, name, theme: result.theme }
})

function resolveStep(colors: Json, step: string): string {
  if (step.startsWith('#')) return step
  const [color, name] = step.split('.')
  const { base } = colors[color] as { base: string }
  return paletteSteps(base)[name as StepName]
}

export const param = 'themeProto'

/** The scheme the URL names, or the first (F) for none. */
export function protoThemeFromUrl(): Theme {
  const key = new URLSearchParams(location.search).get(param)
  return (protoThemes.find((t) => t.key === key) ?? protoThemes[0]).theme
}
