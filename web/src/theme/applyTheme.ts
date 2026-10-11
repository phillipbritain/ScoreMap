import type { Theme } from './theme'

/**
 * Writes the resolved theme to CSS custom properties on the page's root, so the page's CSS can read
 * any setting. Each is named by where it sits in the theme's settings, in kebab case:
 * `status.live.color` is --status-live-color and `placeNames.city.font` gives
 * --place-names-city-font-family, -weight and -style. Sizes are written as plain numbers of pixels.
 */
export function applyTheme(root: { style: Pick<CSSStyleDeclaration, 'setProperty'> }, theme: Theme): void {
  for (const [name, value] of customProperties(theme, '-')) root.style.setProperty(name, value)
}

function* customProperties(value: unknown, name: string): Generator<[string, string]> {
  if (typeof value !== 'object' || value === null) {
    yield [name, String(value)]
    return
  }
  for (const [key, inner] of Object.entries(value)) yield* customProperties(inner, `${name}-${kebabCase(key)}`)
}

const kebabCase = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
