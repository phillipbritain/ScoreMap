import { customProperties, type Theme } from './theme'

/**
 * Writes the resolved theme to CSS custom properties on the page's root, so the page's CSS can read
 * any setting (see customProperties for their names and values).
 */
export function applyTheme(root: { style: Pick<CSSStyleDeclaration, 'setProperty'> }, theme: Theme): void {
  for (const [name, value] of customProperties(theme)) root.style.setProperty(name, value)
}
