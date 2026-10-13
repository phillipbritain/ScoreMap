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
  }
}
