import { Fragment, useState } from 'react'
import {
  chosenConferences,
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withAllConferences,
  withAllLeagues,
  withConference,
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

/**
 * The rail's Leagues popover: a "Top Events | My leagues" switch, as on ESPN's front page, then, for
 * My leagues, an "All leagues" chip to switch every league at once, then leagues
 * grouped under their sport, each a chip to switch on or off, and each sport's name switching all of
 * its leagues. A league with conferences (college leagues) has a toggle after its chip that opens its
 * conferences under its sport, to narrow its games to some of them. On Top Events the leagues stay in
 * view, grayed out, as they'll be when switched back.
 */
export function Leagues({ leagues, settings, onChange }: LeaguesProps) {
  // The league whose conferences are open, one at a time; none when the popover opens.
  const [openConferences, setOpenConferences] = useState<string | null>(null)
  const leaguesOn = leagues.filter((league) => isLeagueOn(settings, league.name)).length
  const allState = leaguesOn === leagues.length ? 'on' : leaguesOn === 0 ? 'off' : 'mixed'
  const top = settings.topEventsOnly
  return (
    <>
      <div className="leagues-scope" role="radiogroup" aria-label="Show">
        <button
          type="button"
          role="radio"
          aria-checked={top}
          className="leagues-scope__option"
          onClick={() => onChange({ ...settings, topEventsOnly: true })}
        >
          <svg className="leagues-scope__star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Top Events
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!top}
          className="leagues-scope__option"
          onClick={() => onChange({ ...settings, topEventsOnly: false })}
        >
          My leagues
        </button>
      </div>
      {top && <p className="leagues-scope__note">The games ESPN picks as the most important right now, in every sport.</p>}
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
                    <Fragment key={league.name}>
                      <button
                        type="button"
                        aria-pressed={leagueOn}
                        className="rail-chip"
                        onClick={() => onChange(withLeague(settings, league.name, !leagueOn))}
                      >
                        {league.name}
                      </button>
                      {league.conferences.length > 0 && (
                        <ConferencesToggle
                          league={league.name}
                          chosen={chosenConferences(settings, league.name)}
                          open={openConferences === league.name}
                          onClick={() => setOpenConferences(openConferences === league.name ? null : league.name)}
                        />
                      )}
                    </Fragment>
                  )
                })}
              </div>
              {group.leagues
                .filter((league) => league.name === openConferences && league.conferences.length > 0)
                .map((league) => (
                  <Conferences key={league.name} league={league} settings={settings} onChange={onChange} />
                ))}
            </div>
          )
        })}
      </div>
    </>
  )
}

interface ConferencesToggleProps {
  league: string
  chosen: readonly string[]
  open: boolean
  onClick: () => void
}

/** Opens or closes a league's conferences, naming those chosen ("SEC", "SEC +1"), or "Conferences" when it shows all. */
function ConferencesToggle({ league, chosen, open, onClick }: ConferencesToggleProps) {
  const label = chosen.length === 0 ? 'Conferences' : chosen.length === 1 ? chosen[0] : `${chosen[0]} +${chosen.length - 1}`
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${league} conferences: ${chosen.length === 0 ? 'all' : chosen.join(', ')}`}
      className={chosen.length === 0 ? 'leagues-conferences__toggle' : 'leagues-conferences__toggle leagues-conferences__toggle--chosen'}
      onClick={onClick}
    >
      {label}
      <span aria-hidden="true">{open ? ' ▾' : ' ▸'}</span>
    </button>
  )
}

interface ConferencesProps {
  league: League
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
}

/**
 * A league's conferences, each a chip to choose: its games then show only with a team in one chosen. "All
 * conferences" first, lit while none is chosen, goes back to all of them.
 */
function Conferences({ league, settings, onChange }: ConferencesProps) {
  const chosen = chosenConferences(settings, league.name)
  return (
    <div className="leagues-conferences" role="group" aria-label={`${league.name} conferences`}>
      <button
        type="button"
        aria-pressed={chosen.length === 0}
        className="rail-chip"
        onClick={() => onChange(withAllConferences(settings, league.name))}
      >
        All conferences
      </button>
      {league.conferences.map((conference) => {
        const isChosen = chosen.includes(conference)
        return (
          <button
            key={conference}
            type="button"
            aria-pressed={isChosen}
            className="rail-chip"
            onClick={() => onChange(withConference(settings, league.name, conference, !isChosen))}
          >
            {conference}
          </button>
        )
      })}
    </div>
  )
}
