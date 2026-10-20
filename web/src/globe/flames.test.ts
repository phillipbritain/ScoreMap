import { describe, expect, it } from 'vitest'
import { showsFlames } from './flames'

describe('showsFlames', () => {
  it('shows flames on a hot game only while the viewer has them on', () => {
    expect(showsFlames(true, { hot: true })).toBe(true)
    expect(showsFlames(true, { hot: false })).toBe(false)
    expect(showsFlames(false, { hot: true })).toBe(false)
  })
})
