/**
 * What the server says about scenarios (ADR-0009): the running one ("real" for real games) and every
 * scenario file, the scenario clock's speed and the speeds to choose from, and where the clock games
 * are on stands (the scenario clock, or the real time while real games run).
 */
export interface ScenarioListing {
  running: string
  scenarios: string[]
  speed: number
  speeds: number[]
  /** The clock `reads` this at the real time `at` (both ISO 8601); from here it runs at the speed. */
  clock: { at: string; reads: string }
}

/** The name that stands for real games, as the server writes it. */
export const realGames = 'real'

function displayName(name: string) {
  return name === realGames ? 'Real games' : name
}

/**
 * Whether the scenario pill, the speed pill and the clock show: only when the server has scenarios
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

/** A speed as the speed pill shows it, e.g. "16×". */
export function speedLabel(speed: number): string {
  return `${speed}×`
}

export interface SpeedEntry {
  speed: number
  label: string
  current: boolean
}

/** The speed pill's list: the server's speeds, slowest first. */
export function speedEntries(listing: ScenarioListing): SpeedEntry[] {
  return listing.speeds.map((speed) => ({ speed, label: speedLabel(speed), current: speed === listing.speed }))
}

/** Whether the speed can be changed: while a scenario runs, not while real games (which play in real time) do. */
export function speedChangeable(listing: ScenarioListing): boolean {
  return listing.running !== realGames
}

/** What the clock reads at the real time `now` (ms since the epoch): run forward from the server's anchor. */
export function clockReading(listing: ScenarioListing, now: number): Date {
  // Real games are on the real time, whatever the speed the server keeps for scenarios.
  const speed = speedChangeable(listing) ? listing.speed : 1
  const { at, reads } = listing.clock
  return new Date(Date.parse(reads) + (now - Date.parse(at)) * speed)
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
