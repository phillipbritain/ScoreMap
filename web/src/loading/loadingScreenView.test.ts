import { describe, expect, it } from 'vitest'
import { loadingScreenView } from './loadingScreenView'

const seconds = (n: number) => n * 1000

describe('loadingScreenView', () => {
  it('says it’s loading while waiting for games, before 10 seconds', () => {
    expect(loadingScreenView('waitingForGames', 0)).toEqual({ shown: true, message: 'loading' })
    expect(loadingScreenView('waitingForGames', seconds(9.9))).toEqual({ shown: true, message: 'loading' })
  })

  it('says it can’t reach ScoreMap after 10 seconds waiting for games', () => {
    expect(loadingScreenView('waitingForGames', seconds(10))).toEqual({
      shown: true,
      message: 'cutOff',
    })
    expect(loadingScreenView('waitingForGames', seconds(60))).toEqual({
      shown: true,
      message: 'cutOff',
    })
  })

  it('says it’s loading while the globe is drawing, before 10 seconds', () => {
    expect(loadingScreenView('drawing', 0)).toEqual({ shown: true, message: 'loading' })
    expect(loadingScreenView('drawing', seconds(9.9))).toEqual({ shown: true, message: 'loading' })
  })

  it('says the map is slow after 10 seconds drawing', () => {
    expect(loadingScreenView('drawing', seconds(10))).toEqual({
      shown: true,
      message: 'slowDrawing',
    })
  })

  it('goes back to saying it’s loading when games arrive, as the time in the new stage starts again', () => {
    expect(loadingScreenView('waitingForGames', seconds(15)).message).not.toBeNull()
    expect(loadingScreenView('drawing', 0)).toEqual({ shown: true, message: 'loading' })
  })

  it('offers immediate recovery guidance when the initial style fails', () => {
    expect(loadingScreenView('styleError', 0)).toEqual({
      shown: true,
      message: 'styleError',
    })
  })

  it('explains how to recover when the browser cannot create the globe', () => {
    expect(loadingScreenView('constructionError', 0)).toEqual({
      shown: true,
      message: 'constructionError',
    })
  })

  it('shows nothing once ready, however long it took', () => {
    expect(loadingScreenView('ready', 0)).toEqual({ shown: false, message: null })
    expect(loadingScreenView('ready', seconds(30))).toEqual({ shown: false, message: null })
  })
})
