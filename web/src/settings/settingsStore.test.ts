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
      onlyLiveEvents: true,
      sportColors: { Football: '#123456', Soccer: '#abcdef' },
      leagueColors: { NFL: '#fedcba' },
      mapType: 'satellite' as const,
      venuePhotos: false,
      chosenConferences: { 'NCAA Football': ['SEC', 'ACC'] },
      cardCount: 'fewer' as const,
      hotEventIndicator: false,
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

  it('shows a first-time visitor the hot games indicator', () => {
    expect(settingsStore(() => memoryStorage()).load().hotEventIndicator).toBe(true)
  })

  it('remembers the hot games indicator switched off after a page reload', () => {
    const storage = memoryStorage()
    settingsStore(() => storage).save({ ...firstVisitSettings, hotEventIndicator: false })

    expect(settingsStore(() => storage).load().hotEventIndicator).toBe(false)
  })

  it.each([['off'], [0], [null]])('shows the hot games indicator for a saved switch it can\'t read (%j)', (hotEventIndicator) => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], hotEventIndicator }))

    expect(settingsStore(() => storage).load()).toEqual({ ...firstVisitSettings, hiddenLeagues: ['NBA'] })
  })

  it('shows the plain map to a viewer whose settings were saved before there was a satellite map', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'] }))

    expect(settingsStore(() => storage).load().mapType).toBe('plain')
  })

  it.each([['terrain'], [true], [null]])('shows the plain map for a saved map type it doesn\'t know (%j)', (mapType) => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], mapType }))

    expect(settingsStore(() => storage).load()).toEqual({ ...firstVisitSettings, hiddenLeagues: ['NBA'] })
  })

  it('shows a first-time visitor Default card count', () => {
    expect(settingsStore(() => memoryStorage()).load().cardCount).toBe('default')
  })

  it.each([['fewer'], ['more']] as const)('remembers the card count picked (%s) after a page reload', (cardCount) => {
    const storage = memoryStorage()
    settingsStore(() => storage).save({ ...firstVisitSettings, cardCount })

    expect(settingsStore(() => storage).load().cardCount).toBe(cardCount)
  })

  it('shows Default card count to a viewer whose settings were saved before it could be picked', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'] }))

    expect(settingsStore(() => storage).load()).toEqual({ ...firstVisitSettings, hiddenLeagues: ['NBA'] })
  })

  it.each([['sparse'], [25], [null]])('shows Default card count for a saved one it doesn\'t know (%j)', (cardCount) => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], cardCount }))

    expect(settingsStore(() => storage).load()).toEqual({ ...firstVisitSettings, hiddenLeagues: ['NBA'] })
  })

  it('shows venue photos to a first-time visitor', () => {
    expect(settingsStore(() => memoryStorage()).load().venuePhotos).toBe(true)
  })

  it('shows venue photos to a viewer whose settings were saved before they could be switched off', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'] }))

    expect(settingsStore(() => storage).load().venuePhotos).toBe(true)
  })

  it.each([['no'], [0], [null]])('shows venue photos for a saved switch it doesn\'t understand (%j)', (venuePhotos) => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ venuePhotos }))

    expect(settingsStore(() => storage).load().venuePhotos).toBe(true)
  })

  it('keeps each saved setting it understands and defaults the rest', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA', 7], topEventsOnly: 'yes' }))

    expect(settingsStore(() => storage).load()).toEqual({
      hiddenLeagues: ['NBA'],
      topEventsOnly: false,
      onlyLiveEvents: false,
      sportColors: {},
      leagueColors: {},
      mapType: 'plain',
      venuePhotos: true,
      chosenConferences: {},
      cardCount: 'default',
      hotEventIndicator: true,
    })
  })

  it('loads settings saved before colors could be picked with no colors', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'], topEventsOnly: true }))

    expect(settingsStore(() => storage).load()).toEqual({
      hiddenLeagues: ['NBA'],
      topEventsOnly: true,
      onlyLiveEvents: false,
      sportColors: {},
      leagueColors: {},
      mapType: 'plain',
      venuePhotos: true,
      chosenConferences: {},
      cardCount: 'default',
      hotEventIndicator: true,
    })
  })

  it('keeps each saved color it understands and drops the rest', () => {
    const storage = memoryStorage()
    storage.setItem(
      'scoremap.settings',
      JSON.stringify({ sportColors: { Football: '#123456', Soccer: 'red', Hockey: 7, Baseball: '#12345' } }),
    )

    expect(settingsStore(() => storage).load().sportColors).toEqual({ Football: '#123456' })
  })

  it('loads settings saved before leagues could be colored with no league colors, keeping sport colors', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ sportColors: { Football: '#123456' } }))

    const loaded = settingsStore(() => storage).load()

    expect(loaded.sportColors).toEqual({ Football: '#123456' })
    expect(loaded.leagueColors).toEqual({})
  })

  it('keeps each saved league color it understands and drops the rest', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ leagueColors: { NFL: '#abcdef', NBA: 'blue', MLS: 3 } }))

    expect(settingsStore(() => storage).load().leagueColors).toEqual({ NFL: '#abcdef' })
  })

  it('keeps each saved conference choice it understands and drops the rest', () => {
    const storage = memoryStorage()
    storage.setItem(
      'scoremap.settings',
      JSON.stringify({ chosenConferences: { 'NCAA Football': ['SEC', 3], "NCAA Men's Basketball": 'ACC', NFL: null } }),
    )

    expect(settingsStore(() => storage).load().chosenConferences).toEqual({ 'NCAA Football': ['SEC'] })
  })

  it('loads settings saved before conferences could be chosen with none chosen', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ hiddenLeagues: ['NBA'] }))

    expect(settingsStore(() => storage).load().chosenConferences).toEqual({})
  })

  it('loads colors saved under their old British names, sportColours and leagueColours', () => {
    const storage = memoryStorage()
    storage.setItem(
      'scoremap.settings',
      JSON.stringify({ sportColours: { Football: '#123456' }, leagueColours: { NFL: '#abcdef', NBA: 'blue' } }),
    )

    const loaded = settingsStore(() => storage).load()

    expect(loaded.sportColors).toEqual({ Football: '#123456' })
    expect(loaded.leagueColors).toEqual({ NFL: '#abcdef' })
  })

  it('saves colors loaded from their old names under the new ones', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ sportColours: { Football: '#123456' } }))
    const store = settingsStore(() => storage)

    store.save(store.load())

    const saved = JSON.parse(storage.getItem('scoremap.settings') ?? '{}') as Record<string, unknown>
    expect(saved.sportColors).toEqual({ Football: '#123456' })
    expect(saved).not.toHaveProperty('sportColours')
  })

  it.each([['red'], [['#123456']], [null]])('loads no colors when what was saved for them is %j', (sportColors) => {
    const storage = memoryStorage()
    storage.setItem('scoremap.settings', JSON.stringify({ sportColors }))

    expect(settingsStore(() => storage).load().sportColors).toEqual({})
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
        onlyLiveEvents: false,
        sportColors: {},
        leagueColors: {},
        mapType: 'plain',
        venuePhotos: true,
        chosenConferences: {},
        cardCount: 'default',
        hotEventIndicator: true,
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

  it('finishes the tour on a reload at All set', () => {
    const storage = memoryStorage()
    const store = settingsStore(() => storage)
    store.save({ ...firstVisitSettings, topEventsOnly: true })
    store.saveTourProgress('allSet')

    expect(settingsStore(() => storage).loadTourProgress()).toBe('finished')
  })

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

describe('settingsStore: the event panel\'s details', () => {
  it('shows a first-time visitor the details minimized', () => {
    expect(settingsStore(() => memoryStorage()).loadDetailsOpen()).toBe(false)
  })

  it('keeps the details open, or minimized again, after a page reload', () => {
    const storage = memoryStorage()

    settingsStore(() => storage).saveDetailsOpen(true)
    expect(settingsStore(() => storage).loadDetailsOpen()).toBe(true)

    settingsStore(() => storage).saveDetailsOpen(false)
    expect(settingsStore(() => storage).loadDetailsOpen()).toBe(false)
  })

  it('keeps the details apart from the settings, so opening them changes none of them', () => {
    const storage = memoryStorage()
    const store = settingsStore(() => storage)
    store.save({ ...firstVisitSettings, topEventsOnly: true })

    store.saveDetailsOpen(true)

    expect(store.load()).toEqual({ ...firstVisitSettings, topEventsOnly: true })
  })

  it('minimizes the details when what was saved is unreadable', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.detailsOpen', '{not json')

    expect(settingsStore(() => storage).loadDetailsOpen()).toBe(false)
  })

  it('still works when the browser blocks storage, with the details minimized', () => {
    const store = settingsStore(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })

    expect(() => store.saveDetailsOpen(true)).not.toThrow()
    expect(store.loadDetailsOpen()).toBe(false)
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

  it('opens with the welcome tour finished every time, on a first visit too, and saves none of its progress', () => {
    const storage = memoryStorage()
    const saved = settingsStore(() => storage)
    saved.saveTourProgress('finished')
    const store = unsavedSettingsStore()

    store.saveTourProgress('scoreCard')

    expect(store.loadTourProgress()).toBe('finished')
    expect(unsavedSettingsStore().loadTourProgress()).toBe('finished')
    expect(saved.loadTourProgress()).toBe('finished')
  })

  it('opens a demo\'s event panels with their details minimized, and saves nothing when they open', () => {
    const storage = memoryStorage()
    const saved = settingsStore(() => storage)
    const store = unsavedSettingsStore()

    store.saveDetailsOpen(true)

    expect(store.loadDetailsOpen()).toBe(false)
    expect(saved.loadDetailsOpen()).toBe(false)
  })
})
