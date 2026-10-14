import { useEffect, useMemo, useState } from 'react'
import { clockTime } from '../panel/dualTime'
import { clockReading, untilNextSecond, type ScenarioListing } from './scenarioPicker'

/**
 * The scenario clock (ADR-0009), run forward in the browser from where the server last said it was.
 * Shown only where play can be controlled. It wakes only when the second it shows changes, so while
 * paused it does nothing until a new listing comes.
 */
export function ScenarioClock({ listing }: { listing: ScenarioListing }) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const delay = untilNextSecond(listing, Date.now())
    if (delay === null) return
    const tick = setTimeout(() => setNow(Date.now()), delay)
    return () => clearTimeout(tick)
  }, [listing, now])

  // A new listing renders with the last tick's `now`, which is before its anchor, so it shows the new reading at once.
  const second = Math.floor(clockReading(listing, now).getTime() / 1000)
  const shown = useMemo(() => new Date(second * 1000), [second])
  const text = useMemo(() => clockTime(shown), [shown])
  return (
    <time className="scenario-clock" dateTime={shown.toISOString()}>
      {text}
    </time>
  )
}
