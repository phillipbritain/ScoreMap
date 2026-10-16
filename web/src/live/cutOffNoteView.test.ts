import { describe, expect, it } from 'vitest'
import { cutOffMessage, cutOffNoteView } from './cutOffNoteView'

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
})
