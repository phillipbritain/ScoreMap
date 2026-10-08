import { describe, expect, it } from 'vitest'
import {
  clockReading,
  pickerEntries,
  pillLabel,
  showsScenarioControls,
  speedEntries,
  speedChangeable,
  speedLabel,
  togglesScenarioControls,
  type ScenarioListing,
} from './scenarioPicker'

const clock = { at: '2026-10-04T18:00:00Z', reads: '2026-10-04T20:00:00Z' }
const local: ScenarioListing = {
  running: 'crowded',
  scenarios: ['crowded', 'edge-cases', 'worldwide'],
  speed: 16,
  speeds: [1, 2, 4, 8, 16, 32, 64],
  clock,
}
// What the deployed server says: no scenarios.
const deployed: ScenarioListing = { running: 'real', scenarios: [], speed: 1, speeds: [], clock }

describe('the scenario pill', () => {
  it('shows the running scenario when the server has scenarios', () => {
    expect(showsScenarioControls(local, { hidden: false })).toBe(true)
    expect(pillLabel(local)).toBe('Scenario: crowded')
  })

  it('shows "Real games" when real games are running', () => {
    expect(pillLabel({ ...local, running: 'real' })).toBe('Scenario: Real games')
  })

  it('never shows when the server has no scenarios, or before it has said', () => {
    expect(showsScenarioControls(deployed, { hidden: false })).toBe(false)
    expect(showsScenarioControls(null, { hidden: false })).toBe(false)
  })
})

describe('the scenario list', () => {
  it('lists every scenario, then "Real games", marking the running one', () => {
    expect(pickerEntries(local)).toEqual([
      { name: 'crowded', label: 'crowded', running: true },
      { name: 'edge-cases', label: 'edge-cases', running: false },
      { name: 'worldwide', label: 'worldwide', running: false },
      { name: 'real', label: 'Real games', running: false },
    ])
  })

  it('marks "Real games" when they are running', () => {
    expect(pickerEntries({ ...local, running: 'real' }).filter((entry) => entry.running)).toEqual([
      { name: 'real', label: 'Real games', running: true },
    ])
  })
})

describe('the speed pill', () => {
  it('shows the speed', () => {
    expect(speedLabel(16)).toBe('16×')
  })

  it("lists the server's speeds, marking the current one", () => {
    expect(speedEntries({ ...local, speeds: [1, 2, 16] })).toEqual([
      { speed: 1, label: '1×', current: false },
      { speed: 2, label: '2×', current: false },
      { speed: 16, label: '16×', current: true },
    ])
  })

  it('can change the speed while a scenario runs, but not while real games run', () => {
    expect(speedChangeable(local)).toBe(true)
    expect(speedChangeable({ ...local, running: 'real' })).toBe(false)
  })
})

describe('the clock', () => {
  const at = Date.parse(clock.at)

  it('reads what the server said at the time it said it', () => {
    expect(clockReading(local, at)).toEqual(new Date(clock.reads))
  })

  it('runs forward at the speed while a scenario runs', () => {
    expect(clockReading(local, at + 10_000)).toEqual(new Date('2026-10-04T20:02:40Z'))
  })

  it('runs at real time while real games run, whatever the speed', () => {
    const real = { ...local, running: 'real', clock: { at: clock.at, reads: clock.at } }

    expect(clockReading(real, at + 10_000)).toEqual(new Date('2026-10-04T18:00:10Z'))
  })
})

describe('Shift+S', () => {
  const shiftS = { key: 'S', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, target: null }

  it('hides and shows the pills and the clock', () => {
    expect(togglesScenarioControls(shiftS)).toBe(true)
    expect(showsScenarioControls(local, { hidden: true })).toBe(false)
  })

  it('does nothing while typing in a text field', () => {
    expect(togglesScenarioControls({ ...shiftS, target: { tagName: 'INPUT', isContentEditable: false } })).toBe(false)
    expect(togglesScenarioControls({ ...shiftS, target: { tagName: 'TEXTAREA', isContentEditable: false } })).toBe(false)
    expect(togglesScenarioControls({ ...shiftS, target: { tagName: 'SELECT', isContentEditable: false } })).toBe(false)
    expect(togglesScenarioControls({ ...shiftS, target: { tagName: 'DIV', isContentEditable: true } })).toBe(false)
  })

  it('works with the focus on a button', () => {
    expect(togglesScenarioControls({ ...shiftS, target: { tagName: 'BUTTON', isContentEditable: false } })).toBe(true)
  })

  it('is only S with Shift alone', () => {
    expect(togglesScenarioControls({ ...shiftS, key: 's', shiftKey: false })).toBe(false)
    expect(togglesScenarioControls({ ...shiftS, ctrlKey: true })).toBe(false)
    expect(togglesScenarioControls({ ...shiftS, altKey: true })).toBe(false)
    expect(togglesScenarioControls({ ...shiftS, metaKey: true })).toBe(false)
  })
})
