import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  hasColours,
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withAllLeagues,
  withLeague,
  withSport,
  withLeagueColour,
  withSportColour,
  withoutColours,
  type League,
  type ViewerSettings,
} from './viewerSettings'

interface SettingsMenuProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  /**
   * The theme's accent (see accentColour), as #rrggbb, which a sport or league with no colour picked
   * shows hollow: its games take the theme's colour for their status.
   */
  accent: string
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
 * to switch on or off. Beside each sport's name and each league's chip is a swatch of its games' colour,
 * which opens the browser's colour picker, and a control to clear it; a league with no colour of its own
 * shows its sport's, marked as taken from the sport. "Reset colours" clears every colour. Display:
 * "Live only" and "Show Disrupted games" as chips.
 */
export function SettingsMenu({ leagues, settings, onChange, accent }: SettingsMenuProps) {
  const [tab, setTab] = useState<Tab>('leagues')
  const leaguesOn = leagues.filter((league) => isLeagueOn(settings, league.name)).length
  const allState = leaguesOn === leagues.length ? 'on' : leaguesOn === 0 ? 'off' : 'mixed'
  // What a sport or league with no colour picked shows: the accent, hollow, its games in the theme's colours.
  const fromTheme = { colour: accent, takes: "the theme's colours, by status" }
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
                const sportColour = settings.sportColours[group.sport] ?? null
                // What a league with no colour of its own shows in: its sport's, else the theme's.
                const fromSport = sportColour ? { colour: sportColour, takes: `${group.sport}'s colour` } : fromTheme
                return (
                  <div key={group.sport} className="settings-sport">
                    <div className="settings-sport__head">
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
                      <ColourSwatch
                        name={group.sport}
                        colour={sportColour}
                        taken={fromTheme}
                        onChange={(colour) => onChange(withSportColour(settings, group.sport, colour))}
                      />
                    </div>
                    <div className="settings-chips">
                      {group.leagues.map((league) => (
                        <span key={league.name} className="settings-league">
                          <Chip
                            on={isLeagueOn(settings, league.name)}
                            onClick={() =>
                              onChange(withLeague(settings, league.name, !isLeagueOn(settings, league.name)))
                            }
                          >
                            {league.name}
                          </Chip>
                          <ColourSwatch
                            name={league.name}
                            colour={settings.leagueColours[league.name] ?? null}
                            taken={fromSport}
                            onChange={(colour) => onChange(withLeagueColour(settings, league.name, colour))}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
              <button
                type="button"
                className="settings-reset"
                disabled={!hasColours(settings)}
                onClick={() => onChange(withoutColours(settings))}
              >
                Reset colours
              </button>
            </>
          ) : (
            <div className="settings-chips">
              {displaySwitches.map(({ key, name }) => (
                <Chip key={key} on={settings[key]} onClick={() => onChange({ ...settings, [key]: !settings[key] })}>
                  {name}
                </Chip>
              ))}
            </div>
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

/**
 * A sport's or league's colour as a swatch, which opens the browser's colour picker: its games show in
 * the colour picked at once, as it's picked. With none picked, it shows hollow in the colour its games
 * take instead (a league's sport's, or the theme's accent, its games then taking the theme's colour for
 * their status), and says what they take; with one, a control beside it clears it.
 */
function ColourSwatch({
  name,
  colour,
  taken,
  onChange,
}: {
  name: string
  colour: string | null
  /**
   * The colour it shows hollow with none picked, and what its games take then ("Football's colour",
   * "the theme's colours, by status").
   */
  taken: { colour: string; takes: string }
  onChange: (colour: string | null) => void
}) {
  return (
    <span className="settings-colour">
      <label
        className={colour ? 'settings-colour__swatch settings-colour__swatch--picked' : 'settings-colour__swatch'}
        style={{ '--swatch-color': colour ?? taken.colour } as CSSProperties}
        title={
          colour
            ? `${name}'s colour: click to change`
            : `${name} takes ${taken.takes}: click to pick its own`
        }
      >
        <input
          type="color"
          className="settings-colour__input"
          aria-label={`${name} colour`}
          value={colour ?? taken.colour}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {colour && (
        <button
          type="button"
          className="settings-colour__clear"
          aria-label={`Clear ${name} colour`}
          title={`Clear ${name}'s colour`}
          onClick={() => onChange(null)}
        >
          ×
        </button>
      )}
    </span>
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
