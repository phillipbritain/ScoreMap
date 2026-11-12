import type { Map as MapLibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    /**
     * In dev runs, the globe's map, how far it has loaded, whether it's still, and the frames the
     * score cards were last laid out from (see src/globe/layoutTrace.ts). Optional so a test's
     * stand-in globe can leave out what it doesn't need.
     */
    scoremap?: {
      map: MapLibreMap
      stage?: () => 'waitingForGames' | 'drawing' | 'ready'
      settled?: () => boolean
      frames?: unknown[]
    }
    /**
     * In dev runs, what makes a score or a finish happen to a game on screen, in this tab only (see
     * src/live/madeUpChange.ts): the change made, or null when no game on screen can.
     */
    scoremapGames?: {
      happen: (
        event: 'score' | 'finish',
        onScreen: (game: { id: string; venue: { longitude: number | null; latitude: number | null } }) => boolean,
      ) => { kind: string; game: { id: string } } | null
    }
  }
}
