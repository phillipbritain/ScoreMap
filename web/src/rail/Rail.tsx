import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Feedback } from '../feedback/Feedback'
import type { FeedbackContext } from '../feedback/feedbackForm'
import type { Game } from '../games/game'
import { GameNavigation } from '../games/GameNavigation'
import type { Camera } from '../globe/camera'
import type { ZoomSettings } from '../globe/zoomLevels'
import { moveByArrows } from '../menus/arrowKeys'
import { useClickAway } from '../menus/clickAway'
import { useLeaving } from '../motion/useLeaving'
import { leaguesFilterGames, type League, type ViewerSettings } from '../settings/viewerSettings'
import { DisplaySettings } from './DisplaySettings'
import { Leagues } from './Leagues'
import { More } from './More'
import { railIcon, type RailButtonName } from './railButtons'
import { RailIcon } from './railIcons'
import { touchPointer } from '../welcomeTour/welcomeTour'
import { canZoom, morePress, nextPopover, popoverLeaveDuration, type PopoverEvent, type RailPopover } from './railControls'

interface RailProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  /**
   * The theme's accent (see accentColor), as #rrggbb, which a sport or league with no color picked
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
  /**
   * Whether the welcome tour shows: only More, its popover and the Feedback panel can be used then, lifted
   * above the tour (see .rail--touring); the rest of the rail can't.
   */
  touring?: boolean
  /** The games shown on the globe, which the Events popover lists. */
  games: readonly Game[]
  /** Whether the games are in yet, so the Events button can be used (not under the loading screen). */
  gamesReady: boolean
  /** Opens a game picked from the Events popover. */
  onSelectGame: (gameId: string) => void
  /** What the viewer is looking at, sent with their feedback (see Feedback). */
  feedbackContext: () => FeedbackContext
  /** Starts the welcome tour afresh, from More. */
  onTourAgain: () => void
  /** Installs ScoreMap as an app by the browser's own dialog, from More, or nothing where the browser hasn't offered (see offersInstall). */
  onInstall?: () => void
}

/**
 * The rail: a column of icon buttons at the top right of the globe, in four groups: zoom in, zoom
 * out and Home, which move the camera, left out on a touchscreen (see shownRailButtons); Leagues and Events
 * (with its count of games on it); Display Settings (the map type among them); and More (installing the app, sending feedback, the welcome tour again), whose Send feedback opens
 * the Feedback panel in its place. Each of the last four opens a popover to the left of the rail: one at a time, closed by
 * its button, Escape or a click away from it, but not by moving or zooming the globe; on a phone, the
 * Events popover closes on picking a game too. The arrow keys
 * move through an open popover's controls, coming in from its button (see moveByArrows).
 */
