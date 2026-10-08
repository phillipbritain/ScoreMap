import { useEffect, useRef, useState } from 'react'
import { speedChangeable, speedEntries, speedLabel, type ScenarioListing } from './scenarioPicker'
import { putScenarios } from './useScenarioControls'

/**
 * The speed pill (ADR-0009): the scenario clock's speed, opening a list of speeds. Picking one changes
 * the server's speed, and so every browser's, carrying on from where the scenario is. While real games
 * run it shows the speed but doesn't open.
 */
export function SpeedPill({
  listing,
  setListing,
}: {
  listing: ScenarioListing
  setListing: (listing: ScenarioListing) => void
}) {
  const [changing, setChanging] = useState(false)
  const details = useRef<HTMLDetailsElement>(null)
  const changeable = speedChangeable(listing)

  // A switch to real games, made in any tab, closes an open list.
  useEffect(() => {
    if (!changeable && details.current) details.current.open = false
  }, [changeable])

  const changeTo = (speed: number) => {
    setChanging(true)
    putScenarios('speed', { speed })
      .then((changed) => {
        setListing(changed)
        if (details.current) details.current.open = false
      })
      .catch((error: unknown) => console.error(`Could not change the speed to ${speed}`, error))
      .finally(() => setChanging(false))
  }

  return (
    <details ref={details} className="scenario-pill speed-pill" aria-disabled={!changeable}>
      <summary
        title={changeable ? 'Scenario speed' : 'Real games play in real time'}
        onClick={(event) => {
          if (!changeable) event.preventDefault()
        }}
      >
        {speedLabel(listing.speed)} ▾
      </summary>
      <ul>
        {speedEntries(listing).map((entry) => (
          <li key={entry.speed}>
            <button
              type="button"
              aria-current={entry.current}
              disabled={changing || !changeable}
              onClick={() => changeTo(entry.speed)}
            >
              {entry.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
