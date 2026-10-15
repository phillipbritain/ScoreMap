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
 * The rail's Leagues popover: an "All leagues" chip to switch every league at once, then leagues
 * grouped under their sport, each a chip to switch on or off, and each sport's name switching all of
 * its leagues.
 */
export function Leagues({ leagues, settings, onChange }: LeaguesProps) {
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
    </>
  )
}
