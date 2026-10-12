import { afterEach, describe, expect, it } from 'vitest'
import { readCssDeclarations, type CssDeclaration } from './cssDeclarations.ts'

const added: HTMLElement[] = []

afterEach(() => {
  for (const element of added.splice(0)) element.remove()
  document.documentElement.removeAttribute('style')
})

/** Puts a stylesheet on the page, as Vite does with the app's CSS in a dev run. */
function stylesheet(css: string): void {
  const style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  added.push(style)
}

/** What the page's stylesheets say for a rule, by property. */
function declarationsOf(rule: string): Record<string, string> {
  const found = readCssDeclarations().filter((declaration: CssDeclaration) => declaration.rule === rule)
  return Object.fromEntries(found.map(({ property, value }) => [property, value]))
}

describe('readCssDeclarations', () => {
  it("gives each declaration's value with the theme's custom properties filled in", () => {
    // The theme puts its values on the root element, as applyTheme does.
    document.documentElement.style.setProperty('--space-2', '6px')
    document.documentElement.style.setProperty('--accent', '#d4ac63')
    stylesheet('.probe-card { padding: var(--space-2) calc(var(--space-2) + 1px); color: var(--accent) }')

    expect(declarationsOf('.probe-card')).toMatchObject({
      'padding-top': '6px',
      'padding-left': '7px',
      color: 'rgb(212, 172, 99)',
    })
  })

  it('takes in hover and pressed states, keyframes and media queries', () => {
    stylesheet(`
      .probe-key:hover { opacity: 0.8 }
      .probe-key:active { transform: scale(0.9) }
      @keyframes probe-glow { 50% { opacity: 0.5 } }
      @media (max-width: 600px) { .probe-panel { padding-top: 3px } }
    `)

    expect(declarationsOf('.probe-key:hover')).toEqual({ opacity: '0.8' })
    expect(declarationsOf('.probe-key:active')).toEqual({ transform: 'matrix(0.9, 0, 0, 0.9, 0, 0)' })
    expect(declarationsOf('@keyframes probe-glow › 50%')).toEqual({ opacity: '0.5' })
    expect(declarationsOf('@media (max-width: 600px) › .probe-panel')).toEqual({ 'padding-top': '3px' })
  })

  it("gives a border's width even where the rule doesn't set its style", () => {
    stylesheet('.probe-ring { border-top-width: 2px }')

    expect(declarationsOf('.probe-ring')).toEqual({ 'border-top-width': '2px' })
  })

  it("resolves a custom property set in the same rule, and lists the custom property's value", () => {
    stylesheet('.probe-light { --glow: 4px; box-shadow: 0 0 var(--glow) red }')

    expect(declarationsOf('.probe-light')).toEqual({ '--glow': '4px', 'box-shadow': 'rgb(255, 0, 0) 0px 0px 4px 0px' })
  })

  it("lists the theme's custom properties on the root element", () => {
    document.documentElement.style.setProperty('--accent', '#d4ac63')

    expect(declarationsOf(':root (theme)')).toMatchObject({ '--accent': '#d4ac63' })
  })

  it('gives every value of a property set by the same rule more than once, in order', () => {
    stylesheet('.probe-twice { color: red } .probe-twice { color: blue }')

    expect(declarationsOf('.probe-twice')).toEqual({ color: 'rgb(255, 0, 0), then rgb(0, 0, 255)' })
  })
})
