import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Game } from '../games/game'
import type { PageVisibility } from './asleep'
import { startLiveGames, type GamesHub, type GamesHubEvents, type LiveGames } from './liveGames'

const minutes = (n: number) => n * 60_000
const idleTimeout = minutes(5)

const game = (id: string, score = '0') => ({ id, score }) as unknown as Game

/** A page whose visibility the test sets, telling its listeners as the browser does. */
function fakePage() {
  const listeners = new Set<() => void>()
  let hidden = false
  const set = (to: boolean) => {
    hidden = to
    for (const listener of listeners) listener()
  }
  const page: PageVisibility = {
    get hidden() {
      return hidden
    },
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
  }
  return { page, hide: () => set(true), show: () => set(false) }
}

/** One connection the fake hub made: the test settles its start and sends what the server would. */
interface FakeConnection {
  events: GamesHubEvents
  demo: boolean
  starts: number
  stopped: boolean
  /** Settles the latest start: connected, or failed. */
  connect: () => Promise<void>
  fail: () => Promise<void>
}

/** A games hub whose connections the test drives. */
function fakeHub() {
  const connections: FakeConnection[] = []
  const hub: GamesHub = (events, demo) => {
    let settle: { resolve: () => void; reject: (error: Error) => void } | undefined
    const connection: FakeConnection = {
      events,
      demo,
      starts: 0,
      stopped: false,
      connect: async () => {
        settle?.resolve()
        await flush()
      },
      fail: async () => {
        settle?.reject(new Error('no server'))
        await flush()
      },
    }
    connections.push(connection)
    return {
      start: () => {
        connection.starts++
        return new Promise<void>((resolve, reject) => (settle = { resolve, reject }))
      },
      stop: async () => {
        connection.stopped = true
      },
    }
  }
  return {
    hub,
    connections,
    get latest() {
      return connections.at(-1)!
    },
  }
}

/** Lets settled promises run their callbacks. */
const flush = () => vi.advanceTimersByTimeAsync(0)

