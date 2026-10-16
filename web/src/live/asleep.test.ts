import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchForSleep, type PageVisibility } from './asleep'

const minutes = (n: number) => n * 60_000

/** A page whose visibility the test sets, telling its listeners as the browser does. */
function fakePage(startHidden = false) {
  const listeners = new Set<() => void>()
  let hidden = startHidden
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

describe('watchForSleep', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const watch = (page: PageVisibility, timeout = minutes(5)) => {
    const calls: string[] = []
    const stop = watchForSleep(page, timeout, { onSleep: () => calls.push('sleep'), onWake: () => calls.push('wake') })
    return { calls, stop }
  }

  it('falls asleep once the page has been hidden for the idle timeout', () => {
    const { page, hide } = fakePage()
    const { calls } = watch(page)

    hide()
    vi.advanceTimersByTime(minutes(5) - 1)
    expect(calls).toEqual([])
    vi.advanceTimersByTime(1)
    expect(calls).toEqual(['sleep'])
  })

  it('never falls asleep while the page is shown', () => {
    const { calls } = watch(fakePage().page)

    vi.advanceTimersByTime(minutes(60))
    expect(calls).toEqual([])
  })

  it('does nothing when the page is shown again before the idle timeout', () => {
    const { page, hide, show } = fakePage()
    const { calls } = watch(page)

    hide()
    vi.advanceTimersByTime(minutes(4))
    show()
    vi.advanceTimersByTime(minutes(60))
    expect(calls).toEqual([])
  })

  it('counts afresh each time the page is hidden', () => {
    const { page, hide, show } = fakePage()
    const { calls } = watch(page)

    hide()
    vi.advanceTimersByTime(minutes(4))
    show()
    hide()
    vi.advanceTimersByTime(minutes(4))
    expect(calls).toEqual([])
    vi.advanceTimersByTime(minutes(1))
    expect(calls).toEqual(['sleep'])
  })

  it('wakes when the page is shown again after falling asleep, ready to fall asleep again', () => {
    const { page, hide, show } = fakePage()
    const { calls } = watch(page)

    hide()
    vi.advanceTimersByTime(minutes(5))
    show()
    expect(calls).toEqual(['sleep', 'wake'])

    hide()
    vi.advanceTimersByTime(minutes(5))
    expect(calls).toEqual(['sleep', 'wake', 'sleep'])
  })

  it('counts from the start for a page that opens hidden', () => {
    const { calls } = watch(fakePage(true).page)

    vi.advanceTimersByTime(minutes(5))
    expect(calls).toEqual(['sleep'])
  })

  it('takes the idle timeout it is given', () => {
    const { page, hide } = fakePage()
    const { calls } = watch(page, minutes(1))

    hide()
    vi.advanceTimersByTime(minutes(1))
    expect(calls).toEqual(['sleep'])
  })

  it('stops watching when stopped', () => {
    const { page, hide, show } = fakePage()
    const { calls, stop } = watch(page)

    hide()
    stop()
    vi.advanceTimersByTime(minutes(60))
    show()
    expect(calls).toEqual([])
  })
})
