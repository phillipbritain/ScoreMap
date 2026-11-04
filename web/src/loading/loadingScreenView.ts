import type { LoadingStage } from '../globe/globeMap'
import { cutOffMessage } from '../live/cutOffNoteView'

/**
 * What the loading screen shows (see GLOSSARY.md): the dim and rocket over the globe, or nothing; and
 * under the rocket, a message saying what's holding loading up, or none.
 */
export interface LoadingScreenView {
  shown: boolean
  message: string | null
}

/** How long a stage lasts before the loading screen says what's holding it up. */
const slowAfterMs = 10_000

const slowMessages: Record<'waitingForGames' | 'drawing', string> = {
  waitingForGames: cutOffMessage,
  drawing: 'The map is slow to load. Still trying…',
}

/**
 * What the loading screen shows at this stage of the globe's initial load, given how long it has been
 * in that stage: the dim and rocket until the globe is ready, then nothing; and once a stage has
 * lasted 10 seconds, that stage's message. The LoadingScreen component draws it.
 */
export function loadingScreenView(stage: LoadingStage, msInStage: number): LoadingScreenView {
  if (stage === 'styleError') return { shown: true, message: 'The map couldn’t load. Check your connection and try again.' }
  if (stage === 'constructionError') return { shown: true, message: 'The globe couldn’t start. Check that WebGL is enabled in your browser, then try again.' }
  if (stage === 'ready') return { shown: false, message: null }
  return { shown: true, message: msInStage >= slowAfterMs ? slowMessages[stage] : null }
}