export function Rail({
  leagues,
  settings,
  onChange,
  accent,
  camera,
  zoomSettings,
  onZoomIn,
  onZoomOut,
  onHome,
  touring = false,
  games,
  gamesReady,
  onSelectGame,
  feedbackContext,
  onTourAgain,
  onInstall,
}: RailProps) {
  // A touchscreen pinches to zoom and drags the globe, so it has no camera buttons (see shownRailButtons).
  const [touch] = useState(() => window.matchMedia(touchPointer).matches)
  const zoom = camera ? canZoom(camera, zoomSettings) : { in: false, out: false }
  const [open, setOpen] = useState<RailPopover | null>(null)
  // The Feedback panel's note, kept while it's closed, so Cancel or a click away keeps it for next time.
  const [feedbackDraft, setFeedbackDraft] = useState('')
  // A popover closed stays a moment as it goes (see .rail__popover--leaving), out of reach.
  const { shown, leaving, key: popoverKey } = useLeaving(open, popoverLeaveDuration)
  const popover = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  // More's popover sits level with its button, its few choices beside it, rather than with the rail's
  // top. On a screen too short for that, such as a phone on its side, they rise
  // until their foot is as far above the screen's as the rail's top is below its top.
  const beside = shown === 'more'
  const [besideTop, setBesideTop] = useState(0)
  useLayoutEffect(() => {
    const button = rail.current?.querySelector(`[data-popover-button="${shown}"]`)
    const area = rail.current?.parentElement
    if (!beside || !button || !rail.current || !area || !popover.current) return
    const railTop = rail.current.getBoundingClientRect().top
    const areaBox = area.getBoundingClientRect()
    const lowest = areaBox.bottom - (railTop - areaBox.top) - popover.current.offsetHeight - railTop
    setBesideTop(Math.max(0, Math.min(button.getBoundingClientRect().top - railTop, lowest)))
  }, [shown, beside])
  const popoverEvent = (event: PopoverEvent) => setOpen((current) => nextPopover(current, event))

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Taken, so the welcome tour, which Escape otherwise closes, leaves it to the popover.
      event.preventDefault()
      setOpen((current) => nextPopover(current, 'escape'))
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
      className={touring ? 'rail rail--touring' : 'rail'}
      onKeyDown={(event) => {
        const key = event.key
        const onItsButton = open && (event.target as Element).closest(`[data-popover-button="${open}"]`)
        if (onItsButton && popover.current && (key === 'ArrowDown' || key === 'ArrowUp')) moveByArrows(event.nativeEvent, popover.current)
      }}
    >
      <div className="rail__buttons">
        {/* Scrolls on a screen too short for the buttons (see .rail__buttons-inner). */}
        <div className="rail__buttons-inner">
          {/* Zooming keeps menus open, as zooming the globe itself does (see useClickAway). */}
          {!touch && (
            <div className="rail__group" data-keeps-popovers inert={touring}>
              <RailButton label="Zoom in" disabled={!zoom.in} onClick={onZoomIn} />
              <RailButton label="Zoom out" disabled={!zoom.out} onClick={onZoomOut} />
              <RailButton label="Home" disabled={!camera} onClick={onHome} />
            </div>
          )}
          <div className="rail__group" inert={touring}>
            <RailButton
              label="Leagues"
              popover="leagues"
              open={open}
              note={leaguesFilterGames(settings, leagues) ? 'games filtered' : undefined}
              onClick={() => popoverEvent({ press: 'leagues' })}
            />
            <RailButton
              label="Events"
              popover="games"
              open={open}
              disabled={!gamesReady}
              badge={gamesReady ? games.length : undefined}
              onClick={() => popoverEvent({ press: 'games' })}
            />
          </div>
          <div className="rail__group" inert={touring}>
            <RailButton label="Display Settings" popover="display" open={open} onClick={() => popoverEvent({ press: 'display' })} />
          </div>
          <div className="rail__group rail__group--more">
            <RailButton
              label="More"
              popover="more"
              // Lit while the Feedback panel it opened shows, as that's its own.
              open={open === 'feedback' ? 'more' : open}
              onClick={() => popoverEvent(morePress(open))}
            />
          </div>
        </div>
      </div>
      {shown && (
        <div
          key={popoverKey}
          ref={leaving ? undefined : popover}
          id={leaving ? undefined : 'rail-popover'}
          className={popoverClassName(shown, leaving)}
          style={beside ? { top: besideTop } : undefined}
          role="dialog"
          aria-label={popoverNames[shown]}
          aria-hidden={leaving || undefined}
          inert={leaving}
          onKeyDown={(event) => moveByArrows(event.nativeEvent, event.currentTarget)}
        >
          {closable.includes(shown) && (
            <div className="rail__popover-header">
              <h2 className="rail__popover-title">{popoverNames[shown]}</h2>
              <button
                type="button"
                className="rail__popover-close"
                aria-label={`Close ${popoverNames[shown]}`}
                onClick={(event) => {
                  const button = rail.current?.querySelector<HTMLElement>(`[data-popover-button="${shown}"]`)
                  setOpen(null)
                  // Pressed from the keyboard (a click with no pointer), keyboard focus goes back to its button.
                  if (event.detail === 0) button?.focus()
                }}
              >
                ×
              </button>
            </div>
          )}
          {shown === 'leagues' && <Leagues leagues={leagues} settings={settings} onChange={onChange} />}
          {shown === 'more' && (
            <More
              onInstall={
                onInstall &&
                (() => {
                  setOpen(null)
                  onInstall()
                })
              }
              onFeedback={() => popoverEvent({ press: 'feedback' })}
              onTourAgain={() => {
                setOpen(null)
                onTourAgain()
              }}
            />
          )}
          {shown === 'feedback' && (
            <Feedback context={feedbackContext} draft={feedbackDraft} onDraftChange={setFeedbackDraft} onClose={() => setOpen(null)} />
          )}
          {shown === 'display' && <DisplaySettings leagues={leagues} settings={settings} onChange={onChange} accent={accent} />}
          {shown === 'games' && (
            <GameNavigation
              games={games}
              onSelect={(gameId) => {
                onSelectGame(gameId)
                // On a phone the list closes, as it and the event panel would cover the whole globe.
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

/** A popover's classes: its own look's, if it has one, and while it's going, its way out's. */
function popoverClassName(popover: RailPopover, leaving: boolean): string {
  const own = popover in popoverClasses ? ` rail__popover--${popoverClasses[popover]}` : ''
  return `rail__popover${own}${leaving ? ' rail__popover--leaving' : ''}`
}

/** The popovers with a look of their own, by their class's modifier. */
const popoverClasses: Partial<Record<RailPopover, string>> = { games: 'games', more: 'more' }

/**
 * The popovers that are panels, with a header of their name and a close button, as the event panel and
 * the welcome tour have: More is a menu beside its button, closed by a pick or a click away, and Feedback has its own Cancel.
 */
const closable: readonly RailPopover[] = ['leagues', 'display', 'games']

const popoverNames: Record<RailPopover, string> = {
  leagues: 'Leagues',
  display: 'Display Settings',
  games: 'Events',
  more: 'More',
  feedback: 'Feedback',
}

/**
 * One of the rail's icon buttons, its icon found by its name, which is its tooltip too. A popover's
 * button says whether its popover is open. A badge is a count on its
 * corner (the Events button's games), part of its name for a screen reader. A note is a dot on its corner
 * instead (the Leagues button's, while the viewer's leagues keep games off the globe), the note itself
 * part of its name and tooltip.
 */
export function RailButton({
  label,
  disabled,
  popover,
  open,
  badge,
  note,
  tooltipSide = 'left',
  onClick,
}: {
  label: RailButtonName
  disabled?: boolean
  popover?: string
  open?: string | null
  badge?: number
  /** Why its corner shows a dot, as words for its name and tooltip; no dot without one. */
  note?: string
  /** Where its tooltip shows: on the left on the rail, so it covers none of the others; below on the top rail. */
  tooltipSide?: 'left' | 'below'
  onClick: () => void
}) {
  const name = note ? `${label} (${note})` : label
  return (
    <button
      type="button"
      className="rail__button"
      aria-label={badge === undefined ? name : `${name} (${badge})`}
      data-tooltip={name}
      data-tooltip-side={tooltipSide === 'left' ? 'left' : undefined}
      disabled={disabled}
      aria-haspopup={popover ? 'dialog' : undefined}
      aria-expanded={popover ? open === popover : undefined}
      aria-controls={popover && open === popover ? `${tooltipSide === 'left' ? 'rail' : 'top-rail'}-popover` : undefined}
      data-popover-button={popover}
      // Where keyboard focus goes back to from a game (see focusGameNavigation).
      data-game-navigation={popover === 'games' || undefined}
      onClick={onClick}
    >
      <RailIcon className="rail__icon">{railIcon(label)}</RailIcon>
      {badge !== undefined && <span className="rail__badge" aria-hidden="true">{badge}</span>}
      {note && <span className="rail__dot" aria-hidden="true" />}
    </button>
  )
}
