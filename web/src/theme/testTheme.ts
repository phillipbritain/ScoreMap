import builtIn from './builtInTheme.json'
import { resolveTheme, type Theme } from './theme'

/**
 * For tests: the built-in theme with these changes made to its JSON (none unless given), resolved as
 * any theme is. Throws with the theme's problems if the changes leave it unresolvable.
 */
export function themeWith(change: (json: Record<string, any>) => void = () => {}): Theme {
  const json = structuredClone(builtIn) as Record<string, any>
  change(json)
  const result = resolveTheme(json)
  if (!result.ok) throw new Error(result.problems.join('\n'))
  return result.theme
}