describe('live games', () => {
  let clock = 0
  let live: LiveGames | undefined
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    clock = 1_000
  })
  afterEach(() => {
    live?.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const start = ({ demo = false } = {}) => {
    const page = fakePage()
    const hub = fakeHub()
    const scenarios: unknown[] = []
    live = startLiveGames(
      {
        page: page.page,
        idleTimeoutMs: idleTimeout,
        demo,
        hub: hub.hub,
        onScenarioChanged: (listing) => scenarios.push(listing),
        now: () => clock,
      },
      () => {},
    )
    return { live, page, hub, scenarios }
  }

  it('has no games until the first snapshot, then the snapshot’s games', async () => {
    const { live, hub } = start()
    expect(live.state.games).toBeNull()

    await hub.latest.connect()
    hub.latest.events.snapshot([game('a'), game('b')])

    expect(live.state).toEqual({
      games: [game('a'), game('b')],
      fromSnapshot: true,
      cutOffSince: null,
      waking: false,
    })
  })

  it('applies each change to the games, which no longer stand as a snapshot brought them', async () => {
    const { live, hub } = start()
    await hub.latest.connect()
    hub.latest.events.snapshot([game('a'), game('b')])

    hub.latest.events.change({ kind: 'ScoreChanged', game: game('a', '7') })
    hub.latest.events.change({ kind: 'Removed', game: game('b') })

    expect(live.state.games).toEqual([game('a', '7')])
    expect(live.state.fromSnapshot).toBe(false)
  })

  it('drops a change that comes before any snapshot, as it has nothing to apply to', async () => {
    const { live, hub } = start()
    await hub.latest.connect()

    hub.latest.events.change({ kind: 'Added', game: game('a') })
    expect(live.state.games).toBeNull()

    hub.latest.events.snapshot([game('b')])
    expect(live.state.games).toEqual([game('b')])
  })

  it('tells a snapshot of no games apart from no snapshot yet', async () => {
    const { live, hub } = start()
    await hub.latest.connect()

    hub.latest.events.snapshot([])

    expect(live.state.games).toEqual([])
  })

  it('watches the demo’s games in a demo, and passes on scenario changes', async () => {
    const { hub, scenarios } = start({ demo: true })
    expect(hub.latest.demo).toBe(true)
    await hub.latest.connect()

    hub.latest.events.scenarioChanged({ active: 'x' } as never)

    expect(scenarios).toEqual([{ active: 'x' }])
  })

  it('is cut off from when the connection drops until the snapshot after it reconnects', async () => {
    const { live, hub } = start()
    await hub.latest.connect()
    hub.latest.events.snapshot([game('a')])
    hub.latest.events.change({ kind: 'Added', game: game('b') })

    clock = 5_000
    hub.latest.events.reconnecting()
    clock = 9_000
    hub.latest.events.reconnecting()
    expect(live.state.cutOffSince).toBe(5_000)
    expect(live.state.games).toEqual([game('a'), game('b')])

    hub.latest.events.snapshot([game('c')])
    expect(live.state).toEqual({ games: [game('c')], fromSnapshot: true, cutOffSince: null, waking: false })
  })

  it('starts the connection again when it closes, as cut off', async () => {
    const { live, hub } = start()
    await hub.latest.connect()
    hub.latest.events.snapshot([game('a')])

    hub.latest.events.closed()
    expect(live.state.cutOffSince).toBe(clock)
    expect(hub.latest.starts).toBe(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(hub.latest.starts).toBe(2)

    await hub.latest.connect()
    hub.latest.events.snapshot([game('b')])
    expect(live.state.cutOffSince).toBeNull()
  })

  it('keeps trying to make the first connection, waiting longer each time up to 30 seconds', async () => {
    const { live, hub } = start()
    const waits: number[] = []
    for (let attempt = 0; attempt < 7; attempt++) {
      const starts = hub.latest.starts
      await hub.latest.fail()
      let waited = 0
      while (hub.latest.starts === starts) {
        await vi.advanceTimersByTimeAsync(1_000)
        waited += 1_000
      }
      waits.push(waited)
    }

    expect(waits).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000])
    expect(hub.connections).toHaveLength(1)
    // Not yet connected, the loading screen says so: not cut off.
    expect(live.state.cutOffSince).toBeNull()
  })

  it('stops trying when stopped while waiting to try again', async () => {
    const { live, hub } = start()
    await hub.latest.fail()

    live.stop()
    await vi.advanceTimersByTimeAsync(minutes(1))

    expect(hub.latest.starts).toBe(1)
    expect(hub.latest.stopped).toBe(true)
  })

  describe('asleep', () => {
    it('disconnects once the page has been hidden for the idle timeout', async () => {
      const { hub, page } = start()
      await hub.latest.connect()

      page.hide()
      await vi.advanceTimersByTimeAsync(idleTimeout - 1)
      expect(hub.latest.stopped).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(hub.latest.stopped).toBe(true)
    })

    it('falling asleep while the first connection is still being made, disconnects once it’s made', async () => {
      const { hub, page } = start()

      page.hide()
      await vi.advanceTimersByTimeAsync(idleTimeout)
      expect(hub.latest.stopped).toBe(false)
      await hub.latest.connect()

      expect(hub.latest.stopped).toBe(true)
      expect(hub.connections).toHaveLength(1)
    })

    it('waking connects afresh, as cut off and waking, until the snapshot', async () => {
      const { live, hub, page } = start()
      await hub.latest.connect()
      hub.latest.events.snapshot([game('a')])
      hub.latest.events.change({ kind: 'Added', game: game('b') })
      page.hide()
      await vi.advanceTimersByTimeAsync(idleTimeout)

      clock = 50_000
      page.show()
      expect(hub.connections).toHaveLength(2)
      expect(live.state).toEqual({
        games: [game('a'), game('b')],
        fromSnapshot: false,
        cutOffSince: 50_000,
        waking: true,
      })

      await hub.latest.connect()
      hub.latest.events.snapshot([game('c')])
      expect(live.state).toEqual({ games: [game('c')], fromSnapshot: true, cutOffSince: null, waking: false })
    })

    it('shown again before the idle timeout, stays connected', async () => {
      const { live, hub, page } = start()
      await hub.latest.connect()

      page.hide()
      await vi.advanceTimersByTimeAsync(idleTimeout - 1)
      page.show()
      await vi.advanceTimersByTimeAsync(minutes(60))

      expect(hub.connections).toHaveLength(1)
      expect(hub.latest.stopped).toBe(false)
      expect(live.state.waking).toBe(false)
    })

    it('ignores whatever a retired connection still sends', async () => {
      const { live, hub, page, scenarios } = start()
      await hub.latest.connect()
      hub.latest.events.snapshot([game('a')])
      const retired = hub.latest
      page.hide()
      await vi.advanceTimersByTimeAsync(idleTimeout)
      page.show()

      retired.events.snapshot([game('old')])
      retired.events.change({ kind: 'Added', game: game('old') })
      retired.events.scenarioChanged({ active: 'old' } as never)
      retired.events.closed()
      await vi.advanceTimersByTimeAsync(minutes(1))

      expect(live.state.games).toEqual([game('a')])
      expect(live.state.waking).toBe(true)
      expect(scenarios).toEqual([])
      expect(retired.starts).toBe(1)
    })

    it('stops trying to make a connection on falling asleep', async () => {
      const { hub, page } = start()

      page.hide()
      for (let tries = 0; tries < 20; tries++) {
        await hub.latest.fail()
        await vi.advanceTimersByTimeAsync(30_000)
      }
      const starts = hub.latest.starts
      await hub.latest.fail()
      await vi.advanceTimersByTimeAsync(minutes(60))

      expect(starts).toBeGreaterThan(1)
      expect(hub.latest.starts).toBe(starts)
    })

    it('a new idle timeout counts from when it’s set, asleep or not', async () => {
      const { live, hub, page } = start()
      await hub.latest.connect()
      page.hide()
      await vi.advanceTimersByTimeAsync(minutes(4))

      live.setIdleTimeout(minutes(10))
      await vi.advanceTimersByTimeAsync(minutes(10) - 1)
      expect(hub.latest.stopped).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(hub.latest.stopped).toBe(true)

      live.setIdleTimeout(minutes(1))
      page.show()
      expect(live.state.waking).toBe(true)
      expect(hub.connections).toHaveLength(2)
    })
  })
})
