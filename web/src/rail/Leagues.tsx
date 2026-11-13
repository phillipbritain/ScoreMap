import { useEffect, useId, useRef, useState } from 'react'
import {
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withAllLeagues,
  withLeague,
  withSport,
  type League,
  type ViewerSettings,
} from '../settings/viewerSettings'

interface LeaguesProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
}

/** How long the note on why the leagues are off stays (its fade is in the CSS, .leagues-off-note). */
const offNoteDuration = 4000

/**
 * The rail's Leagues popover: what to show on the globe, Top Events (as on ESPN's front page) or My
 * leagues, as two radio options each saying what it shows, then, for My leagues, an "All leagues" chip to switch every league at once, then leagues
 * grouped under their sport, each a chip to switch on or off, and each sport's name switching all of
 * its leagues. On Top Events the leagues stay in view, grayed out, as they'll be when switched back;
 * a click on them says why they're off and how to pick them.
 */
export function Leagues({ leagues, settings, onChange }: LeaguesProps) {
  const leaguesOn = leagues.filter((league) => isLeagueOn(settings, league.name)).length
  const allState = leaguesOn === leagues.length ? 'on' : leaguesOn === 0 ? 'off' : 'mixed'
  const top = settings.topEventsOnly
  const scopeLabel = useId()
  // Where the last click on the grayed-out leagues landed, down the list, for the note on why they're off.
  const [offNote, setOffNote] = useState<{ y: number; key: number } | null>(null)
  const listArea = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!offNote) return
    const timer = setTimeout(() => setOffNote(null), offNoteDuration)
    return () => clearTimeout(timer)
  }, [offNote])
  const explainOff = (clientY: number) => {
    const box = listArea.current?.getBoundingClientRect()
    setOffNote({ y: box ? clientY - box.top : 0, key: Date.now() })
  }
  return (
    <>
      <div className="leagues-scope__label" id={scopeLabel}>
        Show on the globe
      </div>
      <div className="leagues-scope" role="radiogroup" aria-labelledby={scopeLabel}>
        <ScopeOption
          checked={top}
          name="Top Events"
          note="ESPN's most important games right now, in every sport"
          star
          onPick={() => onChange({ ...settings, topEventsOnly: true })}
        />
        <ScopeOption
          checked={!top}
          name="My leagues"
          note="Only the leagues you switch on below"
          onPick={() => onChange({ ...settings, topEventsOnly: false })}
        />
      </div>
      {/* While Top Events is on, a click on the grayed-out leagues says why they're off, where it landed. */}
      <div
        ref={listArea}
        className={top ? 'leagues-list-area leagues-list-area--off' : 'leagues-list-area'}
        onClick={top ? (event) => explainOff(event.clientY) : undefined}
      >
        {top && offNote && (
          <p key={offNote.key} className="leagues-off-note" role="status" style={{ top: offNote.y }}>
            Top Events is on, so your leagues are off. Choose "My leagues" above to pick your own.
          </p>
        )}
        <div className={top ? 'leagues-list leagues-list--off' : 'leagues-list'} inert={top}>
          <div className="leagues-master">
            {/* Switches every league on, or off when they're all on already, like a sport's name. */}
            <button
              type="button"
              className={`rail-chip leagues-master__chip leagues-master__chip--${allState}`}
              aria-pressed={allState === 'on'}
              onClick={() => onChange(withAllLeagues(settings, leagues, allState !== 'on'))}
            >
              All leagues
              <span className="leagues-master__count">
                {leaguesOn}/{leagues.length}
              </span>
            </button>
            <span className="leagues-master__hint">
              {allState === 'on' ? 'Click to switch all off' : 'Click to switch all on'}
            </span>
          </div>
          {leaguesBySport(leagues).map((group) => {
            const on = group.leagues.filter((league) => isLeagueOn(settings, league.name)).length
            return (
              <div key={group.sport} className="rail-sport">
                {/* Switches every league in the sport on, or off when they're all on already. */}
                <button
                  type="button"
                  className={on === group.leagues.length ? 'rail-sport__name rail-sport__name--on' : 'rail-sport__name'}
                  onClick={() => onChange(withSport(settings, group, sportSwitch(settings, group) !== 'on'))}
                >
                  {group.sport}{' '}
                  <span className="leagues-sport__count">
                    {on}/{group.leagues.length}
                  </span>
                </button>
                <div className="leagues-chips">
                  {group.leagues.map((league) => {
                    const leagueOn = isLeagueOn(settings, league.name)
                    return (
                      <button
                        key={league.name}
                        type="button"
                        aria-pressed={leagueOn}
                        className="rail-chip"
                        onClick={() => onChange(withLeague(settings, league.name, !leagueOn))}
                      >
                        {league.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

interface ScopeOptionProps {
  checked: boolean
  name: string
  /** What it shows on the globe, under its name. */
  note: string
  star?: boolean
  onPick: () => void
}

/** One of Leagues' two choices: a radio dot, its name and what it shows, the chosen one lit. */
function ScopeOption({ checked, name, note, star, onPick }: ScopeOptionProps) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="leagues-scope__option" onClick={onPick}>
      <span className="leagues-scope__dot" aria-hidden="true" />
      <span className="leagues-scope__text">
        <span className="leagues-scope__name">
          {star && (
            <svg className="leagues-scope__star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          )}
          {name}
        </span>
        <span className="leagues-scope__note">{note}</span>
      </span>
    </button>
  )
}
