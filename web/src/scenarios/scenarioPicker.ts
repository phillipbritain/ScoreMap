/** The server's names for its speeds. */
export const speedNames = { paused: 'Paused', normal: 'Normal', fast: 'Fast', faster: 'Faster' } as const

export type SpeedName = (typeof speedNames)[keyof typeof speedNames]

/** A speed the scenario clock can run at, by name: it runs `times` times faster than real time. */
export interface Speed {
  name: SpeedName
  times: number
}

/**
 * What the server says about scenarios (ADR-0009): the running one ("real" for real games) and every
 * scenario file, the scenario clock's speed (by name) and the speeds there are, and where the clock
 * games are on stands (the scenario clock, or the real time while real games run).
 */
export interface ScenarioListing {
  running: string
  scenarios: string[]
  speed: SpeedName
  speeds: Speed[]
  /** The clock `reads` this at the real time `at` (both ISO 8601); from here it runs at the speed. */
  clock: { at: string; reads: string }
}

/** The name that stands for real games, as the server writes it. */
export const realGames = 'real'

function displayName(name: string) {
  return name === realGames ? 'Real games' : name
}

/**
 * Whether the scenario pill, the media keys and the clock show: only when the server has scenarios
 * (never on the deployed site), and not hidden.
 */
export function showsScenarioControls(listing: ScenarioListing | null, controls: { hidden: boolean }): boolean {
  return listing !== null && listing.scenarios.length > 0 && !controls.hidden
}

/** The scenario pill's text, before its ▾. */
export function pillLabel(listing: ScenarioListing): string {
  return `Scenario: ${displayName(listing.running)}`
}

export interface PickerEntry {
  /** What to switch the server to. */
  name: string
  label: string
  running: boolean
}

/** The scenario pill's list: every scenario, then "Real games". */
export function pickerEntries(listing: ScenarioListing): PickerEntry[] {
  return [...listing.scenarios, realGames].map((name) => ({
    name,
    label: displayName(name),
    running: name === listing.running,
  }))
}

/** The media keys: Pause, Play and Fast-forward. */
export type MediaKey = 'play' | 'pause' | 'fastForward'

/**
 * How the media keys show and change each speed: the key lit, where Fast-forward goes (Fast, and
 * pressed again, flipping between Fast and Faster), and whether its icon grows a third triangle.
 * A new speed doesn't typecheck until it has a row.
 */
const mediaKeys: Record<SpeedName, { lit: MediaKey; fastForwardTo: SpeedName; fasterIcon: boolean }> = {
  Paused: { lit: 'pause', fastForwardTo: speedNames.fast, fasterIcon: false },
  Normal: { lit: 'play', fastForwardTo: speedNames.fast, fasterIcon: false },
  Fast: { lit: 'fastForward', fastForwardTo: speedNames.faster, fasterIcon: false },
  Faster: { lit: 'fastForward', fastForwardTo: speedNames.fast, fasterIcon: true },
}

/** The media key lit for the speed: Play at Normal, Pause when paused, Fast-forward at Fast and Faster. */
export function litKey(speed: SpeedName): MediaKey {
  return mediaKeys[speed].lit
}

/** The speed a media key goes to: Normal on Play, paused on Pause, and on Fast-forward as `mediaKeys` says. */
export function pressedSpeed(speed: SpeedName, key: MediaKey): SpeedName {
  if (key === 'play') return speedNames.normal
  if (key === 'pause') return speedNames.paused
  return mediaKeys[speed].fastForwardTo
}

/** Whether Fast-forward shows its Faster icon, with a third triangle: only at Faster. */
export function showsFasterIcon(speed: SpeedName): boolean {
  return mediaKeys[speed].fasterIcon
}

/** Whether the speed can be changed: while a scenario runs, not while real games (which play in real time) do. */
export function speedChangeable(listing: ScenarioListing): boolean {
  return listing.running !== realGames
}

/** What the clock reads at the real time `now` (ms since the epoch): run forward from the server's anchor. */
export function clockReading(listing: ScenarioListing, now: number): Date {
  // Real games are on the real time, whatever the speed the server keeps for scenarios.
  const times = speedChangeable(listing) ? (listing.speeds.find((speed) => speed.name === listing.speed)?.times ?? 1) : 1
  const { at, reads } = listing.clock
  return new Date(Date.parse(reads) + (now - Date.parse(at)) * times)
}

/** The parts of a keydown event that decide whether it hides or shows the scenario controls. */
export interface KeyPress {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  target: { tagName: string; isContentEditable: boolean } | null
}

const textFields = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** Whether a key press hides or shows the scenario controls: Shift+S, unless typed into a text field. */
export function togglesScenarioControls(press: KeyPress): boolean {
  if (press.target && (textFields.has(press.target.tagName) || press.target.isContentEditable)) return false
  return press.key.toUpperCase() === 'S' && press.shiftKey && !press.ctrlKey && !press.altKey && !press.metaKey
}
