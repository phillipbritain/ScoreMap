import { describe, expect, it } from 'vitest'
import { cutOffMessage, cutOffNoteView, wakingMessage } from './cutOffNoteView'

const seconds = (n: number) => n * 1000

describe('cutOffNoteView', () => {
  it('says nothing while connected', () => {
    expect(cutOffNoteView(null)).toBeNull()
  })

  it('says nothing for the first 10 seconds cut off, so a blip passes unseen', () => {
    expect(cutOffNoteView(0)).toBeNull()
    expect(cutOffNoteView(seconds(9.9))).toBeNull()
  })

  it('says it can’t reach ScoreMap from 10 seconds cut off, for as long as it lasts', () => {
    expect(cutOffNoteView(seconds(10))).toBe(cutOffMessage)
    expect(cutOffNoteView(seconds(600))).toBe(cutOffMessage)
  })

  it('says it’s waking up at once on waking, until 10 seconds', () => {
    expect(cutOffNoteView(0, true)).toBe(wakingMessage)
    expect(cutOffNoteView(seconds(9.9), true)).toBe(wakingMessage)
  })

  it('says it can’t reach ScoreMap from 10 seconds waking', () => {
    expect(cutOffNoteView(seconds(10), true)).toBe(cutOffMessage)
  })
})
