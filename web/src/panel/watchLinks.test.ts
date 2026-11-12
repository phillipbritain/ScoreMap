import { describe, expect, it } from 'vitest'
import type { GameBroadcaster } from '../games/game'
import { listedWatchLinks, viewerCountry, watchLinks } from './watchLinks'

const prime: GameBroadcaster = { name: 'Prime Video', country: 'US', watchUrl: 'https://www.amazon.com/primevideo' }

describe('watchLinks', () => {
  it('links a broadcaster that has a watch link', () => {
    expect(watchLinks([prime], 'US')).toEqual([{ name: 'Prime Video', url: 'https://www.amazon.com/primevideo' }])
  })

  it("hides broadcasts for another country than the viewer's", () => {
    const sky: GameBroadcaster = { name: 'Sky Sports', country: 'GB', watchUrl: 'https://www.skysports.com/watch' }

    expect(watchLinks([prime, sky], 'GB')).toEqual([{ name: 'Sky Sports', url: 'https://www.skysports.com/watch' }])
  })

  it("lists every linked broadcast when none is for the viewer's country", () => {
    const tsn: GameBroadcaster = { name: 'TSN', country: 'CA', watchUrl: 'https://www.tsn.ca/watch' }

    expect(watchLinks([prime, tsn], 'DE')).toEqual([
      { name: 'Prime Video', url: 'https://www.amazon.com/primevideo' },
      { name: 'TSN', url: 'https://www.tsn.ca/watch' },
    ])
  })

  it('keeps broadcasts whose country the data leaves out', () => {
    const tsn: GameBroadcaster = { name: 'TSN', country: null, watchUrl: 'https://www.tsn.ca/watch' }

    expect(watchLinks([tsn], 'CA')).toEqual([{ name: 'TSN', url: 'https://www.tsn.ca/watch' }])
  })

  it("keeps every broadcast when the viewer's country is unknown", () => {
    expect(watchLinks([prime], null)).toEqual([{ name: 'Prime Video', url: 'https://www.amazon.com/primevideo' }])
  })

  it('omits broadcasters with missing or blank watch URLs', () => {
    const unlinked = [null, '', '   '].map((watchUrl) => ({ name: 'DAZN', country: 'US', watchUrl }))

    expect(watchLinks([...unlinked, prime], 'US')).toEqual([
      { name: 'Prime Video', url: 'https://www.amazon.com/primevideo' },
    ])
    expect(watchLinks(unlinked, 'US')).toEqual([])
  })

  it('does not let an unlinked duplicate hide the linked broadcaster', () => {
    expect(watchLinks([{ ...prime, watchUrl: null }, prime], 'US')).toEqual([
      { name: 'Prime Video', url: 'https://www.amazon.com/primevideo' },
    ])
  })

  it('keeps country restrictions when local broadcasts have no watch URL', () => {
    expect(watchLinks([prime, { name: 'DAZN', country: 'GB', watchUrl: null }], 'GB')).toEqual([])
  })

  it('matches countries whatever their case', () => {
    expect(watchLinks([{ ...prime, country: 'us' }], 'US')).toHaveLength(1)
  })

  it('lists a broadcaster once even when the data repeats it', () => {
    expect(watchLinks([prime, { ...prime }], 'US')).toEqual([{ name: 'Prime Video', url: 'https://www.amazon.com/primevideo' }])
  })
})

describe('viewerCountry', () => {
  it("takes the country from the viewer's first locale that names one", () => {
    expect(viewerCountry(['en', 'en-GB', 'en-US'])).toBe('GB')
  })

  it('is unknown when no locale names a country', () => {
    expect(viewerCountry(['en', 'fr'])).toBeNull()
  })
})
describe('listedWatchLinks', () => {
  it('lists up to two links', () => {
    expect(listedWatchLinks(['a', 'b'])).toEqual({ listed: ['a', 'b'], folded: [] })
  })

  it('folds the links after the second, in order', () => {
    expect(listedWatchLinks(['a', 'b', 'c', 'd'])).toEqual({ listed: ['a', 'b'], folded: ['c', 'd'] })
  })
})
