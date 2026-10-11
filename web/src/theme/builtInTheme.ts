import json from './builtInTheme.json'
import { resolveTheme, type Theme } from './theme'

function resolveBuiltIn(): Theme {
  const result = resolveTheme(json)
  // Its test keeps this from happening in a build.
  if (!result.ok) throw new Error(`The built-in theme has problems:\n${result.problems.join('\n')}`)
  return result.theme
}

/**
 * The theme bundled into the app, resolved as the app starts so the first paint is themed with no
 * wait on the network.
 */
export const builtInTheme: Theme = resolveBuiltIn()
