import { useEffect, useRef, useState } from 'react'
import { useClickAway } from '../menus/clickAway'
import { satelliteCredit } from './globeStyle'

/**
 * The satellite map's credit, which EOX's licence asks for wherever its imagery shows (ADR-0022): a
 * small info button at the bottom left of the globe, labelled Map credits, while the satellite map is
 * on (else hidden), and while Map Type is open, which shows a picture of it (see the CSS). Pressing it
 * shows the credit, with its links, beside it; pressing it again, a click away or Escape hides it.
 */
export function MapCredit({ hidden }: { hidden: boolean }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const { name, url, by, data } = satelliteCredit

  useClickAway(open, (target) => box.current?.contains(target) ?? false, () => setOpen(false))

  // Escape hides it, back on the button if focus was in it.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (box.current?.contains(document.activeElement)) button.current?.focus()
      setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div ref={box} className="map-credit" hidden={hidden}>
      <button
        ref={button}
        type="button"
        className="map-credit__button"
        aria-label="Map credits"
        aria-expanded={open}
        aria-controls="map-credit-text"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {/* An i, in the round button: an info sign. */}
        <svg className="map-credit__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 11v7M12 6.5h.01" />
        </svg>
      </button>
      <p id="map-credit-text" className="map-credit__text" hidden={!open}>
        <a href={url} target="_blank" rel="noreferrer">
          {name}
        </a>{' '}
        by {by} ({data})
      </p>
    </div>
  )
}
