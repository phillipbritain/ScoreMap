import { useState, type CSSProperties } from 'react'
import { pickableColours } from '../settings/gameColour'
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
 * colour, which opens a grid of the colours there are to pick (see pickableColours) under its row, and
 * a control to clear it; a league with no colour of its own shows its sport's, marked as taken from
 * the sport. One grid is open at a time. "Reset colours" clears every colour.
 */
export function Colours({ leagues, settings, onChange, accent }: ColoursProps) {
  // Whose grid is open: a sport's or league's, as "sport:Football" or "league:NFL".
  const [picking, setPicking] = useState<string | null>(null)
  // What a sport or league with no colour picked shows: the accent, hollow, its games in the theme's colours.
  const fromTheme = { colour: accent, takes: "the theme's colours, by status" }
  // A sport's or league's row, and its grid under it while open.
  const row = (
    kind: 'sport' | 'league',
    name: string,
    colour: string | null,
    taken: Taken,
    set: (colour: string | null) => ViewerSettings,
  ) => {
    const id = `${kind}:${name}`
    const change = (next: string | null) => {
      onChange(set(next))
      setPicking(null)
    }
    return (
      <div key={id}>
        <div className={`colours-row colours-row--${kind}`}>
          <span className="colours-row__name">{name}</span>
          <ColourSwatch
            name={name}
            colour={colour}
            taken={taken}
            picking={picking === id}
            onPicking={(on) => setPicking(on ? id : null)}
            onClear={() => change(null)}
          />
        </div>
        {picking === id && <ColourGrid name={name} colour={colour} onPick={change} />}
      </div>
    )
  }
  return (
    <>
      {leaguesBySport(leagues).map((group) => {
        const sportColour = settings.sportColours[group.sport] ?? null
        // What a league with no colour of its own shows in: its sport's, else the theme's.
        const fromSport = sportColour ? { colour: sportColour, takes: `${group.sport}'s colour` } : fromTheme
        return (
          <div key={group.sport} className="rail-sport">
            {row('sport', group.sport, sportColour, fromTheme, (colour) => withSportColour(settings, group.sport, colour))}
            {group.leagues.map((league) =>
              row('league', league.name, settings.leagueColours[league.name] ?? null, fromSport, (colour) =>
                withLeagueColour(settings, league.name, colour),
              ),
            )}
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
 * The colour a swatch shows hollow with none picked, and what its games take then ("Football's
 * colour", "the theme's colours, by status").
 */
interface Taken {
  colour: string
  takes: string
}

/**
 * A sport's or league's colour as a swatch, which opens or closes its grid of colours to pick from.
 * With none picked, it shows hollow in the colour its games take instead (a league's sport's, or the
 * theme's accent, its games then taking the theme's colour for their status), and says what they
 * take; with one, a control beside it clears it.
 */
function ColourSwatch({
  name,
  colour,
  taken,
  picking,
  onPicking,
  onClear,
}: {
  name: string
  colour: string | null
  taken: Taken
  picking: boolean
  onPicking: (picking: boolean) => void
  onClear: () => void
}) {
  return (
    <span className="colour">
      <button
        type="button"
        className={colour ? 'colour__swatch colour__swatch--picked' : 'colour__swatch'}
        style={{ '--swatch-color': colour ?? taken.colour } as CSSProperties}
        aria-label={`${name} colour`}
        aria-expanded={picking}
        data-tooltip={
          colour
            ? `${name}'s colour: click to change`
            : `${name} takes ${taken.takes}: click to pick its own`
        }
        onClick={() => onPicking(!picking)}
      />
      {colour && (
        <button
          type="button"
          className="colour__clear"
          aria-label={`Clear ${name} colour`}
          data-tooltip={`Clear ${name}'s colour`}
          onClick={onClear}
        >
          ×
        </button>
      )}
    </span>
  )
}

/** The colours there are to pick for a sport or league, the one picked marked. */
function ColourGrid({ name, colour, onPick }: { name: string; colour: string | null; onPick: (colour: string) => void }) {
  return (
    <div className="colour-grid" role="group" aria-label={`Colours for ${name}`}>
      {pickableColours.map((option) => (
        <button
          key={option}
          type="button"
          className="colour-grid__option"
          style={{ '--swatch-color': option } as CSSProperties}
          aria-label={option}
          aria-pressed={option === colour}
          onClick={() => onPick(option)}
        />
      ))}
    </div>
  )
}
