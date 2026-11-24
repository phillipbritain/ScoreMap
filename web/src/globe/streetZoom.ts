/** At street zoom the camera tilts as buildings rise from their footprints. */
export const streetZoom = 15
export const fullBuildingHeightZoom = 16

export function pitchAtZoom(zoom: number): number {
  const progress = (zoom - streetZoom) / (fullBuildingHeightZoom - streetZoom)
  return 45 * Math.max(0, Math.min(1, progress))
}
