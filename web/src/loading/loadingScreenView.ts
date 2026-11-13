import type { LoadingStage } from '../globe/globeMap'
import type { PhraseScenario } from './loadingPhrases'

/**
 * What the loading screen shows (see GLOSSARY.md): the dim and rocket over the globe, or nothing; and
 * under the rocket, that it's loading or what's holding it up (its phrases are in loadingPhrases.ts).
 */
export interface LoadingScreenView {
  shown: boolean
  message: PhraseScenario | null
}

/** How long a stage lasts before the loading screen says what's holding it up. */
const slowAfterMs = 10_000

const slowMessages: Record<'waitingForGames' | 'drawing', PhraseScenario> = {
  waitingForGames: 'cutOff',
  drawing: 'slowDrawing',
}

/**
 * What the loading screen shows at this stage of the globe's initial load, given how long it has been
 * in that stage: the dim and rocket until the globe is ready, then nothing; and that it's loading,
 * until a stage has lasted 10 seconds, then that stage's message. The LoadingScreen component draws it.
 */
export function loadingScreenView(stage: LoadingStage, msInStage: number): LoadingScreenView {
  if (stage === 'styleError' || stage === 'constructionError') return { shown: true, message: stage }
  if (stage === 'ready') return { shown: false, message: null }
  return { shown: true, message: msInStage >= slowAfterMs ? slowMessages[stage] : 'loading' }
}
