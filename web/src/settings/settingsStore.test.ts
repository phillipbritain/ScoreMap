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
      topEventsOnly: true,
      liveOnly: true,
      showDisrupted: false,
      sportColours: { Football: '#123456', Soccer: '#abcdef' },
      leagueColours: { NFL: '#fedcba' },
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

  it('has Top Events off for a viewer whose settings were saved before that setting existed', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], liveOnly: true }))

    expect(settingsStore(() => storage).load().topEventsOnly).toBe(false)
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
      topEventsOnly: false,
      liveOnly: false,
      showDisrupted: true,
      sportColours: {},
      leagueColours: {},
    })
  })

  it('loads settings saved before colours could be picked with no colours', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], liveOnly: true, showDisrupted: false }))

    expect(settingsStore(() => storage).load()).toEqual({
      hiddenLeagues: ['NBA'],
      topEventsOnly: false,
      liveOnly: true,
      showDisrupted: false,
      sportColours: {},
      leagueColours: {},
    })
  })

  it('keeps each saved colour it understands and drops the rest', () => {
    const storage = memoryStorage()
    storage.setItem(
      'scoremap.settings',
      JSON.stringify({ sportColours: { Football: '#123456', Soccer: 'red', Hockey: 7, Baseball: '#12345' } }),
    )

    expect(settingsStore(() => storage).load().sportColours).toEqual({ Football: '#123456' })
  })

  it('loads settings saved before leagues could be coloured with no league colours, keeping sport colours', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ sportColours: { Football: '#123456' } }))

    const loaded = settingsStore(() => storage).load()

    expect(loaded.sportColours).toEqual({ Football: '#123456' })
    expect(loaded.leagueColours).toEqual({})
  })

  it('keeps each saved league colour it understands and drops the rest', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ leagueColours: { NFL: '#abcdef', NBA: 'blue', MLS: 3 } }))

    expect(settingsStore(() => storage).load().leagueColours).toEqual({ NFL: '#abcdef' })
  })

  it.each([['red'], [['#123456']], [null]])('loads no colours when what was saved for them is %j', (sportColours) => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ sportColours }))

    expect(settingsStore(() => storage).load().sportColours).toEqual({})
  })

  it.each(['hud', 'led', 'broadcast', 'tactical', 'neon', 'white'])(
    'keeps every other setting when the saved settings still carry a card style ("%s")',
    (cardStyle) => {
      const storage = memoryStorage()
      storage.setItem(
        'scoremap.settings',
        JSON.stringify({ hiddenLeagues: ['NBA', 'MLS'], liveOnly: true, showDisrupted: false, cardStyle }),
      )

      expect(settingsStore(() => storage).load()).toEqual({
        hiddenLeagues: ['NBA', 'MLS'],
        topEventsOnly: false,
        liveOnly: true,
        showDisrupted: false,
        sportColours: {},
      leagueColours: {},
      })
    },
  )
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
