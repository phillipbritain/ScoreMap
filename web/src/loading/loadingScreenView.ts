import type { LoadingStage } from '../globe/globeMap'

/** What the loading screen shows (see GLOSSARY.md): the dim and spinner over the globe, or nothing. */
export interface LoadingScreenView {
  shown: boolean
}

/**
 * What the loading screen shows at this stage of the globe's initial load: the dim and spinner until
 * the globe is ready, then nothing. The LoadingScreen component draws it.
 */
export function loadingScreenView(stage: LoadingStage): LoadingScreenView {
  return { shown: stage !== 'ready' }
}
