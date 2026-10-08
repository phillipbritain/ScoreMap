/** What the server says about scenarios (ADR-0009): the running one ("real" for real games) and every scenario file. */
export interface ScenarioListing {
  running: string
  scenarios: string[]
}

/** The name that stands for real games, as the server writes it. */
export const realGames = 'real'

function displayName(name: string) {
  return name === realGames ? 'Real games' : name
}

/** Whether the scenario pill shows: only when the server has scenarios (never on the deployed site), and not hidden. */
export function showsPill(listing: ScenarioListing | null, pill: { hidden: boolean }): boolean {
  return listing !== null && listing.scenarios.length > 0 && !pill.hidden
}

/** The pill's text, before its ▾. */
export function pillLabel(listing: ScenarioListing): string {
  return `Scenario: ${displayName(listing.running)}`
}

/**
 * The listing once the server has said (over the games hub) that `running` is now running, as after
 * a switch made in any browser. Before the pill has its listing there is nothing to change: the
 * listing, when it comes, says what is running.
 */
export function withRunning(listing: ScenarioListing | null, running: string): ScenarioListing | null {
  return listing && { ...listing, running }
}

export interface PickerEntry {
  /** What to switch the server to. */
  name: string
  label: string
  running: boolean
}

/** The pill's list: every scenario, then "Real games". */
export function pickerEntries(listing: ScenarioListing): PickerEntry[] {
  return [...listing.scenarios, realGames].map((name) => ({
    name,
    label: displayName(name),
    running: name === listing.running,
  }))
}

/** The parts of a keydown event that decide whether it hides or shows the pill. */
export interface KeyPress {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  target: { tagName: string; isContentEditable: boolean } | null
}

const textFields = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** Whether a key press hides or shows the pill: Shift+S, unless typed into a text field. */
export function togglesPill(press: KeyPress): boolean {
  if (press.target && (textFields.has(press.target.tagName) || press.target.isContentEditable)) return false
  return press.key.toUpperCase() === 'S' && press.shiftKey && !press.ctrlKey && !press.altKey && !press.metaKey
}
