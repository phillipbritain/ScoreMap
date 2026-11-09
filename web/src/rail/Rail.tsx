import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Game } from '../games/game'
import { GameNavigation } from '../games/GameNavigation'
import type { Camera } from '../globe/camera'
import type { ZoomSettings } from '../globe/zoomLevels'
import { moveByArrows } from '../menus/arrowKeys'
import { useClickAway } from '../menus/clickAway'
import type { League, ViewerSettings } from '../settings/viewerSettings'
import { DisplaySettings } from './DisplaySettings'
import { Leagues } from './Leagues'
import { MapTypes } from './MapTypes'
import { railIcon, type RailButtonName } from './railButtons'
import { RailIcon } from './railIcons'
import { canZoom, nextPopover, type PopoverEvent, type RailPopover } from './railControls'

interface RailProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  /**
   * The theme's accent (see accentColour), as #rrggbb, which a sport or league with no colour picked
   * shows hollow in Display Settings.
   */
  accent: string
  /** Where the globe's camera last settled, or null while the globe can't be moved yet (loading). */
  camera: Camera | null
  /** How far out and in the globe zooms, which the zoom buttons stop at. */
  zoomSettings: ZoomSettings
  onZoomIn: () => void
  onZoomOut: () => void
  /** Flies the camera back to the viewer's region, at the start zoom (see homeCamera). */
  onHome: () => void
  /** Whether the rail can't be used at all, while the welcome tour shows. */
  inert?: boolean
  /** The games shown on the globe, which the Games popover lists. */
  games: readonly Game[]
  /** Whether the games are in yet, so the Games button can be used (not under the loading screen). */
  gamesReady: boolean
  /** Opens a game picked from the Games popover. */
  onSelectGame: (gameId: string) => void
}

/**
 * The rail: a column of icon buttons at the top right of the globe, in three groups: zoom in, zoom
 * out and Home, which move the camera; Leagues, Display Settings and Map Type; and Games (with its
 * count of games on it). Each of the last four opens a popover to the left of the rail: one at a time, closed by
 * its button, Escape or a click away from it, but not by moving or zooming the globe; on a phone, the
 * Games popover closes on picking a game too. The arrow keys
 * move through an open popover's controls, coming in from its button (see moveByArrows).
 */
