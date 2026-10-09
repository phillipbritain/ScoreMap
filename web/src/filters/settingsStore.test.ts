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
    const chosen = {
      hiddenLeagues: ['NBA', 'MLS'],
      liveOnly: true,
      showDisrupted: false,
      slowSpin: false,
      cardStyle: 'neon' as const,
    }

    settingsStore(() => storage).save(chosen)
    const afterReload = settingsStore(() => storage)

    expect(afterReload.load()).toEqual(chosen)
  })

  it('still works when the browser blocks storage', () => {
    const store = settingsStore(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })

    expect(() => store.save({ ...firstVisitSettings, hiddenLeagues: ['NBA'], liveOnly: true })).not.toThrow()
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

    expect(() => store.save({ ...firstVisitSettings, hiddenLeagues: ['NBA'], liveOnly: true })).not.toThrow()
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

    expect(settingsStore(() => storage).load().showDisrupted).toBe(true)
  })

  it('keeps each saved setting it understands and defaults the rest', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA', 7], liveOnly: 'yes', showDisrupted: 0 }))

    expect(settingsStore(() => storage).load()).toEqual({
      hiddenLeagues: ['NBA'],
      liveOnly: false,
      showDisrupted: true,
      slowSpin: false,
      cardStyle: 'hud',
    })
  })

  it('gives slow spin its first-visit default (off) to settings saved before it existed', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], liveOnly: true }))

    expect(settingsStore(() => storage).load().slowSpin).toBe(false)
  })

  it('remembers slow spin switched on', () => {
    const storage = memoryStorage()
    settingsStore(() => storage).save({ ...firstVisitSettings, slowSpin: true })

    expect(settingsStore(() => storage).load().slowSpin).toBe(true)
  })

  it('gives score cards the HUD style when settings were saved before the style could be picked', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], liveOnly: true }))

    expect(settingsStore(() => storage).load().cardStyle).toBe('hud')
  })

  it('remembers the picked card style', () => {
    const storage = memoryStorage()
    settingsStore(() => storage).save({ ...firstVisitSettings, cardStyle: 'led' })

    expect(settingsStore(() => storage).load().cardStyle).toBe('led')
  })

  it('falls back to the HUD style when the saved style is one the app no longer has', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ cardStyle: 'white' }))

    expect(settingsStore(() => storage).load().cardStyle).toBe('hud')
  })
})

describe('settingsStore camera', () => {
  it('has no camera for a first-time visitor', () => {
    expect(settingsStore(() => memoryStorage()).loadCamera()).toBeNull()
  })

  it('remembers where the viewer left the globe after a page reload', () => {
    const storage = memoryStorage()
    const camera = { longitude: 139.7, latitude: 35.7, zoom: 4.2 }

    settingsStore(() => storage).saveCamera(camera)

    expect(settingsStore(() => storage).loadCamera()).toEqual(camera)
  })

  it('keeps the camera apart from the other settings', () => {
    const storage = memoryStorage()
    const store = settingsStore(() => storage)
    store.save({ ...firstVisitSettings, liveOnly: true })
    store.saveCamera({ longitude: 10, latitude: 50, zoom: 3 })

    expect(store.load()).toEqual({ ...firstVisitSettings, liveOnly: true })
  })

  it('ignores a damaged saved camera', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.camera', JSON.stringify({ longitude: 'east', latitude: 50, zoom: 3 }))

    expect(settingsStore(() => storage).loadCamera()).toBeNull()
  })

  it('ignores an unreadable saved camera', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.camera', '{not json')

    expect(settingsStore(() => storage).loadCamera()).toBeNull()
  })

  it('still works when the browser blocks storage', () => {
    const store = settingsStore(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })

    expect(() => store.saveCamera({ longitude: 0, latitude: 0, zoom: 2 })).not.toThrow()
    expect(store.loadCamera()).toBeNull()
  })
})
