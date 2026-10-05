import { describe, expect, it } from 'vitest'
import { settingsStore, type SettingsStorage } from './settingsStore'
import { firstVisitSettings } from './viewerSettings'

/** Stands in for the browser's localStorage, which survives a page reload. */
function memoryStorage(): SettingsStorage {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  }
}

describe('settingsStore', () => {
  it('gives a first-time visitor every league on, "Live only" off and Disrupted games shown', () => {
    expect(settingsStore(() => memoryStorage()).load()).toEqual(firstVisitSettings)
  })

  it('remembers saved settings after a page reload', () => {
    const storage = memoryStorage()
    const chosen = { hiddenLeagues: ['NBA', 'MLS'], liveOnly: true, showDisrupted: false }

    settingsStore(() => storage).save(chosen)
    const afterReload = settingsStore(() => storage)

    expect(afterReload.load()).toEqual(chosen)
  })

  it('still works when the browser blocks storage', () => {
    const store = settingsStore(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })

    expect(() => store.save({ hiddenLeagues: ['NBA'], liveOnly: true, showDisrupted: false })).not.toThrow()
    expect(store.load()).toEqual(firstVisitSettings)
  })

  it('still works when storage is full or refuses reads', () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('read refused')
      },
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      },
    }
    const store = settingsStore(() => broken)

    expect(() => store.save({ hiddenLeagues: ['NBA'], liveOnly: true, showDisrupted: false })).not.toThrow()
    expect(store.load()).toEqual(firstVisitSettings)
  })

  it('falls back to first-visit settings when what was saved is unreadable', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', '{not json')

    expect(settingsStore(() => storage).load()).toEqual(firstVisitSettings)
  })

  it('shows Disrupted games to a viewer whose settings were saved before that setting existed', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], liveOnly: true }))

    expect(settingsStore(() => storage).load()).toEqual({ hiddenLeagues: ['NBA'], liveOnly: true, showDisrupted: true })
  })

  it('keeps each saved setting it understands and defaults the rest', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA', 7], liveOnly: 'yes', showDisrupted: 0 }))

    expect(settingsStore(() => storage).load()).toEqual({ hiddenLeagues: ['NBA'], liveOnly: false, showDisrupted: true })
  })
})
