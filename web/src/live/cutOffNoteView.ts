/** How long ScoreMap can be cut off from the server before it says so: as long as the loading screen waits. */
const cutOffNoteAfterMs = 10_000

/** What the note over a dimmed globe says when ScoreMap can't reach the server, as the loading screen does. */
export const cutOffMessage = 'Can’t reach ScoreMap. Still trying…'

/** What the note says as ScoreMap wakes (see GLOSSARY.md "Asleep"), until the current games arrive. */
export const wakingMessage = 'Waking up…'

/**
 * What the cut-off note says, given how long ScoreMap has been cut off from the server (null while it
 * isn't), and whether it's waking up: nothing for the first 10 seconds of a drop, so a blip passes
 * unseen, or on waking the waking message at once; then the cut-off message, until the games come back.
 * The CutOffNote component draws it.
 */
export function cutOffNoteView(cutOffForMs: number | null, waking = false): string | null {
  if (cutOffForMs === null) return null
  if (cutOffForMs >= cutOffNoteAfterMs) return cutOffMessage
  return waking ? wakingMessage : null
}
