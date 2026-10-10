import { describe, expect, it } from 'vitest'
import {
  clockReading,
  pickerEntries,
  pillLabel,
  showsScenarioControls,
  litKey,
  pressedSpeed,
  showsFasterIcon,
  togglesScenarioControls,
  type ScenarioListing,
} from './scenarioPicker'

const clock = { at: '2026-10-04T18:00:00Z', reads: '2026-10-04T20:00:00Z' }
const local: ScenarioListing = {
  running: 'crowded',
  scenarios: ['crowded', 'edge-cases', 'worldwide'],
  speed: 'Faster',
  speeds: [
    { name: 'Paused', times: 0 },
    { name: 'Normal', times: 1 },
    { name: 'Fast', times: 2 },
    { name: 'Faster', times: 8 },
  ],
  canControlPlay: true,
  clock,
}
// What the deployed server says: no scenarios.
const deployed: ScenarioListing = { running: 'real', scenarios: [], speed: 'Normal', speeds: [], canControlPlay: false, clock }

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

describe('the media keys', () => {
  it('light Play at Normal, Pause when paused, and Fast-forward at Fast and Faster', () => {
    expect(litKey('Normal')).toBe('play')
    expect(litKey('Paused')).toBe('pause')
    expect(litKey('Fast')).toBe('fastForward')
    expect(litKey('Faster')).toBe('fastForward')
  })

  it('go to Normal on Play and pause on Pause, from any speed', () => {
    for (const speed of ['Paused', 'Normal', 'Fast', 'Faster'] as const) {
      expect(pressedSpeed(speed, 'play')).toBe('Normal')
      expect(pressedSpeed(speed, 'pause')).toBe('Paused')
    }
  })

  it('go to Fast on Fast-forward, and flip between Fast and Faster when pressed again', () => {
    expect(pressedSpeed('Paused', 'fastForward')).toBe('Fast')
    expect(pressedSpeed('Normal', 'fastForward')).toBe('Fast')
    expect(pressedSpeed('Fast', 'fastForward')).toBe('Faster')
    expect(pressedSpeed('Faster', 'fastForward')).toBe('Fast')
  })

  it("grow Fast-forward's third triangle only at Faster", () => {
    expect(showsFasterIcon('Faster')).toBe(true)
    for (const speed of ['Paused', 'Normal', 'Fast'] as const) expect(showsFasterIcon(speed)).toBe(false)
  })
})

describe('the clock', () => {
  const at = Date.parse(clock.at)

  it('reads what the server said at the time it said it', () => {
    expect(clockReading(local, at)).toEqual(new Date(clock.reads))
  })

  it('runs forward at the speed while a scenario runs', () => {
    expect(clockReading(local, at + 10_000)).toEqual(new Date('2026-10-04T20:01:20Z'))
  })

  it('stands still while paused', () => {
    expect(clockReading({ ...local, speed: 'Paused' }, at + 10_000)).toEqual(new Date(clock.reads))
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
