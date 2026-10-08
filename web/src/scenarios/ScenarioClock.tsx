import { useEffect, useState } from 'react'
import { clockTime } from '../panel/dualTime'
import { clockReading, type ScenarioListing } from './scenarioPicker'

// Often enough that the seconds tick over on time at 1×.
const tickMs = 100

/**
 * The clock games are on (ADR-0009): the scenario clock while a scenario runs, run forward in the
 * browser from where the server last said it was, or the real time while real games run.
 */
export function ScenarioClock({ listing }: { listing: ScenarioListing }) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), tickMs)
    return () => clearInterval(tick)
  }, [])

  const reading = clockReading(listing, now)
  return (
    <time className="scenario-clock" dateTime={reading.toISOString()}>
      {clockTime(reading)}
    </time>
  )
}
