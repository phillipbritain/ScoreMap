import type { Map as MapLibreMap } from 'maplibre-gl'

/** A fully transparent image, for the pins', cards' and clusters' invisible footprints. */
export function addBlankImage(map: MapLibreMap, name: string, width: number, height: number): void {
  map.addImage(name, { width, height, data: new Uint8Array(width * height * 4) })
}
