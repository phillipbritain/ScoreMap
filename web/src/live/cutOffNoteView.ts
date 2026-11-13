import type { PhraseScenario } from '../loading/loadingPhrases'

/** How long ScoreMap can be cut off from the server before it says so: as long as the loading screen waits. */
const cutOffNoteAfterMs = 10_000

/**
 * What the cut-off note says (its phrases are in loading/loadingPhrases.ts), given how long ScoreMap
 * has been cut off from the server (null while it isn't), and whether it's waking up (see GLOSSARY.md
 * "Asleep"): nothing for the first 10 seconds of a drop, so a blip passes unseen, or on waking that it's
 * waking at once; then that it can't reach ScoreMap, until the games come back. The CutOffNote
 * component draws it.
 */
export function cutOffNoteView(cutOffForMs: number | null, waking = false): PhraseScenario | null {
  if (cutOffForMs === null) return null
  if (cutOffForMs >= cutOffNoteAfterMs) return 'cutOff'
  return waking ? 'waking' : null
}