export function Rail({ leagues, settings, onChange, accent, camera, zoomSettings, onZoomIn, onZoomOut, onHome, inert = false, games, gamesReady, onSelectGame }: RailProps) {
  const zoom = camera ? canZoom(camera, zoomSettings) : { in: false, out: false }
  const [open, setOpen] = useState<RailPopover | null>(null)
  const popover = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  // Map Type's popover sits level with its button, its two choices beside it, rather than with the rail's top.
  const [mapTypeTop, setMapTypeTop] = useState(0)
  useLayoutEffect(() => {
    const button = rail.current?.querySelector('[data-popover-button="mapType"]')
    if (open !== 'mapType' || !button || !rail.current) return
    setMapTypeTop(button.getBoundingClientRect().top - rail.current.getBoundingClientRect().top)
  }, [open])
  const popoverEvent = (event: PopoverEvent) => setOpen((current) => nextPopover(current, event))

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen((current) => nextPopover(current, 'escape'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  // A popover's button isn't away from it: its own press opens or closes it.
  useClickAway(
    open !== null,
    (target) => !!popover.current?.contains(target) || !!target.closest('[data-popover-button]'),
    () => setOpen((current) => nextPopover(current, 'outside')),
  )

  return (
    <div
      ref={rail}
      className="rail"
      inert={inert}
      onKeyDown={(event) => {
        const key = event.key
        const onItsButton = open && (event.target as Element).closest(`[data-popover-button="${open}"]`)
        if (onItsButton && popover.current && (key === 'ArrowDown' || key === 'ArrowUp')) moveByArrows(event.nativeEvent, popover.current)
      }}
    >
      {/* Zooming keeps menus open, as zooming the globe itself does (see useClickAway). */}
      <div className="rail__group" data-keeps-popovers>
        <RailButton label="Zoom in" disabled={!zoom.in} onClick={onZoomIn} />
        <RailButton label="Zoom out" disabled={!zoom.out} onClick={onZoomOut} />
        <RailButton label="Home" disabled={!camera} onClick={onHome} />
      </div>
      <div className="rail__group">
        <RailButton label="Leagues" popover="leagues" open={open} onClick={() => popoverEvent({ press: 'leagues' })} />
        <RailButton label="Display Settings" popover="display" open={open} onClick={() => popoverEvent({ press: 'display' })} />
        <RailButton label="Map Type" popover="mapType" open={open} onClick={() => popoverEvent({ press: 'mapType' })} />
      </div>
      <div className="rail__group">
        <RailButton
          label="Games"
          popover="games"
          open={open}
          disabled={!gamesReady}
          badge={gamesReady ? games.length : undefined}
          onClick={() => popoverEvent({ press: 'games' })}
        />
      </div>
      {open && (
        <div
          ref={popover}
          id="rail-popover"
          className={open === 'games' || open === 'mapType' ? `rail__popover rail__popover--${open === 'games' ? 'games' : 'map-type'}` : 'rail__popover'}
          style={open === 'mapType' ? { top: mapTypeTop } : undefined}
          role="dialog"
          aria-label={popoverNames[open]}
          onKeyDown={(event) => moveByArrows(event.nativeEvent, event.currentTarget)}
        >
          {open === 'leagues' && <Leagues leagues={leagues} settings={settings} onChange={onChange} />}
          {open === 'mapType' && <MapTypes settings={settings} onChange={onChange} onPicked={() => setOpen(null)} />}
          {open === 'display' && <DisplaySettings leagues={leagues} settings={settings} onChange={onChange} accent={accent} />}
          {open === 'games' && (
            <GameNavigation
              games={games}
              onSelect={(gameId) => {
                onSelectGame(gameId)
                // On a phone the list closes, as it and the game panel would cover the whole globe.
                if (window.matchMedia(phoneScreen).matches) setOpen(null)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** The app's phone layout (as App's phoneLayout and the CSS's max-width: 640px). */
const phoneScreen = '(max-width: 640px)'

const popoverNames: Record<RailPopover, string> = { leagues: 'Leagues', display: 'Display Settings', mapType: 'Map Type', games: 'Games' }

/**
 * One of the rail's icon buttons, its icon found by its name, which is its tooltip too. A popover's
 * button says whether its popover is open. A badge is a count on its
 * corner (the Games button's games), part of its name for a screen reader.
 */
export function RailButton({
  label,
  disabled,
  popover,
  open,
  badge,
  on,
  tooltipSide = 'left',
  onClick,
}: {
  label: RailButtonName
  disabled?: boolean
  popover?: string
  open?: string | null
  badge?: number
  /** Whether a popover's button shows on though its popover is closed (Tuners, with a tuner open). */
  on?: boolean
  /** Where its tooltip shows: on the left on the rail, so it covers none of the others; below on the top rail. */
  tooltipSide?: 'left' | 'below'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="rail__button"
      aria-label={badge === undefined ? label : `${label} (${badge})`}
      data-tooltip={label}
      data-tooltip-side={tooltipSide === 'left' ? 'left' : undefined}
      disabled={disabled}
      aria-haspopup={popover ? 'dialog' : undefined}
      aria-expanded={popover ? (on ?? open === popover) : undefined}
      aria-controls={popover && open === popover ? `${tooltipSide === 'left' ? 'rail' : 'top-rail'}-popover` : undefined}
      data-popover-button={popover}
      // Where keyboard focus goes back to from a game (see focusGameNavigation).
      data-game-navigation={popover === 'games' || undefined}
      onClick={onClick}
    >
      <RailIcon className="rail__icon">{railIcon(label)}</RailIcon>
      {badge !== undefined && <span className="rail__badge" aria-hidden="true">{badge}</span>}
    </button>
  )
}
