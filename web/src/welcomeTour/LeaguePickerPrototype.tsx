// PROTOTYPE, throw away: options for the welcome tour's My leagues picker, switched by ?picker=A…F
// with a floating bar (← → keys too). ?leagues=more adds made-up sports and leagues to see how each
// option copes with more of them. Not for main: see the prototype skill.
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Game } from '../games/game'
import {
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withLeague,
  withSport,
  type League,
  type SportGroup,
  type ViewerSettings,
} from '../settings/viewerSettings'
import './LeaguePickerPrototype.css'

const variants = [
  { key: 'A', name: 'Current: sport chips, league chips under' },
  { key: 'B', name: 'A as a checklist: tick boxes, outlined chips' },
  { key: 'C', name: 'A in cards, two columns, with switches' },
  { key: 'D', name: 'A in rows: sport at the left, leagues beside it' },
  { key: 'E', name: 'Accordion: one line per sport, open for leagues' },
  { key: 'F', name: 'Sport icons first, then narrow down by league' },
] as const

type VariantKey = (typeof variants)[number]['key']

const params = () => new URLSearchParams(location.search)

function currentVariant(): VariantKey {
  const key = params().get('picker')?.toUpperCase()
  return variants.find((v) => v.key === key)?.key ?? 'A'
}

const moreLeagues: League[] = [
  { name: 'NCAA Hockey', sport: 'Hockey' },
  { name: 'La Liga', sport: 'Soccer' },
  { name: 'Serie A', sport: 'Soccer' },
  { name: 'Bundesliga', sport: 'Soccer' },
  { name: 'Ligue 1', sport: 'Soccer' },
  { name: 'Liga MX', sport: 'Soccer' },
  { name: 'NWSL', sport: 'Soccer' },
  { name: 'Big Bash', sport: 'Cricket' },
  { name: 'The Hundred', sport: 'Cricket' },
  { name: 'ATP', sport: 'Tennis' },
  { name: 'WTA', sport: 'Tennis' },
  { name: 'PGA Tour', sport: 'Golf' },
  { name: 'LPGA', sport: 'Golf' },
  { name: 'DP World Tour', sport: 'Golf' },
  { name: 'Six Nations', sport: 'Rugby' },
  { name: 'Super Rugby', sport: 'Rugby' },
  { name: 'NRL', sport: 'Rugby' },
  { name: 'Formula 1', sport: 'Motorsport' },
  { name: 'NASCAR', sport: 'Motorsport' },
  { name: 'IndyCar', sport: 'Motorsport' },
  { name: 'UFC', sport: 'MMA' },
]

/** The server's leagues, plus made-up ones with ?leagues=more. */
export function prototypeLeagues(leagues: readonly League[]): League[] {
  if (params().get('leagues') !== 'more' || leagues.length === 0) return [...leagues]
  // Each made-up league after the last of its sport, or at the end for a new sport.
  const all = [...leagues]
  for (const extra of moreLeagues) {
    const last = all.map((l) => l.sport).lastIndexOf(extra.sport)
    all.splice(last === -1 ? all.length : last + 1, 0, extra)
  }
  return all
}

interface PickerProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  games: readonly Game[]
}

/** Live and all games now, by league. */
function useCounts(games: readonly Game[]) {
  return useMemo(() => {
    const live = new Map<string, number>()
    const all = new Map<string, number>()
    for (const game of games) {
      all.set(game.league, (all.get(game.league) ?? 0) + 1)
      if (game.status === 'Live') live.set(game.league, (live.get(game.league) ?? 0) + 1)
    }
    return { live: (l: string) => live.get(l) ?? 0, all: (l: string) => all.get(l) ?? 0 }
  }, [games])
}

const onCount = (settings: ViewerSettings, group: SportGroup) =>
  group.leagues.filter((l) => isLeagueOn(settings, l.name)).length

// The option on show lives in the URL; the switcher tells the picker when it changes.
const variantChanged = 'prototype-picker-variant'
const subscribe = (onChange: () => void) => {
  addEventListener(variantChanged, onChange)
  return () => removeEventListener(variantChanged, onChange)
}
const useVariant = () => useSyncExternalStore(subscribe, currentVariant)

/** The picker option on show. `current` is the picker as it is today. */
export function LeaguePickerPrototype(props: PickerProps & { current: ReactNode }) {
  const variant = useVariant()
  return (
    <>
      {variant === 'A' && props.current}
      {variant === 'B' && <Checklist {...props} />}
      {variant === 'C' && <SportCards {...props} />}
      {variant === 'D' && <SportRows {...props} />}
      {variant === 'E' && <Accordion {...props} />}
      {variant === 'F' && <SportIcons {...props} />}
    </>
  )
}

