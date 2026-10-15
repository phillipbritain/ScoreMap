import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Camera } from '../globe/camera'
import type { League, ViewerSettings } from '../settings/viewerSettings'
import { Colours } from './Colours'
import { Leagues } from './Leagues'
import { canZoom, nextPopover, railToggles, toggled, type PopoverEvent, type RailPopover } from './railControls'

interface RailProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  /**
   * The theme's accent (see accentColour), as #rrggbb, which a sport or league with no colour picked
   * shows hollow in Colours.
   */
  accent: string
  /** Where the globe's camera last settled, or null while the globe can't be moved yet (loading). */
  camera: Camera | null
  onZoomIn: () => void
  onZoomOut: () => void
  /** Flies the camera back to the viewer's region, all the way out (see homeCamera). */
  onHome: () => void
}

/**
 * The rail: a column of icon buttons at the top right of the globe, in three groups. Zoom in, zoom
 * out and Home, which move the camera. The "Live only" and "Show Disrupted games" toggles, each
 * showing a short toast beside the rail saying what changed, since a phone has no hover for their
 * tooltips. Leagues and Colours, each opening a popover to the left of the rail: one at a time,
 * closed by its button, Escape or a click anywhere outside it.
 */
export function Rail({ leagues, settings, onChange, accent, camera, onZoomIn, onZoomOut, onHome }: RailProps) {
  const zoom = camera ? canZoom(camera) : { in: false, out: false }
  const [open, setOpen] = useState<RailPopover | null>(null)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const popover = useRef<HTMLDivElement>(null)
  const popoverEvent = (event: PopoverEvent) => setOpen((current) => nextPopover(current, event))

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen((current) => nextPopover(current, 'escape'))
    }
    // In the capture phase, so the globe can't keep a click on it from closing the popover. A
    // popover's button isn't outside: its own press opens or closes it.
    const onPointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (popover.current?.contains(target) || target.closest('[data-popover-button]')) return
      setOpen((current) => nextPopover(current, 'outside'))
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [open])

  return (
    <div className="rail">
      <div className="rail__group">
        <RailButton label="Zoom in" disabled={!zoom.in} onClick={onZoomIn}>
          <path d="M12 5v14M5 12h14" />
        </RailButton>
        <RailButton label="Zoom out" disabled={!zoom.out} onClick={onZoomOut}>
          <path d="M5 12h14" />
        </RailButton>
        <RailButton label="Home" disabled={!camera} onClick={onHome}>
          <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </RailButton>
      </div>
      <div className="rail__group">
        {railToggles.map(({ key, name }) => (
          <RailButton
            key={key}
            label={name}
            title={`${name}: ${settings[key] ? 'on' : 'off'}`}
            pressed={settings[key]}
            onClick={() => {
              const next = toggled(settings, key)
              onChange(next.settings)
              setToast({ text: next.toast, id: (toast?.id ?? 0) + 1 })
            }}
          >
            {key === 'liveOnly' ? <LiveIcon /> : <DisruptedIcon />}
          </RailButton>
        ))}
        {toast && (
          // Keyed, so a second press while it shows plays its fade afresh. Gone once it has faded.
          <p key={toast.id} className="rail__toast" role="status" onAnimationEnd={() => setToast(null)}>
            {toast.text}
          </p>
        )}
      </div>
      <div className="rail__group">
        <RailButton label="Leagues" popover="leagues" open={open} onClick={() => popoverEvent({ press: 'leagues' })}>
          <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </RailButton>
        <RailButton label="Colours" popover="colours" open={open} onClick={() => popoverEvent({ press: 'colours' })}>
          <PaletteIcon />
        </RailButton>
      </div>
      {open && (
        <div ref={popover} id="rail-popover" className="rail__popover" role="dialog" aria-label={popoverNames[open]}>
          {open === 'leagues' ? (
            <Leagues leagues={leagues} settings={settings} onChange={onChange} />
          ) : (
            <Colours leagues={leagues} settings={settings} onChange={onChange} accent={accent} />
          )}
        </div>
      )}
    </div>
  )
}

const popoverNames: Record<RailPopover, string> = { leagues: 'Leagues', colours: 'Colours' }

/**
 * One of the rail's icon buttons, with its name as a tooltip. A toggle is pressed or not; a popover's
 * button says whether its popover is open.
 */
function RailButton({
  label,
  title = label,
  disabled,
  pressed,
  popover,
  open,
  onClick,
  children,
}: {
  label: string
  title?: string
  disabled?: boolean
  pressed?: boolean
  popover?: RailPopover
  open?: RailPopover | null
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="rail__button"
      aria-label={label}
      title={title}
      disabled={disabled}
      aria-pressed={pressed}
      aria-haspopup={popover && 'dialog'}
      aria-expanded={popover && open === popover}
      aria-controls={popover && open === popover ? 'rail-popover' : undefined}
      data-popover-button={popover}
      onClick={onClick}
    >
      <svg
        className="rail__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  )
}

/** Live only: a broadcast's waves (Feather's "radio"). */
function LiveIcon() {
  return (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
    </>
  )
}

/** Show Disrupted games: a warning triangle (Feather's "alert-triangle"). */
function DisruptedIcon() {
  return <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
}

/** Colours: a painter's palette. */
function PaletteIcon() {
  return (
    <>
      <circle cx="13.5" cy="6.5" r="1" />
      <circle cx="17.5" cy="10.5" r="1" />
      <circle cx="8.5" cy="7.5" r="1" />
      <circle cx="6.5" cy="12.5" r="1" />
      <path d="M12 2a10 10 0 0 0 0 20c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6h1.9A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9z" />
    </>
  )
}
