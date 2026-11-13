import { useEffect, useRef, useState } from 'react'
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
import { ScopeControl } from './ScopeVariants'
import { offHintText, useScopeVariant } from './scopePrototype'

interface LeaguesProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
}

/**
 * The rail's Leagues popover: a "Top Events | My leagues" switch, as on ESPN's front page, then, for
 * My leagues, an "All leagues" chip to switch every league at once, then leagues
 * grouped under their sport, each a chip to switch on or off, and each sport's name switching all of
 * its leagues. On Top Events the leagues stay in view, grayed out, as they'll be when switched back.
 */
export function Leagues({ leagues, settings, onChange }: LeaguesProps) {
  const leaguesOn = leagues.filter((league) => isLeagueOn(settings, league.name)).length
  const allState = leaguesOn === leagues.length ? 'on' : leaguesOn === 0 ? 'off' : 'mixed'
  const top = settings.topEventsOnly
  const variant = useScopeVariant()
  // Where the last click on the grayed-out leagues landed, down the list, to say there why they're off.
  const [offHint, setOffHint] = useState<{ y: number; key: number } | null>(null)
  const area = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!offHint) return
    const timer = setTimeout(() => setOffHint(null), 4000)
    return () => clearTimeout(timer)
  }, [offHint])
  const explainOff = (clientY: number) => {
    const box = area.current?.getBoundingClientRect()
    setOffHint({ y: box ? clientY - box.top : 0, key: Date.now() })
  }
  return (
    <>
      {/* PROTOTYPE, throwaway: the looks on ?scopeProto= (see scopePrototype). */}
      <ScopeControl top={top} onPick={(topEventsOnly) => onChange({ ...settings, topEventsOnly })} />
      {/* PROTOTYPE: a click on the grayed-out leagues says why they're off, beside where it landed. */}
      <div
        ref={area}
        className={top ? 'leagues-off-area leagues-off-area--off' : 'leagues-off-area'}
        onClick={top ? (event) => explainOff(event.clientY) : undefined}
      >
        {top && offHint && (
          <p key={offHint.key} className="leagues-off-hint" role="status" style={{ top: offHint.y }}>
            {offHintText(variant)}
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
