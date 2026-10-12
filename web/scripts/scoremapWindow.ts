import type { Map as MapLibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    /**
     * In dev runs, the globe's map, how far it has loaded, whether it's still, and the frames the
     * score cards were last laid out from (see src/globe/layoutTrace.ts). A base from before #128
     * says only whether every game is on screen and still (`ready`), and one from before #112 has
     * only the map, so the scripts that drive the page check for each.
     */
    scoremap?: {
      map: MapLibreMap
      stage?: () => 'waitingForGames' | 'drawing' | 'ready'
      settled?: () => boolean
      ready?: () => boolean
      frames?: unknown[]
    }
  }
}
