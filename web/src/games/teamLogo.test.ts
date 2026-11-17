import { describe, expect, it } from 'vitest'
import { logoFailed, logoMark, shownLogo } from './teamLogo'

describe("a team's logo", () => {
  it('is shown as given', () => {
    expect(shownLogo('https://a.espncdn.com/i/teamlogos/ncaa/500/2582.png')).toBe('https://a.espncdn.com/i/teamlogos/ncaa/500/2582.png')
  })

  it('is none when the feed gives none', () => {
    expect(shownLogo(null)).toBeNull()
  })

  it("is none once it has failed to load, so the team's mark shows rather than trying it again", () => {
    logoFailed('https://a.espncdn.com/i/teamlogos/ncaa/500/2347.png')

    expect(shownLogo('https://a.espncdn.com/i/teamlogos/ncaa/500/2347.png')).toBeNull()
    expect(shownLogo('https://a.espncdn.com/i/teamlogos/ncaa/500/2582.png')).not.toBeNull()
  })
})

describe("a team's mark, in place of its logo", () => {
  it("is its abbreviation's first letter", () => {
    expect(logoMark('LCHR')).toBe('L')
  })

  it("is a capital, as for a player's short name", () => {
    expect(logoMark('j. Sinner')).toBe('J')
  })
})
