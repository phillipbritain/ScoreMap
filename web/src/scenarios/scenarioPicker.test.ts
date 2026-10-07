import { describe, expect, it } from 'vitest'
import { pickerEntries, pillLabel, showsPill, togglesPill } from './scenarioPicker'

const local = { running: 'crowded', scenarios: ['crowded', 'edge-cases', 'worldwide'] }
// What the deployed server says: no scenarios.
const deployed = { running: 'real', scenarios: [] }

describe('the scenario pill', () => {
  it('shows the running scenario when the server has scenarios', () => {
    expect(showsPill(local, { hidden: false })).toBe(true)
    expect(pillLabel(local)).toBe('Scenario: crowded')
  })

  it('shows "Real games" when real games are running', () => {
    expect(pillLabel({ ...local, running: 'real' })).toBe('Scenario: Real games')
  })

  it('never shows when the server has no scenarios, or before it has said', () => {
    expect(showsPill(deployed, { hidden: false })).toBe(false)
    expect(showsPill(null, { hidden: false })).toBe(false)
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

describe('Shift+S', () => {
  const shiftS = { key: 'S', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, target: null }

  it('hides and shows the pill', () => {
    expect(togglesPill(shiftS)).toBe(true)
    expect(showsPill(local, { hidden: true })).toBe(false)
  })

  it('does nothing while typing in a text field', () => {
    expect(togglesPill({ ...shiftS, target: { tagName: 'INPUT', isContentEditable: false } })).toBe(false)
    expect(togglesPill({ ...shiftS, target: { tagName: 'TEXTAREA', isContentEditable: false } })).toBe(false)
    expect(togglesPill({ ...shiftS, target: { tagName: 'SELECT', isContentEditable: false } })).toBe(false)
    expect(togglesPill({ ...shiftS, target: { tagName: 'DIV', isContentEditable: true } })).toBe(false)
  })

  it('works with the focus on a button', () => {
    expect(togglesPill({ ...shiftS, target: { tagName: 'BUTTON', isContentEditable: false } })).toBe(true)
  })

  it('is only S with Shift alone', () => {
    expect(togglesPill({ ...shiftS, key: 's', shiftKey: false })).toBe(false)
    expect(togglesPill({ ...shiftS, ctrlKey: true })).toBe(false)
    expect(togglesPill({ ...shiftS, altKey: true })).toBe(false)
    expect(togglesPill({ ...shiftS, metaKey: true })).toBe(false)
  })
})
