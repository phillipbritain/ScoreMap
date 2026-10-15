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

/**
 * The rail's Leagues popover: a "Top Events | My leagues" switch, as on ESPN's front page, then, for
 * My leagues, an "All leagues" chip to switch every league at once, then leagues
 * grouped under their sport, each a chip to switch on or off, and each sport's name switching all of
 * its leagues. On Top Events the leagues stay in view, greyed out, as they'll be when switched back.
 */
export function Leagues({ leagues, settings, onChange }: LeaguesProps) {
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
            <span className="leagues-master__mark" aria-hidden="true">
              {allState === 'on' ? '✓' : allState === 'mixed' ? '–' : ''}
            </span>
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
                className="rail-sport__name"
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
    </>
  )
}
