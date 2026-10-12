import { describe, expect, it } from 'vitest'
import { loadingScreenView } from './loadingScreenView'

describe('loadingScreenView', () => {
  it('shows while waiting for games', () => {
    expect(loadingScreenView('waitingForGames')).toEqual({ shown: true })
  })

  it('shows while the globe is drawing', () => {
    expect(loadingScreenView('drawing')).toEqual({ shown: true })
  })

  it('shows nothing once ready', () => {
    expect(loadingScreenView('ready')).toEqual({ shown: false })
  })
})
