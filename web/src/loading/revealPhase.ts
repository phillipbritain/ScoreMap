import type { LoadingStage } from '../globe/globeMap'

/**
 * How far ScoreMap has got in showing itself on its first load (see GLOSSARY.md, "Loading screen"):
 * hidden behind the loading screen until the globe is ready; then revealing, the globe, its score
 * cards and place names, the controls and the welcome tour coming in together as the loading screen
 * fades away; then shown, once it has gone.
 */
export type RevealPhase = 'hidden' | 'revealing' | 'shown'

/**
 * The reveal's phase at this stage of the globe's initial load, given whether the loading screen has
 * gone (its fade played). Nothing shows before Ready, a failed load included, so nothing comes in on
 * its own while the rocket flies.
 */
export function revealPhase(stage: LoadingStage, loadingScreenGone: boolean): RevealPhase {
  if (loadingScreenGone) return 'shown'
  return stage === 'ready' ? 'revealing' : 'hidden'
}
