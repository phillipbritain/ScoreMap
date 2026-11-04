import { describe, expect, it } from 'vitest'
import { loadingScreenView } from './loadingScreenView'

const seconds = (n: number) => n * 1000

describe('loadingScreenView', () => {
  it('shows without a message while waiting for games, before 10 seconds', () => {
    expect(loadingScreenView('waitingForGames', 0)).toEqual({ shown: true, message: null })
    expect(loadingScreenView('waitingForGames', seconds(9.9))).toEqual({ shown: true, message: null })
  })

  it('says it can’t reach ScoreMap after 10 seconds waiting for games', () => {
    expect(loadingScreenView('waitingForGames', seconds(10))).toEqual({
      shown: true,
      message: 'Can’t reach ScoreMap. Still trying…',
    })
    expect(loadingScreenView('waitingForGames', seconds(60))).toEqual({
      shown: true,
      message: 'Can’t reach ScoreMap. Still trying…',
    })
  })

  it('shows without a message while the globe is drawing, before 10 seconds', () => {
    expect(loadingScreenView('drawing', 0)).toEqual({ shown: true, message: null })
    expect(loadingScreenView('drawing', seconds(9.9))).toEqual({ shown: true, message: null })
  })

  it('says the map is slow after 10 seconds drawing', () => {
    expect(loadingScreenView('drawing', seconds(10))).toEqual({
      shown: true,
      message: 'The map is slow to load. Still trying…',
    })
  })

  it('clears the message when games arrive, as the time in the new stage starts again', () => {
    expect(loadingScreenView('waitingForGames', seconds(15)).message).not.toBeNull()
    expect(loadingScreenView('drawing', 0)).toEqual({ shown: true, message: null })
  })

  it('offers immediate recovery guidance when the initial style fails', () => {
    expect(loadingScreenView('styleError', 0)).toEqual({
      shown: true,
      message: 'The map couldn’t load. Check your connection and try again.',
    })
  })

  it('explains how to recover when the browser cannot create the globe', () => {
    expect(loadingScreenView('constructionError', 0)).toEqual({
      shown: true,
      message: 'The globe couldn’t start. Check that WebGL is enabled in your browser, then try again.',
    })
  })

  it('shows nothing once ready, however long it took', () => {
    expect(loadingScreenView('ready', 0)).toEqual({ shown: false, message: null })
    expect(loadingScreenView('ready', seconds(30))).toEqual({ shown: false, message: null })
  })
})
