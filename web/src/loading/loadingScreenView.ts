import type { LoadingStage } from '../globe/globeMap'

/**
 * What the loading screen shows (see GLOSSARY.md): the dim and spinner over the globe, or nothing; and
 * under the spinner, a message saying what's holding loading up, or none.
 */
export interface LoadingScreenView {
  shown: boolean
  message: string | null
}

/** How long a stage lasts before the loading screen says what's holding it up. */
const slowAfterMs = 10_000

const slowMessages: Record<Exclude<LoadingStage, 'ready'>, string> = {
  waitingForGames: 'Can’t reach ScoreMap. Still trying…',
  drawing: 'The map is slow to load. Still trying…',
}

/**
 * What the loading screen shows at this stage of the globe's initial load, given how long it has been
 * in that stage: the dim and spinner until the globe is ready, then nothing; and once a stage has
 * lasted 10 seconds, that stage's message. The LoadingScreen component draws it.
 */
export function loadingScreenView(stage: LoadingStage, msInStage: number): LoadingScreenView {
  if (stage === 'ready') return { shown: false, message: null }
  return { shown: true, message: msInStage >= slowAfterMs ? slowMessages[stage] : null }
}
