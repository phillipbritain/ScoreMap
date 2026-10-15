// oxlint-disable react/only-export-components
// PROTOTYPE, throwaway (branch prototype-top-events): where a "Top Events" switch should live.
// Three variants on the real app, switched by ?variant=A|B|C and the floating bar at the bottom:
//   A  Leagues popover: a "Top Events | My leagues" switch at its top, like ESPN's dropdown. Top
//      Events is a choice of its own: it ignores the viewer's league picks.
//   B  Rail: a star toggle beside "Live only", with a toast. Narrows the leagues already on.
//   C  A "Top events / All games" pill at the top centre of the globe, with counts. Narrows too.
// The list is ESPN's own: the scoreboard header its front page reads, asked with no sport. Fetched
// straight from the browser here (ESPN allows any origin); a real build would go through the server.
import { useEffect, useMemo, useState } from 'react'
import type { Game } from '../games/game'

export type TopVariant = 'A' | 'B' | 'C'
const variants: { key: TopVariant; name: string }[] = [
  { key: 'A', name: 'In the Leagues popover' },
  { key: 'B', name: 'Rail button' },
  { key: 'C', name: 'Pill over the globe' },
]

const headerUrl =
  'https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?region=us&lang=en&contentorigin=espn&configuration=SITE_DEFAULT&platform=web'

interface Header {
  sports?: { leagues?: { events?: { id: string; competitionId?: string }[] }[] }[]
}

/** ESPN's Top Events, as event ids (a game's id is its ESPN event id), and match ids for tennis, whose event is the tournament; null until they load. Every minute. */
function useEspnTopEvents(): string[] | null {
  const [ids, setIds] = useState<string[] | null>(null)
  useEffect(() => {
    const load = () =>
      fetch(headerUrl)
        .then((response) => response.json() as Promise<Header>)
        .then((header) =>
          setIds((header.sports ?? []).flatMap((s) => (s.leagues ?? []).flatMap((l) => (l.events ?? []).flatMap((e) => [e.id, e.competitionId ?? e.id])))),
        )
        .catch((error: unknown) => console.error('PROTOTYPE: could not load ESPN Top Events', error))
    void load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return ids
}

export interface TopEvents {
  variant: TopVariant
  on: boolean
  setOn: (on: boolean) => void
  /** The games that count as top events. */
  ids: ReadonlySet<string>
  /** 'espn' when ESPN's list matched games on the globe; 'stub' (two per league) when none did, as in a scenario. */
  source: 'espn' | 'stub'
  espnCount: number | null
}

export function useTopEvents(games: readonly Game[] | null): TopEvents {
  const [variant, setVariant] = useState<TopVariant>(readVariant)
  const [on, setOn] = useState(false)
  const espn = useEspnTopEvents()
  useEffect(() => {
    const onPop = () => setVariant(readVariant())
    window.addEventListener('prototype-variant', onPop)
    return () => window.removeEventListener('prototype-variant', onPop)
  }, [])
  const { ids, source } = useMemo(() => {
    const all = games ?? []
    const espnIds = new Set(espn ?? [])
    const matched = all.filter((game) => espnIds.has(game.id)).map((game) => game.id)
    if (matched.length > 0) return { ids: new Set(matched), source: 'espn' as const }
    const perLeague = new Map<string, number>()
    const stub = all.filter((game) => {
      const n = perLeague.get(game.league) ?? 0
      perLeague.set(game.league, n + 1)
      return n < 2
    })
    return { ids: new Set(stub.map((game) => game.id)), source: 'stub' as const }
  }, [games, espn])
  return { variant, on, setOn, ids, source, espnCount: espn?.length ?? null }
}

function readVariant(): TopVariant {
  const v = new URLSearchParams(window.location.search).get('variant')
  return v === 'B' || v === 'C' ? v : 'A'
}

function goTo(variant: TopVariant) {
  const url = new URL(window.location.href)
  url.searchParams.set('variant', variant)
  window.history.replaceState(null, '', url)
  window.dispatchEvent(new Event('prototype-variant'))
}

/** The floating bar: ← variant →, and the prototype's state. Local runs only. */
export function PrototypeSwitcher({ top, shown }: { top: TopEvents; shown: number }) {
  const index = variants.findIndex((v) => v.key === top.variant)
  const step = (by: number) => goTo(variants[(index + by + variants.length) % variants.length].key)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable], .maplibregl-canvas')) return
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!import.meta.env.DEV) return null
  return (
    <div className="proto-switcher" data-keeps-popovers data-native-tooltips>
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        <b>{top.variant}</b> ({variants[index].name})
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
      <span className="proto-switcher__state">
        Top: {top.on ? 'on' : 'off'} · ESPN list {top.espnCount ?? '…'} · top on globe {top.ids.size} ({top.source}) · pins{' '}
        {shown}
      </span>
    </div>
  )
}

/** Variant A: the switch at the top of the Leagues popover. */
export function TopEventsTabs({ top, leaguesBody }: { top: TopEvents; leaguesBody: React.ReactNode }) {
  return (
    <>
      <div className="proto-tabs" role="radiogroup" aria-label="Show">
        <button type="button" role="radio" aria-checked={top.on} onClick={() => top.setOn(true)}>
          <StarGlyph /> Top Events
        </button>
        <button type="button" role="radio" aria-checked={!top.on} onClick={() => top.setOn(false)}>
          My leagues
        </button>
      </div>
      {top.on ? (
        <>
          <p className="proto-note">
            The games ESPN picks as the most important right now, across every sport: {top.ids.size} on the globe.
          </p>
          <div className="proto-dimmed" aria-hidden="true">
            {leaguesBody}
          </div>
        </>
      ) : (
        leaguesBody
      )}
    </>
  )
}

/** Variant C: the pill at the top centre of the globe. */
export function TopEventsPill({ top, all }: { top: TopEvents; all: number }) {
  return (
    <div className="proto-pill" role="radiogroup" aria-label="Show">
      <button type="button" role="radio" aria-checked={top.on} onClick={() => top.setOn(true)}>
        <StarGlyph /> Top events <span className="proto-pill__count">{top.ids.size}</span>
      </button>
      <button type="button" role="radio" aria-checked={!top.on} onClick={() => top.setOn(false)}>
        All games <span className="proto-pill__count">{all}</span>
      </button>
    </div>
  )
}

function StarGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d={starPath} />
    </svg>
  )
}

/** Feather's "star", for the rail button (variant B) and the glyphs above. */
export const starPath = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
