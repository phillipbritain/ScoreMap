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

interface LeaguePickerProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
}

/**
 * The leagues to pick from, in Leagues on the rail and in the welcome tour's My leagues: an "All leagues" chip
 * to switch every league at once, then leagues grouped under their sport, each a chip to switch on or off, and
 * each sport's name switching all of its leagues. A league with conferences (college leagues) has a toggle
 * joined onto its chip that opens its conferences on a row straight after it, to narrow its games to some of
 * them. It only says what's picked: where the picks go (saved at once, or held until "Show these") is its user's.
 */
export function LeaguePicker({ leagues, settings, onChange }: LeaguePickerProps) {
  // The league whose conferences are open, one at a time; none when the picker opens.
  const [openConferences, setOpenConferences] = useState<string | null>(null)
  const leaguesOn = leagues.filter((league) => isLeagueOn(settings, league.name)).length
  const allState = leaguesOn === leagues.length ? 'on' : leaguesOn === 0 ? 'off' : 'mixed'
  return (
    <>
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
                const chip = (
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
                if (league.conferences.length === 0) return chip
                const open = openConferences === league.name
                return (
                  // A college league: its chip and conferences toggle as one split pill, its conferences
                  // opening on a row of their own straight after it, before the sport's next league.
                  <Fragment key={league.name}>
                    <span className="leagues-league">
                      {chip}
                      <ConferencesToggle
                        league={league.name}
                        chosen={chosenConferences(settings, league.name)}
                        open={open}
                        onClick={() => setOpenConferences(open ? null : league.name)}
                      />
                    </span>
                    {open && <Conferences league={league} settings={settings} onChange={onChange} />}
                  </Fragment>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}

interface ConferencesToggleProps {
  league: string
  chosen: readonly string[]
  open: boolean
  onClick: () => void
}

/** Opens or closes a league's conferences, naming those chosen ("SEC", "SEC +1"), or "All" when it shows all of them. */
function ConferencesToggle({ league, chosen, open, onClick }: ConferencesToggleProps) {
  const label = chosen.length === 0 ? 'All' : chosen.length === 1 ? chosen[0] : `${chosen[0]} +${chosen.length - 1}`
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${league} conferences: ${chosen.length === 0 ? 'all' : chosen.join(', ')}`}
      className={
        chosen.length === 0
          ? 'rail-chip leagues-conferences__toggle'
          : 'rail-chip leagues-conferences__toggle leagues-conferences__toggle--chosen'
      }
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
