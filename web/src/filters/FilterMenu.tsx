import { useEffect, useRef } from 'react'
import {
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withLeague,
  withSport,
  type League,
  type ViewerSettings,
} from './viewerSettings'

interface FilterMenuProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
}

/**
 * The filter menu: "Live only", "Show Disrupted games" and "Slow spin", then leagues grouped under
 * their sport with a whole-sport switch.
 */
export function FilterMenu({ leagues, settings, onChange }: FilterMenuProps) {
  return (
    <details className="filter-menu">
      <summary>Filters</summary>
      <label className="filter-switch">
        <input
          type="checkbox"
          checked={settings.liveOnly}
          onChange={(event) => onChange({ ...settings, liveOnly: event.target.checked })}
        />
        Live only
      </label>
      <label className="filter-switch">
        <input
          type="checkbox"
          checked={settings.showDisrupted}
          onChange={(event) => onChange({ ...settings, showDisrupted: event.target.checked })}
        />
        Show Disrupted games
      </label>
      <label className="filter-switch">
        <input
          type="checkbox"
          checked={settings.slowSpin}
          onChange={(event) => onChange({ ...settings, slowSpin: event.target.checked })}
        />
        Slow spin
      </label>
      {leaguesBySport(leagues).map((group) => (
        <fieldset key={group.sport} className="filter-sport">
          <legend>
            <label className="filter-switch">
              <SportCheckbox
                state={sportSwitch(settings, group)}
                onChange={(on) => onChange(withSport(settings, group, on))}
              />
              {group.sport}
            </label>
          </legend>
          {group.leagues.map((league) => (
            <label key={league.name} className="filter-switch">
              <input
                type="checkbox"
                checked={isLeagueOn(settings, league.name)}
                onChange={(event) => onChange(withLeague(settings, league.name, event.target.checked))}
              />
              {league.name}
            </label>
          ))}
        </fieldset>
      ))}
    </details>
  )
}

/** A checkbox showing a mixed state when only some of the sport's leagues are on. */
function SportCheckbox({ state, onChange }: { state: 'on' | 'off' | 'mixed'; onChange: (on: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (input.current) input.current.indeterminate = state === 'mixed'
  }, [state])
  return (
    <input
      ref={input}
      type="checkbox"
      checked={state === 'on'}
      // Clicking a mixed sport switches all its leagues on.
      onChange={() => onChange(state !== 'on')}
    />
  )
}
