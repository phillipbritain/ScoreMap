import { describe, expect, it } from 'vitest'
import { mapsSearchUrl, venuePlace } from './venuePlace'

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

describe('mapsSearchUrl', () => {
  it('searches Google Maps for the place', () => {
    expect(mapsSearchUrl('Wembley Stadium, London, England')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Wembley%20Stadium%2C%20London%2C%20England',
    )
  })

  it('escapes characters that mean something in a web address', () => {
    expect(mapsSearchUrl('AT&T Stadium')).toBe('https://www.google.com/maps/search/?api=1&query=AT%26T%20Stadium')
  })
})
