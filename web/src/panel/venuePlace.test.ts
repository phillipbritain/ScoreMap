import { describe, expect, it } from 'vitest'
import { venuePlace } from './venuePlace'

describe('venuePlace', () => {
  it("names the venue's city within its region when it has one", () => {
    expect(venuePlace({ city: 'Glendale', region: 'Arizona', country: 'USA' })).toBe('Glendale, Arizona')
  })

  it("names the venue's city within its country when it has no region", () => {
    expect(venuePlace({ city: 'London', region: null, country: 'England' })).toBe('London, England')
  })

  it('leaves out whatever is missing', () => {
    expect(venuePlace({ city: null, region: null, country: 'Spain' })).toBe('Spain')
    expect(venuePlace({ city: null, region: null, country: null })).toBe('')
  })
})
