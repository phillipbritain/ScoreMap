/** One property a CSS rule sets, with the value it works out to on the page. */
export interface CssDeclaration {
  /**
   * The rule, inside its at-rules: `.score-card:hover`, `@media (max-width: 600px) › .game-panel`,
   * `@keyframes live-light › 50%`; or `:root (theme)` for the theme's custom properties.
   */
  rule: string
  /** A longhand property (`padding-left`, not `padding`), or a custom property. */
  property: string
  /**
   * The computed value, custom properties and calc() filled in, colours as rgb(); where a rule sets
   * a property more than once, each value in order, joined by ", then ".
   */
  value: string
}

/**
 * Every declaration in the page's stylesheets, hover and pressed states, keyframes and media queries
 * included, whether or not anything on the page matches it now, with the value it computes to.
 *
 * It runs in the page, sent there as its source text, so it's self-contained. Each rule's
 * declarations are computed on an unseen probe element, under the root element and so with the
 * theme's custom properties, much as the elements it styles would be. Lengths in percent resolve
 * against the probe's box rather than the real element's, alike on any page.
 */
export function readCssDeclarations(): CssDeclaration[] {
  const values = new Map<string, { rule: string; property: string; values: string[] }>()
  const add = (rule: string, property: string, value: string) => {
    const key = `${rule}\n${property}`
    const entry = values.get(key) ?? { rule, property, values: [] }
    entry.values.push(value)
    values.set(key, entry)
  }

  // Drawn, since some values (a transform) resolve only for an element with a box, but off the
  // screen and unseen, in a box the same size on any page so lengths resolve alike.
  const hidden = document.createElement('div')
  hidden.style.cssText =
    'position: fixed; left: -10000px; top: 0; width: 1000px; height: 1000px; overflow: hidden; visibility: hidden; pointer-events: none'
  const probe = document.createElement('div')
  hidden.append(probe)
  document.body.append(hidden)
  const computed = getComputedStyle(probe)

  // A border's or outline's width computes to 0 where its style is none, so give them a style the
  // rule's own declarations can still override.
  const widthsShow = 'border-style: solid; outline-style: solid; column-rule-style: solid;'
  const read = (rule: string, style: CSSStyleDeclaration) => {
    probe.style.cssText = widthsShow + style.cssText
    for (let i = 0; i < style.length; i++) {
      const property = style[i]
      add(rule, property, computed.getPropertyValue(property).trim())
    }
  }

  const walk = (rules: CSSRuleList, within: string) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSKeyframesRule) {
        for (const frame of Array.from(rule.cssRules) as CSSKeyframeRule[]) {
          read(`${within}@keyframes ${rule.name} › ${frame.keyText}`, frame.style)
        }
      } else if (rule instanceof CSSStyleRule) {
        read(within + rule.selectorText, rule.style)
        // Nested rules, as CSS nesting writes them.
        if (rule.cssRules.length) walk(rule.cssRules, `${within}${rule.selectorText} › `)
      } else if (rule instanceof CSSGroupingRule) {
        // @media, @supports, @container, @layer: named by what comes before their block.
        walk(rule.cssRules, `${within}${rule.cssText.slice(0, rule.cssText.indexOf('{')).trim()} › `)
      } else if (rule instanceof CSSFontFaceRule) {
        read(`${within}@font-face ${rule.style.getPropertyValue('font-family')}`, rule.style)
      }
    }
  }

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      // A stylesheet from another origin can't be read.
      continue
    }
    walk(rules, '')
  }
  hidden.remove()

  const root = document.documentElement
  const rootComputed = getComputedStyle(root)
  for (let i = 0; i < root.style.length; i++) {
    const property = root.style[i]
    if (property.startsWith('--')) add(':root (theme)', property, rootComputed.getPropertyValue(property).trim())
  }

  return [...values.values()].map(({ rule, property, values }) => ({ rule, property, value: values.join(', then ') }))
}
