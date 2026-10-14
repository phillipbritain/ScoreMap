import { useEffect, useRef, useState } from 'react'
import { pickerEntries, pillLabel, type ScenarioListing } from './scenarioPicker'
import { switchScenario } from './useScenarioControls'

/**
 * The scenario picker (ADR-0009): a pill naming the running scenario, opening a list of every scenario
 * plus "Real games". Picking one switches the server, and so every browser: the server then sends every
 * browser the new listing over the games hub, so each pill follows (see switchScenario).
 *
 * The open list closes on Escape and on a press anywhere outside it. Over the globe, a see-through
 * cover takes that press and the click it ends in, so closing the list doesn't also pan or select.
 */
export function ScenarioPill({
  listing,
  setListing,
  refresh,
}: {
  listing: ScenarioListing
  setListing: (listing: ScenarioListing) => void
  refresh: () => void
}) {
  const [switching, setSwitching] = useState(false)
  const [open, setOpen] = useState(false)
  // Up from the list opening until the click that closed it ends, so that click lands on the cover.
  const [covering, setCovering] = useState(false)
  const details = useRef<HTMLDetailsElement>(null)
  // Whether a press on the cover is under way: the list closing then leaves the cover up until it ends.
  const coverPressed = useRef(false)

  const uncover = () => {
    coverPressed.current = false
    setCovering(false)
  }

  const close = () => {
    if (details.current) details.current.open = false
  }

  const switchTo = (name: string) => {
    setSwitching(true)
    switchScenario(name, setListing)
      .then(close)
      .catch((error: unknown) => console.error(`Could not switch to ${name}`, error))
      .finally(() => setSwitching(false))
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    // A press on anything above the cover (the settings menu, the game panel, the tuners) closes it too.
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node && details.current?.contains(event.target))) close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [open])

  return (
    <>
      {covering && (
        <div
          className="scenario-pill__cover"
          onPointerDown={(event) => {
            coverPressed.current = true
            event.preventDefault()
          }}
          onClick={uncover}
          onPointerCancel={uncover}
        />
      )}
      <details
        ref={details}
        className="scenario-pill"
        onToggle={(event) => {
          const isOpen = event.currentTarget.open
          setOpen(isOpen)
          // Fetched again on opening the list, to pick up new scenario files.
          if (isOpen) {
            setCovering(true)
            refresh()
          } else if (!coverPressed.current) setCovering(false)
        }}
      >
        <summary>{pillLabel(listing)} ▾</summary>
        <ul>
          {pickerEntries(listing).map((entry) => (
            <li key={entry.name}>
              <button
                type="button"
                aria-current={entry.running}
                disabled={switching}
                onClick={() => switchTo(entry.name)}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </>
  )
}
