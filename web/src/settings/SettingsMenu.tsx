import { useState, type ReactNode } from 'react'
import { cardStyles } from '../globe/cardStyle'
import {
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withAllLeagues,
  withLeague,
  withSport,
  type League,
  type ViewerSettings,
} from './viewerSettings'

interface SettingsMenuProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
}

type Tab = 'leagues' | 'display'

const tabs: readonly { key: Tab; name: string }[] = [
  { key: 'leagues', name: 'Leagues' },
  { key: 'display', name: 'Display' },
]

const displaySwitches = [
  { key: 'liveOnly', name: 'Live only' },
  { key: 'showDisrupted', name: 'Show Disrupted games' },
] as const

/**
 * The settings menu, opened from a gear icon, in two tabs. Leagues, first as the most used: an "All
 * leagues" chip to switch every league at once, then leagues grouped under their sport, each a chip
 * to switch on or off. Display: "Live only" and "Show Disrupted games" as chips, then a chip for each
 * card style.
 */
export function SettingsMenu({ leagues, settings, onChange }: SettingsMenuProps) {
  const [tab, setTab] = useState<Tab>('leagues')
  const leaguesOn = leagues.filter((league) => isLeagueOn(settings, league.name)).length
  const allState = leaguesOn === leagues.length ? 'on' : leaguesOn === 0 ? 'off' : 'mixed'
  return (
    <details className="settings-menu">
      <summary aria-label="Settings" title="Settings">
        <GearIcon />
      </summary>
      <div className="settings-menu__panel">
        <div className="settings-tabs" role="tablist">
          {tabs.map(({ key, name }) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`settings-tab-${key}`}
              aria-selected={tab === key}
              aria-controls="settings-tab-body"
              className="settings-tab"
              onClick={() => setTab(key)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="settings-tab-body" id="settings-tab-body" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
          {tab === 'leagues' ? (
            <>
              <div className="settings-master">
                {/* Switches every league on, or off when they're all on already, like a sport's name. */}
                <button
                  type="button"
                  className={`settings-chip settings-master__chip settings-master__chip--${allState}`}
                  aria-pressed={allState === 'on'}
                  onClick={() => onChange(withAllLeagues(settings, leagues, allState !== 'on'))}
                >
                  <span className="settings-master__mark" aria-hidden="true">
                    {allState === 'on' ? '✓' : allState === 'mixed' ? '–' : ''}
                  </span>
                  All leagues
                  <span className="settings-master__count">
                    {leaguesOn}/{leagues.length}
                  </span>
                </button>
                <span className="settings-master__hint">
                  {allState === 'on' ? 'Click to switch all off' : 'Click to switch all on'}
                </span>
              </div>
              {leaguesBySport(leagues).map((group) => {
                const on = group.leagues.filter((league) => isLeagueOn(settings, league.name)).length
                return (
                  <div key={group.sport} className="settings-sport">
                    {/* Switches every league in the sport on, or off when they're all on already. */}
                    <button
                      type="button"
                      className="settings-sport__name"
                      onClick={() => onChange(withSport(settings, group, sportSwitch(settings, group) !== 'on'))}
                    >
                      {group.sport}{' '}
                      <span className="settings-sport__count">
                        {on}/{group.leagues.length}
                      </span>
                    </button>
                    <div className="settings-chips">
                      {group.leagues.map((league) => (
                        <Chip
                          key={league.name}
                          on={isLeagueOn(settings, league.name)}
                          onClick={() =>
                            onChange(withLeague(settings, league.name, !isLeagueOn(settings, league.name)))
                          }
                        >
                          {league.name}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          ) : (
            <>
              <div className="settings-chips">
                {displaySwitches.map(({ key, name }) => (
                  <Chip key={key} on={settings[key]} onClick={() => onChange({ ...settings, [key]: !settings[key] })}>
                    {name}
                  </Chip>
                ))}
              </div>
              <h3 className="settings-heading">Card style</h3>
              <div className="settings-chips">
                {cardStyles.map((style) => (
                  <Chip
                    key={style.key}
                    on={settings.cardStyle === style.key}
                    onClick={() => onChange({ ...settings, cardStyle: style.key })}
                  >
                    {style.name}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </details>
  )
}

/** A setting or league as a pill, filled in gold while on. */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} className="settings-chip" onClick={onClick}>
      {children}
    </button>
  )
}

/** The gear that opens the settings menu (Feather's "settings" icon). */
function GearIcon() {
  return (
    <svg
      className="settings-menu__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
