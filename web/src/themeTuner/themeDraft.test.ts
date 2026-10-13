import { describe, expect, it } from 'vitest'
import builtInJson from '../theme/builtInTheme.json'
import { resolveTheme } from '../theme/theme'
import {
  changes,
  describeChanges,
  loadDraft,
  saveDraft,
  settingAt,
  shiftedJob,
  tunerTabs,
  withSetting,
  type SettingPath,
  type ThemeJson,
} from './themeDraft'

const builtIn = builtInJson as unknown as ThemeJson

describe('withSetting', () => {
  it('changes one setting and leaves the rest, and the theme it came from, as they were', () => {
    const draft = withSetting(builtIn, ['trail', 'glow', 'width'], 6)
    expect(settingAt(draft, ['trail', 'glow', 'width'])).toBe(6)
    expect(settingAt(draft, ['trail', 'glow', 'blur'])).toBe(settingAt(builtIn, ['trail', 'glow', 'blur']))
    expect(settingAt(builtIn, ['trail', 'glow', 'width'])).toBe(4)
    expect(resolveTheme(draft).ok).toBe(true)
  })
})

describe('shiftedJob', () => {
  it('steps a colour job darker or lighter in its palette colour', () => {
    expect(shiftedJob('navy.500', 1)).toBe('navy.600')
    expect(shiftedJob('navy.500', -2)).toBe('navy.300')
  })

  it('stops at the lightest and darkest steps', () => {
    expect(shiftedJob('gold.900', 1)).toBe('gold.900')
    expect(shiftedJob('gold.100', -1)).toBe('gold.100')
  })

  it('leaves a colour given directly as it is', () => {
    expect(shiftedJob('transparent', 1)).toBe('transparent')
    expect(shiftedJob('#123456', -1)).toBe('#123456')
  })
})

describe('changes', () => {
  it('lists each setting changed, a size by zoom as one', () => {
    let draft = withSetting(builtIn, ['card', 'fill'], 'navy.800')
    draft = withSetting(draft, ['globe', 'coastlines', 'width'], { '2': 1, '8': 2 })
    expect(describeChanges(changes(builtIn, draft))).toBe(
      'globe.coastlines.width: {"2":0.6,"8":1.2} → {"2":1,"8":2}\ncard.fill: "navy.700" → "navy.800"',
    )
  })

  it('finds none when nothing has changed', () => {
    expect(changes(builtIn, withSetting(builtIn, ['trail', 'width'], 1.25))).toEqual([])
  })
})

describe('tunerTabs', () => {
  it('shows every setting under some tab', () => {
    const paths = tunerTabs(builtIn).flatMap((tab) => tab.paths)
    const leavesOf = (value: unknown, path: SettingPath): SettingPath[] =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Object.entries(value).flatMap(([key, inner]) => leavesOf(inner, [...path, key]))
        : [path]
    const leaves = leavesOf(builtIn.settings, [])
    const startsWith = (path: SettingPath, start: SettingPath) => start.every((key, i) => path[i] === key)
    expect(leaves.filter((leaf) => !paths.some((path) => startsWith(leaf, path)))).toEqual([])
  })
})

describe('a saved draft', () => {
  function memoryStorage() {
    const items = new Map<string, string>()
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    }
  }

  it('comes back while the built-in theme is the one it was made from', () => {
    const storage = memoryStorage()
    const draft = withSetting(builtIn, ['trail', 'width'], 3)
    saveDraft(storage, builtIn, draft)
    expect(loadDraft(storage, builtIn)).toEqual(draft)
  })

  it('is dropped once the built-in theme has changed', () => {
    const storage = memoryStorage()
    saveDraft(storage, builtIn, withSetting(builtIn, ['trail', 'width'], 3))
    expect(loadDraft(storage, withSetting(builtIn, ['trail', 'opacity'], 0.5))).toBeNull()
  })
})
