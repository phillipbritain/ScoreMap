import { describe, expect, it } from 'vitest'
import type { GameBroadcaster } from '../games/game'
import { viewerCountry, watchLinks } from './watchLinks'

const prime: GameBroadcaster = { name: 'Prime Video', country: 'US', watchUrl: 'https://www.amazon.com/primevideo' }

describe('watchLinks', () => {
  it('links a broadcaster that has a watch link', () => {
    expect(watchLinks([prime], 'US')).toEqual([{ name: 'Prime Video', url: 'https://www.amazon.com/primevideo' }])
  })

  it("hides broadcasts for another country than the viewer's", () => {
    const sky: GameBroadcaster = { name: 'Sky Sports', country: 'GB', watchUrl: null }

    expect(watchLinks([prime, sky], 'GB')).toEqual([{ name: 'Sky Sports', url: null }])
  })

  it('keeps broadcasts whose country the data leaves out', () => {
    const tsn: GameBroadcaster = { name: 'TSN', country: null, watchUrl: null }

    expect(watchLinks([tsn], 'CA')).toEqual([{ name: 'TSN', url: null }])
  })

  it("keeps every broadcast when the viewer's country is unknown", () => {
    expect(watchLinks([prime], null)).toEqual([{ name: 'Prime Video', url: 'https://www.amazon.com/primevideo' }])
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