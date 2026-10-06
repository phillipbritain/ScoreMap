import { describe, expect, it } from 'vitest'
import { streamLinks } from './streamLinks'

describe('streamLinks', () => {
  it("lists the stream finder's links with the site they come from", () => {
    expect(streamLinks([{ site: 'Streams One', url: 'https://streams-one.test/watch/1' }])).toEqual([
      { site: 'Streams One', url: 'https://streams-one.test/watch/1' },
    ])
  })

  it('is empty when the finder found nothing, so the panel shows only official services', () => {
    expect(streamLinks([])).toEqual([])
  })

  it('leaves out anything that is not a web address', () => {
    expect(
      streamLinks([
        { site: 'Odd', url: 'javascript:alert(1)' },
        { site: 'Odd', url: 'not a url' },
        { site: 'Plain', url: 'http://plain.test/game' },
      ]),
    ).toEqual([{ site: 'Plain', url: 'http://plain.test/game' }])
  })
})
