import { describe, expect, it } from 'vitest'
import { listedWatchLinks } from './watchLinks'

describe('listedWatchLinks', () => {
  it('lists up to two links', () => {
    expect(listedWatchLinks(['a', 'b'])).toEqual({ listed: ['a', 'b'], folded: [] })
  })

  it('folds the links after the second, in order', () => {
    expect(listedWatchLinks(['a', 'b', 'c', 'd'])).toEqual({ listed: ['a', 'b'], folded: ['c', 'd'] })
  })
})
