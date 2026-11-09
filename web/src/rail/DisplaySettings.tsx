import { useState, type CSSProperties } from 'react'
import { pickableColors } from '../settings/gameColor'
import {
  hasColors,
  leaguesBySport,
  withLeagueColor,
  withSportColor,
  withoutColors,
  type League,
  type ViewerSettings,
} from '../settings/viewerSettings'

interface DisplaySettingsProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  /**
   * The theme's accent (see accentColor), as #rrggbb, which a sport or league with no color picked
   * shows hollow: its games take the theme's color for their status.
   */
  accent: string
}

/**
 * The rail's Display Settings popover: each sport, then its leagues, by name, with a swatch of its games'
 * color, which opens a grid of the colors there are to pick (see pickableColors) under its row, and
 * a control to clear it; a league with no color of its own shows its sport's, marked as taken from
 * the sport. One grid is open at a time. "Reset colors" clears every color.
 */
export function DisplaySettings({ leagues, settings, onChange, accent }: DisplaySettingsProps) {
  // Whose grid is open: a sport's or league's, as "sport:Football" or "league:NFL".
  const [picking, setPicking] = useState<string | null>(null)
  // What a sport or league with no color picked shows: the accent, hollow, its games in the theme's colors.
  const fromTheme = { color: accent, takes: "the theme's colors, by status" }
  // A sport's or league's row, and its grid under it while open.
  const row = (
    kind: 'sport' | 'league',
    name: string,
    color: string | null,
    taken: Taken,
    set: (color: string | null) => ViewerSettings,
  ) => {
    const id = `${kind}:${name}`
    const change = (next: string | null) => {
      onChange(set(next))
      setPicking(null)
    }
    return (
      <div key={id}>
        <div className={`colors-row colors-row--${kind}`}>
          <span className="colors-row__name">{name}</span>
          <ColorSwatch
            name={name}
            color={color}
            taken={taken}
            picking={picking === id}
            onPicking={(on) => setPicking(on ? id : null)}
            onClear={() => change(null)}
          />
        </div>
        {picking === id && <ColorGrid name={name} color={color} onPick={change} />}
      </div>
    )
  }
  return (
    <>
      {leaguesBySport(leagues).map((group) => {
        const sportColor = settings.sportColors[group.sport] ?? null
        // What a league with no color of its own shows in: its sport's, else the theme's.
        const fromSport = sportColor ? { color: sportColor, takes: `${group.sport}'s color` } : fromTheme
        return (
          <div key={group.sport} className="rail-sport">
            {row('sport', group.sport, sportColor, fromTheme, (color) => withSportColor(settings, group.sport, color))}
            {group.leagues.map((league) =>
              row('league', league.name, settings.leagueColors[league.name] ?? null, fromSport, (color) =>
                withLeagueColor(settings, league.name, color),
              ),
            )}
          </div>
        )
      })}
      <button
        type="button"
        className="colors-reset"
        disabled={!hasColors(settings)}
        onClick={() => onChange(withoutColors(settings))}
      >
        Reset colors
      </button>
    </>
  )
}

/**
 * The color a swatch shows hollow with none picked, and what its games take then ("Football's
 * color", "the theme's colors, by status").
 */
interface Taken {
  color: string
  takes: string
}

/**
 * A sport's or league's color as a swatch, which opens or closes its grid of colors to pick from.
 * With none picked, it shows hollow in the color its games take instead (a league's sport's, or the
 * theme's accent, its games then taking the theme's color for their status), and says what they
 * take; with one, a control beside it clears it.
 */
function ColorSwatch({
  name,
  color,
  taken,
  picking,
  onPicking,
  onClear,
}: {
  name: string
  color: string | null
  taken: Taken
  picking: boolean
  onPicking: (picking: boolean) => void
  onClear: () => void
}) {
  return (
    <span className="color">
      <button
        type="button"
        className={color ? 'color__swatch color__swatch--picked' : 'color__swatch'}
        style={{ '--swatch-color': color ?? taken.color } as CSSProperties}
        aria-label={`${name} color`}
        aria-expanded={picking}
        data-tooltip={
          color
            ? `${name}'s color: click to change`
            : `${name} takes ${taken.takes}: click to pick its own`
        }
        onClick={() => onPicking(!picking)}
      />
      {color && (
        <button
          type="button"
          className="color__clear"
          aria-label={`Clear ${name} color`}
          data-tooltip={`Clear ${name}'s color`}
          onClick={onClear}
        >
          ×
        </button>
      )}
    </span>
  )
}

/** The colors there are to pick for a sport or league, the one picked marked. */
function ColorGrid({ name, color, onPick }: { name: string; color: string | null; onPick: (color: string) => void }) {
  return (
    <div className="color-grid" role="group" aria-label={`Colors for ${name}`}>
      {pickableColors.map((option) => (
        <button
          key={option}
          type="button"
          className="color-grid__option"
          style={{ '--swatch-color': option } as CSSProperties}
          aria-label={option}
          aria-pressed={option === color}
          onClick={() => onPick(option)}
        />
      ))}
    </div>
  )
}
