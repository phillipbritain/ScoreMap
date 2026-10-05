/** What decides whether slow spin turns the globe right now. */
export interface SpinConditions {
  /** The viewer's "Slow spin" setting. */
  slowSpin: boolean
  /** A game panel is open. */
  gameSelected: boolean
  /** The viewer is dragging, zooming or otherwise moving the globe themselves. */
  interacting: boolean
}

/** Slow spin runs only while it's on, nothing is selected and the viewer isn't moving the globe. */
export function shouldSpin({ slowSpin, gameSelected, interacting }: SpinConditions): boolean {
  return slowSpin && !gameSelected && !interacting
}

/** Slow enough to read scores as they pass: a full turn takes three minutes. */
const degreesPerSecond = 2

/**
 * The camera's longitude after spinning for a while. The globe turns the way the Earth does, so
 * places further east come into view first and the centre moves west.
 */
export function spunLongitude(longitude: number, elapsedMs: number): number {
  const turned = longitude - (degreesPerSecond * elapsedMs) / 1000
  // Back into (-180, 180].
  return 180 - ((((180 - turned) % 360) + 360) % 360)
}
