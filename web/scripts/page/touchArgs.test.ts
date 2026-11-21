import { describe, expect, it } from 'vitest'
import { defaultSwipeMs, touchArgs } from './touchArgs.ts'

describe('touchArgs', () => {
  it('taps the middle of a selector’s match, or a point given as two numbers', () => {
    expect(touchArgs('tap', ['.event-panel__team-name'])).toEqual({ kind: 'tap', at: { selector: '.event-panel__team-name' } })
    expect(touchArgs('tap', ['120', '640.5'])).toEqual({ kind: 'tap', at: { x: 120, y: 640.5 } })
  })

  it('swipes from either by (dx, dy), over the time given or the default', () => {
    expect(touchArgs('swipe', ['.event-panel', '0', '160'])).toEqual({ kind: 'swipe', at: { selector: '.event-panel' }, by: [0, 160], ms: defaultSwipeMs })
    expect(touchArgs('swipe', ['195', '700', '0', '-40', '1200'])).toEqual({ kind: 'swipe', at: { x: 195, y: 700 }, by: [0, -40], ms: 1200 })
  })

  it.each([
    ['tap', []],
    ['tap', ['.a', '.b']],
    ['tap', ['10', '20', '30']],
    ['swipe', ['.event-panel']],
    ['swipe', ['.event-panel', '0']],
    ['swipe', ['.event-panel', '0', 'down']],
    ['swipe', ['.event-panel', '0', '50', '0']],
    ['swipe', ['.event-panel', '0', '50', '500', '1']],
    ['swipe', ['10', '20', '0']],
  ])('gives nothing for %s %j, to say how it’s used', (command, args) => {
    expect(touchArgs(command, args)).toBeNull()
  })
})
