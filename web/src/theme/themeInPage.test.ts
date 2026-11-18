import { describe, expect, it } from 'vitest'
import { builtInTheme } from './builtInTheme'
import { customProperties } from './theme'
import { themeInPage } from './themeInPage'

describe('themeInPage', () => {
  it("gives the page, before any script runs, every custom property the app writes once it starts", () => {
    const style = themeInPage(builtInTheme)
    for (const [name, value] of customProperties(builtInTheme)) expect(style).toContain(`${name}: ${value};`)
  })

  it("puts the theme's background behind the whole page, so its first paint isn't white", () => {
    expect(themeInPage(builtInTheme)).toContain('html { background: var(--palette-background-default); }')
  })
})
