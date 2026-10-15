import type { CSSProperties } from 'react'
import {
  hasColours,
  leaguesBySport,
  withLeagueColour,
  withSportColour,
  withoutColours,
  type League,
  type ViewerSettings,
} from '../settings/viewerSettings'

interface ColoursProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  /**
   * The theme's accent (see accentColour), as #rrggbb, which a sport or league with no colour picked
   * shows hollow: its games take the theme's colour for their status.
   */
  accent: string
}

/**
 * The rail's Colours popover: each sport, then its leagues, by name, with a swatch of its games'
 * colour, which opens the browser's colour picker, and a control to clear it; a league with no colour
 * of its own shows its sport's, marked as taken from the sport. "Reset colours" clears every colour.
 */
export function Colours({ leagues, settings, onChange, accent }: ColoursProps) {
  // What a sport or league with no colour picked shows: the accent, hollow, its games in the theme's colours.
  const fromTheme = { colour: accent, takes: "the theme's colours, by status" }
  return (
    <>
      {leaguesBySport(leagues).map((group) => {
        const sportColour = settings.sportColours[group.sport] ?? null
        // What a league with no colour of its own shows in: its sport's, else the theme's.
        const fromSport = sportColour ? { colour: sportColour, takes: `${group.sport}'s colour` } : fromTheme
        return (
          <div key={group.sport} className="rail-sport">
            <div className="colours-row colours-row--sport">
              <span className="colours-row__name">{group.sport}</span>
              <ColourSwatch
                name={group.sport}
                colour={sportColour}
                taken={fromTheme}
                onChange={(colour) => onChange(withSportColour(settings, group.sport, colour))}
              />
            </div>
            {group.leagues.map((league) => (
              <div key={league.name} className="colours-row colours-row--league">
                <span className="colours-row__name">{league.name}</span>
                <ColourSwatch
                  name={league.name}
                  colour={settings.leagueColours[league.name] ?? null}
                  taken={fromSport}
                  onChange={(colour) => onChange(withLeagueColour(settings, league.name, colour))}
                />
              </div>
            ))}
          </div>
        )
      })}
      <button
        type="button"
        className="colours-reset"
        disabled={!hasColours(settings)}
        onClick={() => onChange(withoutColours(settings))}
      >
        Reset colours
      </button>
    </>
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
    <span className="colour">
      <label
        className={colour ? 'colour__swatch colour__swatch--picked' : 'colour__swatch'}
        style={{ '--swatch-color': colour ?? taken.colour } as CSSProperties}
        title={
          colour
            ? `${name}'s colour: click to change`
            : `${name} takes ${taken.takes}: click to pick its own`
        }
      >
        <input
          type="color"
          className="colour__input"
          aria-label={`${name} colour`}
          value={colour ?? taken.colour}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {colour && (
        <button
          type="button"
          className="colour__clear"
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
