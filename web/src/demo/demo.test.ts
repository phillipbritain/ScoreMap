import { describe, expect, it } from 'vitest'
import { isDemo } from './demo'

describe('isDemo', () => {
  it('opens a demo for a link with demo in its query, whatever its value', () => {
    expect(isDemo('?demo')).toBe(true)
    expect(isDemo('?demo=1')).toBe(true)
    expect(isDemo('?demo=false')).toBe(true)
    expect(isDemo('?utm_source=x&demo')).toBe(true)
  })

  it('opens the real games otherwise', () => {
    expect(isDemo('')).toBe(false)
    expect(isDemo('?demos=1')).toBe(false)
    expect(isDemo('?x=demo')).toBe(false)
  })
})
