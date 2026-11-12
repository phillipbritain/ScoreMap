import { describe, expect, it } from 'vitest'
import { streamLinks } from './streamLinks'

describe('streamLinks', () => {
  it("lists the stream finder's StreamEast links", () => {
    expect(streamLinks([{ site: 'StreamEast', url: 'https://streameast.test/nba/game/1' }])).toEqual([
      { site: 'StreamEast', url: 'https://streameast.test/nba/game/1' },
    ])
  })

  it("leaves out other sites' links", () => {
    expect(
      streamLinks([
        { site: 'Streams One', url: 'https://streams-one.test/watch/1' },
        { site: 'streameast', url: 'https://streameast.test/nba/game/2' },
      ]),
    ).toEqual([{ site: 'streameast', url: 'https://streameast.test/nba/game/2' }])
  })

  it('is empty when the finder found nothing', () => {
    expect(streamLinks([])).toEqual([])
  })

  it('leaves out anything that is not a web address', () => {
    expect(
      streamLinks([
        { site: 'StreamEast', url: 'javascript:alert(1)' },
        { site: 'StreamEast', url: 'not a url' },
        { site: 'StreamEast', url: 'http://plain.test/game' },
      ]),
    ).toEqual([{ site: 'StreamEast', url: 'http://plain.test/game' }])
  })
})
