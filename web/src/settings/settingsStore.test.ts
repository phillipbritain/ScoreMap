import { describe, expect, it } from 'vitest'
import { finishedTour } from '../../scripts/page/finishedTour.ts'
import { settingsStore, unsavedSettingsStore, type SettingsStorage } from './settingsStore'
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
  it('gives a first-time visitor every league on', () => {
    expect(settingsStore(() => memoryStorage()).load()).toEqual(firstVisitSettings)
  })

  it('remembers saved settings after a page reload', () => {
    const storage = memoryStorage()
    const chosen = {
      hiddenLeagues: ['NBA', 'MLS'],
      topEventsOnly: true,
      sportColours: { Football: '#123456', Soccer: '#abcdef' },
      leagueColours: { NFL: '#fedcba' },
      hotGameFlames: false,
    }

    settingsStore(() => storage).save(chosen)
    const afterReload = settingsStore(() => storage)

    expect(afterReload.load()).toEqual(chosen)
  })

  it('still works when the browser blocks storage', () => {
    const store = settingsStore(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })

    expect(() => store.save({ ...firstVisitSettings, hiddenLeagues: ['NBA'], topEventsOnly: true })).not.toThrow()
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

    expect(() => store.save({ ...firstVisitSettings, hiddenLeagues: ['NBA'], topEventsOnly: true })).not.toThrow()
    expect(store.load()).toEqual(firstVisitSettings)
  })

  it('falls back to first-visit settings when what was saved is unreadable', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', '{not json')

    expect(settingsStore(() => storage).load()).toEqual(firstVisitSettings)
  })

  it('has Top Events off for a viewer whose settings were saved before that setting existed', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'] }))

    expect(settingsStore(() => storage).load().topEventsOnly).toBe(false)
  })

  it('ignores the "Live games only" and "Show Disrupted games" switches an older visit saved, and saves them no more', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], liveOnly: true, showDisrupted: false }))
    const store = settingsStore(() => storage)

    const loaded = store.load()
    expect(loaded).toEqual({ ...firstVisitSettings, hiddenLeagues: ['NBA'] })
    store.save(loaded)
    expect(JSON.parse(storage.getItem('scoremap.settings')!)).not.toHaveProperty('liveOnly')
    expect(JSON.parse(storage.getItem('scoremap.settings')!)).not.toHaveProperty('showDisrupted')
  })

  it('shows flames on hot games to a viewer whose settings were saved before that setting existed', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'] }))

    expect(settingsStore(() => storage).load().hotGameFlames).toBe(true)
  })

  it('keeps each saved setting it understands and defaults the rest', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA', 7], topEventsOnly: 'yes', hotGameFlames: 0 }))

    expect(settingsStore(() => storage).load()).toEqual({
      hiddenLeagues: ['NBA'],
      topEventsOnly: false,
      sportColours: {},
      leagueColours: {},
      hotGameFlames: true,
    })
  })

  it('loads settings saved before colours could be picked with no colours', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], topEventsOnly: true }))

    expect(settingsStore(() => storage).load()).toEqual({
      hiddenLeagues: ['NBA'],
      topEventsOnly: true,
      sportColours: {},
      leagueColours: {},
      hotGameFlames: true,
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
        JSON.stringify({ hiddenLeagues: ['NBA', 'MLS'], topEventsOnly: true, cardStyle }),
      )

      expect(settingsStore(() => storage).load()).toEqual({
        hiddenLeagues: ['NBA', 'MLS'],
        topEventsOnly: true,
        sportColours: {},
        leagueColours: {},
        hotGameFlames: true,
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
    store.save({ ...firstVisitSettings, topEventsOnly: true })
    store.saveCamera({ longitude: 10, latitude: 50, zoom: 3 })

    expect(store.load()).toEqual({ ...firstVisitSettings, topEventsOnly: true })
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

describe('settingsStore welcome tour progress', () => {
  it('starts a first-time visitor at Welcome', () => {
    expect(settingsStore(() => memoryStorage()).loadTourProgress()).toBe('welcome')
  })

  it('counts a viewer with settings saved before the tour existed as finished', () => {
    const storage = memoryStorage()
    settingsStore(() => storage).save({ ...firstVisitSettings, topEventsOnly: true })

    expect(settingsStore(() => storage).loadTourProgress()).toBe('finished')
  })

  it.each(['welcome', 'controls', 'scoreCard', 'finished'] as const)(
    'carries on at %s after a page reload, though settings are saved too',
    (progress) => {
      const storage = memoryStorage()
      const store = settingsStore(() => storage)
      store.save({ ...firstVisitSettings, topEventsOnly: true })
      store.saveTourProgress(progress)

      expect(settingsStore(() => storage).loadTourProgress()).toBe(progress)
    },
  )

  it('keeps the progress apart from the other settings', () => {
    const storage = memoryStorage()
    const store = settingsStore(() => storage)
    store.save({ ...firstVisitSettings, topEventsOnly: true })
    store.saveTourProgress('controls')

    expect(store.load()).toEqual({ ...firstVisitSettings, topEventsOnly: true })
  })

  it.each(['{not json', JSON.stringify('halfway'), JSON.stringify(3)])(
    'counts an unreadable saved progress (%s) as finished, as something was saved before',
    (saved) => {
      const storage = memoryStorage()
      storage.setItem('scoremap.welcomeTour', saved)

      expect(settingsStore(() => storage).loadTourProgress()).toBe('finished')
    },
  )

  it('saves a finished tour as `npm run page -- reset --toured` sets it', () => {
    const items = new Map<string, string>()
    settingsStore(() => ({ getItem: () => null, setItem: (key, value) => void items.set(key, value) })).saveTourProgress('finished')

    expect([...items]).toEqual([[finishedTour.key, finishedTour.value]])
  })

  it('still works when the browser blocks storage, showing the tour from Welcome', () => {
    const store = settingsStore(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })

    expect(() => store.saveTourProgress('controls')).not.toThrow()
    expect(store.loadTourProgress()).toBe('welcome')
  })
})

describe('unsavedSettingsStore', () => {
  it("opens on first-visit settings and the viewer's region, and saves neither the settings nor the camera", () => {
    const storage = memoryStorage()
    const saved = settingsStore(() => storage)
    saved.save({ ...firstVisitSettings, topEventsOnly: true })
    saved.saveCamera({ longitude: 10, latitude: 20, zoom: 3 })
    const store = unsavedSettingsStore()

    store.save({ ...firstVisitSettings, topEventsOnly: true })
    store.saveCamera({ longitude: -70, latitude: 40, zoom: 2 })

    expect(store.load()).toEqual(firstVisitSettings)
    expect(store.loadCamera()).toBeNull()
    expect(saved.load()).toEqual({ ...firstVisitSettings, topEventsOnly: true })
    expect(saved.loadCamera()).toEqual({ longitude: 10, latitude: 20, zoom: 3 })
  })

  it('starts the welcome tour at Welcome every time and saves none of its progress', () => {
    const storage = memoryStorage()
    const saved = settingsStore(() => storage)
    saved.saveTourProgress('finished')
    const store = unsavedSettingsStore()

    store.saveTourProgress('scoreCard')

    expect(store.loadTourProgress()).toBe('welcome')
    expect(unsavedSettingsStore().loadTourProgress()).toBe('welcome')
    expect(saved.loadTourProgress()).toBe('finished')
  })
})
