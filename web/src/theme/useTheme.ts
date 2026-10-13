import { useLayoutEffect, useState } from 'react'
import { applyTheme } from './applyTheme'
import type { Theme } from './theme'

/**
 * The app's theme, starting in `start`, and the one way to change it as the app runs. Each theme is
 * written to the page's root for its CSS (see applyTheme) before the page paints, and handed down to
 * the globe, which restyles itself in place (see GlobeMap.setTheme): nothing is made again.
 */
export function useTheme(start: Theme): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState(start)
  // Before the globe's own effects, which measure score cards drawn by the page's CSS.
  useLayoutEffect(() => applyTheme(document.documentElement, theme), [theme])
  return [theme, setTheme]
}
