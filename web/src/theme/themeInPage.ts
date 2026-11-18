import { builtInTheme } from './builtInTheme'
import { customProperties, type Theme } from './theme'

/**
 * The page's own style for its first paint, before any script has run: the theme's custom properties
 * on the page's root (as applyTheme writes them once the app starts), and the theme's background
 * behind everything, so the page opens in the theme rather than flashing white. Written into
 * index.html as it's served and built (see vite.config.ts).
 */
export function themeInPage(theme: Theme = builtInTheme): string {
  const properties = [...customProperties(theme)].map(([name, value]) => `${name}: ${value};`).join(' ')
  return `:root { ${properties} } html { background: var(--palette-background-default); }`
}
