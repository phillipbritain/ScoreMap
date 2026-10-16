// PROTOTYPE, throw away: options for the welcome tour's My leagues picker, switched by ?picker=A…E
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
  { key: 'B', name: 'Sport tiles, open one for its leagues' },
  { key: 'C', name: 'Two columns: sports, then leagues' },
  { key: 'D', name: 'Search, suggestions and one chip cloud' },
  { key: 'E', name: 'Sport tabs, with a tray of your picks' },
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
      {variant === 'B' && <SportTiles {...props} />}
      {variant === 'C' && <TwoColumns {...props} />}
      {variant === 'D' && <SearchCloud {...props} />}
      {variant === 'E' && <SportTabs {...props} />}
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

/** B: a grid of sport tiles, each a whole-sport switch with how many of its leagues are on; ▾ opens its leagues below the grid. */
function SportTiles({ leagues, settings, onChange, games }: PickerProps) {
  const counts = useCounts(games)
  const [open, setOpen] = useState<string | null>(null)
  const groups = leaguesBySport(leagues)
  const openGroup = groups.find((g) => g.sport === open)
  return (
    <div className="proto-tiles">
      <div className="proto-tiles__grid">
        {groups.map((group) => {
          const state = sportSwitch(settings, group)
          const live = group.leagues.reduce((n, l) => n + counts.live(l.name), 0)
          return (
            <div key={group.sport} className={`proto-tile proto-tile--${state} ${open === group.sport ? 'proto-tile--open' : ''}`}>
              <button
                type="button"
                aria-pressed={state === 'on'}
                className="proto-tile__main"
                onClick={() => onChange(withSport(settings, group, state !== 'on'))}
              >
                <span className="proto-tile__name">{group.sport}</span>
                <span className="proto-tile__meta">
                  {live > 0 ? <span className="proto-live">● {live} live</span> : <span>No live games</span>}
                </span>
              </button>
              {group.leagues.length > 1 && (
                <button
                  type="button"
                  className="proto-tile__more"
                  aria-expanded={open === group.sport}
                  onClick={() => setOpen(open === group.sport ? null : group.sport)}
                >
                  {onCount(settings, group)}/{group.leagues.length} ▾
                </button>
              )}
            </div>
          )
        })}
      </div>
      {openGroup && (
        <div className="proto-tiles__leagues">
          <span className="proto-label">{openGroup.sport} leagues</span>
          <div className="leagues-chips">
            {openGroup.leagues.map((league) => {
              const on = isLeagueOn(settings, league.name)
              return (
                <button
                  key={league.name}
                  type="button"
                  aria-pressed={on}
                  className="rail-chip"
                  onClick={() => onChange(withLeague(settings, league.name, !on))}
                >
                  {league.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** A small tri-state box: filled, part-filled or empty. */
function Box({ state }: { state: 'on' | 'off' | 'mixed' }) {
  return <span className={`proto-box proto-box--${state}`}>{state === 'on' ? '✓' : state === 'mixed' ? '–' : ''}</span>
}

/** C: sports down the left, each a tri-state switch; the focused sport's leagues on the right, with games now. */
function TwoColumns({ leagues, settings, onChange, games }: PickerProps) {
  const counts = useCounts(games)
  const groups = leaguesBySport(leagues)
  const [focus, setFocus] = useState(groups[0]?.sport)
  const group = groups.find((g) => g.sport === focus) ?? groups[0]
  if (!group) return null
  return (
    <div className="proto-columns">
      <ul className="proto-columns__sports">
        {groups.map((g) => {
          const state = sportSwitch(settings, g)
          return (
            <li key={g.sport} className={g.sport === group.sport ? 'proto-columns__sport--focus' : ''}>
              <button type="button" className="proto-columns__check" aria-label={`All ${g.sport}`} onClick={() => onChange(withSport(settings, g, state !== 'on'))}>
                <Box state={state} />
              </button>
              <button type="button" className="proto-columns__name" onClick={() => setFocus(g.sport)}>
                {g.sport}
                <span className="proto-count">{onCount(settings, g) || ''}</span>
                <span aria-hidden="true">›</span>
              </button>
            </li>
          )
        })}
      </ul>
      <ul className="proto-columns__leagues">
        {group.leagues.length > 1 && (
          <li>
            <button type="button" className="proto-row proto-row--all" onClick={() => onChange(withSport(settings, group, sportSwitch(settings, group) !== 'on'))}>
              <Box state={sportSwitch(settings, group)} /> All {group.sport}
            </button>
          </li>
        )}
        {group.leagues.map((league) => {
          const on = isLeagueOn(settings, league.name)
          const live = counts.live(league.name)
          return (
            <li key={league.name}>
              <button type="button" className="proto-row" aria-pressed={on} onClick={() => onChange(withLeague(settings, league.name, !on))}>
                <Box state={on ? 'on' : 'off'} />
                <span className="proto-row__name">{league.name}</span>
                <span className="proto-row__meta">
                  {live > 0 ? <span className="proto-live">● {live}</span> : counts.all(league.name) > 0 ? `${counts.all(league.name)} today` : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** D: a search box, the busiest leagues right now as suggestions, then every league in one cloud, each tagged with its sport. */
function SearchCloud({ leagues, settings, onChange, games }: PickerProps) {
  const counts = useCounts(games)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const suggested = [...leagues].sort((a, b) => counts.all(b.name) - counts.all(a.name)).slice(0, 4)
  const groups = leaguesBySport(leagues)
    .map((g) => ({ ...g, leagues: g.leagues.filter((l) => !q || l.name.toLowerCase().includes(q) || g.sport.toLowerCase().includes(q)) }))
    .filter((g) => g.leagues.length > 0)
  const chip = (league: League, extra?: ReactNode) => {
    const on = isLeagueOn(settings, league.name)
    return (
      <button key={league.name} type="button" aria-pressed={on} className="rail-chip proto-cloud__chip" onClick={() => onChange(withLeague(settings, league.name, !on))}>
        {league.name}
        {extra}
      </button>
    )
  }
  return (
    <div className="proto-cloud">
      <input className="proto-cloud__search" placeholder="Search sports and leagues" value={query} onChange={(e) => setQuery(e.target.value)} />
      {!q && (
        <>
          <span className="proto-label">Busiest right now</span>
          <div className="leagues-chips">{suggested.map((l) => chip(l, <span className="proto-cloud__n">{counts.all(l.name)}</span>))}</div>
        </>
      )}
      <div className="proto-cloud__all">
        {groups.map((g) => {
          const state = sportSwitch(settings, g)
          return (
            <span key={g.sport} className="proto-cloud__group">
              <button type="button" className={`proto-cloud__sport proto-cloud__sport--${state}`} onClick={() => onChange(withSport(settings, g, state !== 'on'))}>
                {g.sport}
              </button>
              {g.leagues.map((l) => chip(l))}
            </span>
          )
        })}
        {groups.length === 0 && <span className="proto-label">Nothing matches “{query}”</span>}
      </div>
    </div>
  )
}

/** E: a strip of sport tabs; the tab's leagues as large toggles with games now; a tray of what's picked so far. */
function SportTabs({ leagues, settings, onChange, games }: PickerProps) {
  const counts = useCounts(games)
  const groups = leaguesBySport(leagues)
  const [tab, setTab] = useState(groups[0]?.sport)
  const group = groups.find((g) => g.sport === tab) ?? groups[0]
  if (!group) return null
  const picked = leagues.filter((l) => isLeagueOn(settings, l.name))
  const state = sportSwitch(settings, group)
  return (
    <div className="proto-tabs">
      <div className="proto-tabs__strip" role="tablist">
        {groups.map((g) => (
          <button key={g.sport} type="button" role="tab" aria-selected={g.sport === group.sport} className="proto-tabs__tab" onClick={() => setTab(g.sport)}>
            {g.sport}
            {onCount(settings, g) > 0 && <span className="proto-tabs__dot" />}
          </button>
        ))}
      </div>
      <div className="proto-tabs__body">
        {group.leagues.map((league) => {
          const on = isLeagueOn(settings, league.name)
          const live = counts.live(league.name)
          return (
            <button key={league.name} type="button" aria-pressed={on} className="proto-tabs__league" onClick={() => onChange(withLeague(settings, league.name, !on))}>
              <span className="proto-tabs__league-name">{league.name}</span>
              <span className="proto-row__meta">{live > 0 ? <span className="proto-live">● {live} live</span> : `${counts.all(league.name)} games`}</span>
            </button>
          )
        })}
        {group.leagues.length > 1 && (
          <button type="button" className="proto-tabs__all" onClick={() => onChange(withSport(settings, group, state !== 'on'))}>
            {state === 'on' ? `None of ${group.sport}` : `All of ${group.sport}`}
          </button>
        )}
      </div>
      <div className="proto-tabs__tray">
        <span className="proto-label">Your picks ({picked.length})</span>
        <div className="proto-tabs__tokens">
          {picked.length === 0 && <span className="proto-hint">Nothing yet</span>}
          {picked.map((l) => (
            <button key={l.name} type="button" className="proto-token" onClick={() => onChange(withLeague(settings, l.name, false))}>
              {l.name} ×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
