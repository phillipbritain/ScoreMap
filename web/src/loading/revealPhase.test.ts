import { describe, expect, it } from 'vitest'
import type { LoadingStage } from '../globe/globeMap'
import { revealPhase } from './revealPhase'

describe('revealPhase', () => {
  it.each<LoadingStage>(['waitingForGames', 'drawing', 'styleError', 'constructionError'])(
    'keeps everything hidden before the globe is ready (%s)',
    (stage) => {
      expect(revealPhase(stage, false)).toBe('hidden')
    },
  )

  it('reveals everything together once the globe is ready, while the loading screen fades', () => {
    expect(revealPhase('ready', false)).toBe('revealing')
  })

  it('has everything shown once the loading screen has gone', () => {
    expect(revealPhase('ready', true)).toBe('shown')
  })
})
