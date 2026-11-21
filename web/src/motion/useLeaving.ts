import { useEffect, useState } from 'react'

/** What useLeaving gives: what to show, whether it's on its way out, and a key that's new each time it's opened afresh. */
export interface Leaving<T> {
  shown: T | null
  leaving: boolean
  /**
   * New each time something is given after nothing was (even while the last is still leaving), for
   * keying what's shown: what's opened again comes in afresh, rather than taking over the one going.
   */
  key: number
}

/**
 * Something shown while it's given (a rail popover, the event panel), kept on the page `duration`
 * milliseconds once it's no longer given, so it can play its way out (its look is the CSS's); with the
 * device's reduce motion setting on, it goes at once. `value` should keep its identity from one render
 * to the next while it's the same thing. `duration` can depend on what's leaving, for something that
 * leaves its own way at times (the event panel closing itself after its game's celebration).
 */
export function useLeaving<T>(value: T | null, duration: number | ((leaving: T) => number)): Leaving<T> {
  const [given, setGiven] = useState<T | null>(value)
  const [going, setGoing] = useState<T | null>(null)
  const [key, setKey] = useState(0)
  if (value !== given) {
    setGiven(value)
    if (value === null) setGoing(given)
    else {
      if (given === null) setKey(key + 1)
      setGoing(null)
    }
  }
  useEffect(() => {
    if (going === null) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lasts = typeof duration === 'number' ? duration : duration(going)
    const timer = setTimeout(() => setGoing(null), reduce ? 0 : lasts)
    return () => clearTimeout(timer)
  }, [going, duration])
  if (value !== null) return { shown: value, leaving: false, key }
  return { shown: going, leaving: going !== null, key }
}
