/** How long ScoreMap can be cut off from the server before it says so: as long as the loading screen waits. */
const cutOffNoteAfterMs = 10_000

/** What the note over a dimmed globe says when ScoreMap can't reach the server, as the loading screen does. */
export const cutOffMessage = 'Can’t reach ScoreMap. Still trying…'

/**
 * What the cut-off note says, given how long ScoreMap has been cut off from the server (null while it
 * isn't): nothing for the first 10 seconds, so a blip passes unseen, then the message, until the games
 * come back. The CutOffNote component draws it.
 */
export function cutOffNoteView(cutOffForMs: number | null): string | null {
  return cutOffForMs !== null && cutOffForMs >= cutOffNoteAfterMs ? cutOffMessage : null
}
