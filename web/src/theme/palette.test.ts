import { describe, expect, it } from 'vitest'
import { textOn } from './palette'

describe('textOn', () => {
  const light = '#eeeeee'
  const dark = '#101828'

  it('is whichever of a light and a dark text colour stands out from a colour more', () => {
    expect(textOn('#fff8c0', light, dark)).toBe(dark)
    expect(textOn('#ffff00', light, dark)).toBe(dark)
    expect(textOn('#200040', light, dark)).toBe(light)
    expect(textOn('#c00000', light, dark)).toBe(light)
  })

  it("is the light one where a colour isn't #rrggbb, as its contrast can't be measured", () => {
    expect(textOn('rgba(255, 255, 255, 0.5)', light, dark)).toBe(light)
    expect(textOn('#ffff00', 'hsl(0, 0%, 90%)', dark)).toBe('hsl(0, 0%, 90%)')
  })
})
