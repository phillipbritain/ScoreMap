import type { Map as MapLibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    /**
     * In dev runs, the globe's map, how far it has loaded, whether it's still, and the frames the
     * score cards were last laid out from (see src/globe/layoutTrace.ts). The scripts that drive the
     * page check for each, as a test's stand-in globe may leave some out.
     */
    scoremap?: {
      map: MapLibreMap
      stage?: () => 'waitingForGames' | 'drawing' | 'ready'
      settled?: () => boolean
      frames?: unknown[]
    }
  }
}