/** The floating bar that switches the picker option (← → keys too), at the top of the page. */
export function PickerSwitcher({ picking }: { picking: boolean }) {
  const variant = useVariant()
  const step = (by: number) => {
    const i = variants.findIndex((v) => v.key === variant)
    const search = params()
    search.set('picker', variants[(i + by + variants.length) % variants.length].key)
    history.replaceState(null, '', `?${search}`)
    dispatchEvent(new Event(variantChanged))
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  if (!import.meta.env.DEV) return null
  const name = variants.find((v) => v.key === variant)?.name
  return createPortal(
    <div className="proto-switcher">
      <button type="button" onClick={() => step(-1)} aria-label="Previous option">
        ←
      </button>
      <span>
        Picker option {variant}: {name}
        {!picking && <em> (choose My leagues to see it)</em>}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next option">
        →
      </button>
    </div>,
    document.body,
  )
}

/** A league's chip, pressed while it's on. */
function LeagueChip({
  league,
  settings,
  onChange,
  className = 'rail-chip',
  children,
}: { league: League; className?: string; children?: ReactNode } & Omit<PickerProps, 'leagues' | 'games'>) {
  const on = isLeagueOn(settings, league.name)
  return (
    <button type="button" aria-pressed={on} className={className} onClick={() => onChange(withLeague(settings, league.name, !on))}>
      {children}
      {league.name}
    </button>
  )
}

/** A small tri-state box: filled, part-filled or empty. */
function Box({ state }: { state: 'on' | 'off' | 'mixed' }) {
  return <span className={`proto-box proto-box--${state}`}>{state === 'on' ? '✓' : state === 'mixed' ? '–' : ''}</span>
}

/** B: A's layout as a checklist: each sport a tick box with how many are on, its leagues as outlined chips that tick. */
function Checklist({ leagues, settings, onChange }: PickerProps) {
  return (
    <div className="proto-check">
      {leaguesBySport(leagues).map((group) => {
        const state = sportSwitch(settings, group)
        return (
          <div key={group.sport} className="proto-check__sport">
            <button type="button" className="proto-check__head" onClick={() => onChange(withSport(settings, group, state !== 'on'))}>
              <Box state={state} />
              <span className="proto-check__name">{group.sport}</span>
              {group.leagues.length > 1 && (
                <span className="proto-hint">
                  {onCount(settings, group)} of {group.leagues.length}
                </span>
              )}
            </button>
            {group.leagues.length > 1 && (
              <div className="proto-check__leagues">
                {group.leagues.map((league) => (
                  <LeagueChip key={league.name} league={league} settings={settings} onChange={onChange} className="proto-check__chip">
                    <span className="proto-check__tick" aria-hidden="true">
                      ✓
                    </span>
                  </LeagueChip>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** An on/off switch, half-way while mixed. */
function Switch({ state }: { state: 'on' | 'off' | 'mixed' }) {
  return <span className={`proto-switch proto-switch--${state}`} aria-hidden="true" />
}

/** C: A's layout in cards: each sport a card with a switch, its league chips inside, the cards in two columns. */
function SportCards({ leagues, settings, onChange }: PickerProps) {
  return (
    <div className="proto-cards">
      {leaguesBySport(leagues).map((group) => {
        const state = sportSwitch(settings, group)
        return (
          <div key={group.sport} className={`proto-card proto-card--${state}`}>
            <button
              type="button"
              className="proto-card__head"
              aria-pressed={state === 'on'}
              onClick={() => onChange(withSport(settings, group, state !== 'on'))}
            >
              <span className="proto-card__name">{group.sport}</span>
              <Switch state={state} />
            </button>
            {group.leagues.length > 1 && (
              <div className="proto-card__leagues">
                {group.leagues.map((league) => (
                  <LeagueChip key={league.name} league={league} settings={settings} onChange={onChange} className="rail-chip proto-small-chip" />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** D: A's chips in rows: the sport's chip in a column at the left, its leagues flowing beside it, a line between sports. */
function SportRows({ leagues, settings, onChange }: PickerProps) {
  return (
    <div className="proto-rows">
      {leaguesBySport(leagues).map((group) => {
        const state = sportSwitch(settings, group)
        return (
          <div key={group.sport} className="proto-rows__row">
            <button
              type="button"
              aria-pressed={state === 'on'}
              className={`rail-chip proto-rows__sport welcome-tour__sport-chip--${state}`}
              onClick={() => onChange(withSport(settings, group, state !== 'on'))}
            >
              {group.sport}
            </button>
            <div className="proto-rows__leagues">
              {group.leagues.length > 1 ? (
                group.leagues.map((league) => (
                  <LeagueChip key={league.name} league={league} settings={settings} onChange={onChange} className="rail-chip proto-small-chip" />
                ))
              ) : (
                <span className="proto-hint">{group.leagues[0].name}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** E: one line per sport, with what's picked in it and its live games; open a sport for A's league chips. */
function Accordion({ leagues, settings, onChange, games }: PickerProps) {
  const counts = useCounts(games)
  const [open, setOpen] = useState<string[]>([])
  return (
    <div className="proto-accordion">
      {leaguesBySport(leagues).map((group) => {
        const state = sportSwitch(settings, group)
        const picked = group.leagues.filter((l) => isLeagueOn(settings, l.name)).map((l) => l.name)
        const live = group.leagues.reduce((n, l) => n + counts.live(l.name), 0)
        const isOpen = open.includes(group.sport)
        const many = group.leagues.length > 1
        const summary = !many
          ? group.leagues[0].name
          : state === 'on'
            ? 'All leagues'
            : picked.length > 0
              ? picked.join(', ')
              : `${group.leagues.length} leagues`
        return (
          <div key={group.sport} className={`proto-accordion__sport ${isOpen ? 'proto-accordion__sport--open' : ''}`}>
            <div className="proto-accordion__line">
              <button
                type="button"
                className="proto-accordion__check"
                aria-label={`All ${group.sport}`}
                onClick={() => onChange(withSport(settings, group, state !== 'on'))}
              >
                <Box state={state} />
              </button>
              <button
                type="button"
                className="proto-accordion__toggle"
                disabled={!many}
                onClick={() => setOpen(isOpen ? open.filter((s) => s !== group.sport) : [...open, group.sport])}
              >
                <span className="proto-accordion__name">{group.sport}</span>
                <span className="proto-accordion__summary">{summary}</span>
                {live > 0 && <span className="proto-live">● {live}</span>}
                {many && (
                  <span className="proto-accordion__chevron" aria-hidden="true">
                    ›
                  </span>
                )}
              </button>
            </div>
            {isOpen && (
              <div className="leagues-chips proto-accordion__leagues">
                {group.leagues.map((league) => (
                  <LeagueChip key={league.name} league={league} settings={settings} onChange={onChange} className="rail-chip proto-small-chip" />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const sportIcons: Record<string, string> = {
  Football: '🏈',
  Basketball: '🏀',
  Baseball: '⚾',
  Hockey: '🏒',
  Soccer: '⚽',
  Cricket: '🏏',
  Tennis: '🎾',
  Golf: '⛳',
  Rugby: '🏉',
  Motorsport: '🏎️',
  MMA: '🥊',
}

/** F: pick sports by their icons first; each sport picked then lists its leagues to narrow it down. */
function SportIcons({ leagues, settings, onChange }: PickerProps) {
  const groups = leaguesBySport(leagues)
  const picked = groups.filter((g) => sportSwitch(settings, g) !== 'off' && g.leagues.length > 1)
  return (
    <div className="proto-icons">
      <div className="proto-icons__grid">
        {groups.map((group) => {
          const state = sportSwitch(settings, group)
          return (
            <button
              key={group.sport}
              type="button"
              aria-pressed={state !== 'off'}
              className={`proto-icons__sport proto-icons__sport--${state}`}
              onClick={() => onChange(withSport(settings, group, state === 'off'))}
            >
              <span className="proto-icons__icon">{sportIcons[group.sport] ?? '🏅'}</span>
              <span className="proto-icons__name">{group.sport}</span>
            </button>
          )
        })}
      </div>
      {picked.length > 0 && (
        <div className="proto-icons__narrow">
          <span className="proto-label">Narrow it down</span>
          {picked.map((group) => (
            <div key={group.sport} className="proto-icons__sport-leagues">
              <span className="proto-icons__small-icon">{sportIcons[group.sport] ?? '🏅'}</span>
              {group.leagues.map((league) => (
                <LeagueChip key={league.name} league={league} settings={settings} onChange={onChange} className="rail-chip proto-small-chip" />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

