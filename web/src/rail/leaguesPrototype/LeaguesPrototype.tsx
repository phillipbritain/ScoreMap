// PROTOTYPE (throwaway, not for main): five alternative looks for the rail's Leagues popover, beside
// the current one, switched by `?pickerProto=` and the floating PickerPrototypeBar. The question: what
// should the league and sport switches look like, in place of the white "on" pills, on the dark theme?
// Same data and switches as Leagues; only the rendering differs.
import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withAllLeagues,
  withLeague,
  withSport,
  type League,
  type ViewerSettings,
} from '../../settings/viewerSettings'
import { Leagues } from '../Leagues'
import { usePickerProto } from './pickerProto'
import './leaguesPrototype.css'

interface Props {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  /** The theme's accent (gold), for a sport or league with no color picked. */
  accent: string
}

type Tri = 'on' | 'off' | 'mixed'

interface Model {
  top: boolean
  setTop: (top: boolean) => void
  leaguesOn: number
  total: number
  all: Tri
  toggleAll: () => void
  sports: {
    sport: string
    on: number
    state: Tri
    color: string
    toggle: () => void
    leagues: { name: string; on: boolean; color: string; toggle: () => void }[]
  }[]
}

function model({ leagues, settings, onChange, accent }: Props): Model {
  const leaguesOn = leagues.filter((league) => isLeagueOn(settings, league.name)).length
  const all: Tri = leaguesOn === leagues.length ? 'on' : leaguesOn === 0 ? 'off' : 'mixed'
  return {
    top: settings.topEventsOnly,
    setTop: (top) => onChange({ ...settings, topEventsOnly: top }),
    leaguesOn,
    total: leagues.length,
    all,
    toggleAll: () => onChange(withAllLeagues(settings, leagues, all !== 'on')),
    sports: leaguesBySport(leagues).map((group) => {
      const state = sportSwitch(settings, group)
      const color = settings.sportColors[group.sport] ?? accent
      return {
        sport: group.sport,
        on: group.leagues.filter((league) => isLeagueOn(settings, league.name)).length,
        state,
        color,
        toggle: () => onChange(withSport(settings, group, state !== 'on')),
        leagues: group.leagues.map((league) => {
          const on = isLeagueOn(settings, league.name)
          return {
            name: league.name,
            on,
            color: settings.leagueColors[league.name] ?? color,
            toggle: () => onChange(withLeague(settings, league.name, !on)),
          }
        }),
      }
    }),
  }
}

export function LeaguesPrototype(props: Props) {
  const variant = usePickerProto()
  if (variant === 'current') return <Leagues leagues={props.leagues} settings={props.settings} onChange={props.onChange} />
  const m = model(props)
  if (variant === 'glow') return <GlowPills m={m} />
  if (variant === 'switches') return <ToggleList m={m} />
  if (variant === 'colors') return <SportColors m={m} />
  if (variant === 'cards') return <SportCards m={m} />
  return <SportTabs m={m} />
}

const Star = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

/** "Top Events | My leagues", as two radios; each variant styles it through its class prefix. */
function Scope({ m, prefix }: { m: Model; prefix: string }) {
  return (
    <>
      <div className={`${prefix}-scope`} role="radiogroup" aria-label="Show">
        <button type="button" role="radio" aria-checked={m.top} className={`${prefix}-scope__option`} onClick={() => m.setTop(true)}>
          <Star className="pp-star" />
          Top Events
        </button>
        <button type="button" role="radio" aria-checked={!m.top} className={`${prefix}-scope__option`} onClick={() => m.setTop(false)}>
          My leagues
        </button>
      </div>
      {m.top && <p className="pp-note">The games ESPN picks as the most important right now, in every sport.</p>}
    </>
  )
}

/** The leagues, grayed out and out of reach while Top Events decides. */
function List({ m, className, children }: { m: Model; className: string; children: ReactNode }) {
  return (
    <div className={m.top ? `${className} pp-off` : className} inert={m.top}>
      {children}
    </div>
  )
}

const colorVar = (color: string) => ({ '--pp-color': color }) as CSSProperties

// ─── B: Gold glow pills ──────────────────────────────────────────────────────────────────────────
// Pills kept, but "on" is lit the way a Live score card is: deep navy fill, gold outline and a soft
// gold glow, with a lit dot, instead of a white fill. Off is a faint hollow outline.

function GlowPills({ m }: { m: Model }) {
  return (
    <div className="pp-glow">
      <Scope m={m} prefix="pp-glow" />
      <List m={m} className="pp-glow__list">
        <button type="button" className="pp-glow__all" data-state={m.all} aria-pressed={m.all === 'on'} onClick={m.toggleAll}>
          <span className="pp-glow__dot" aria-hidden="true" />
          All leagues
          <span className="pp-glow__count">
            {m.leaguesOn}/{m.total}
          </span>
        </button>
        {m.sports.map((s) => (
          <section key={s.sport} className="pp-glow__sport">
            <button type="button" className="pp-glow__sport-name" data-state={s.state} onClick={s.toggle}>
              {s.sport}
              <span className="pp-glow__count">
                {s.on}/{s.leagues.length}
              </span>
            </button>
            <div className="pp-glow__chips">
              {s.leagues.map((l) => (
                <button key={l.name} type="button" className="pp-glow__chip" aria-pressed={l.on} onClick={l.toggle}>
                  <span className="pp-glow__dot" aria-hidden="true" />
                  {l.name}
                </button>
              ))}
            </div>
          </section>
        ))}
      </List>
    </div>
  )
}

// ─── C: Toggle list ──────────────────────────────────────────────────────────────────────────────
// No pills at all: a settings-style list, each league a row with a switch, each sport a heading row
// with a switch of its own that shows "some" with its knob in the middle.

function Switch({ state }: { state: Tri }) {
  return (
    <span className="pp-switch" data-state={state} aria-hidden="true">
      <span className="pp-switch__knob" />
    </span>
  )
}

function ToggleList({ m }: { m: Model }) {
  return (
    <div className="pp-rows">
      <Scope m={m} prefix="pp-rows" />
      <List m={m} className="pp-rows__list">
        <button type="button" role="switch" aria-checked={m.all === 'mixed' ? 'mixed' : m.all === 'on'} className="pp-rows__row pp-rows__row--all" onClick={m.toggleAll}>
          <span className="pp-rows__name">All leagues</span>
          <span className="pp-rows__count">
            {m.leaguesOn}/{m.total}
          </span>
          <Switch state={m.all} />
        </button>
        {m.sports.map((s) => (
          <section key={s.sport} className="pp-rows__sport">
            <button type="button" role="switch" aria-checked={s.state === 'mixed' ? 'mixed' : s.state === 'on'} className="pp-rows__row pp-rows__row--sport" onClick={s.toggle}>
              <span className="pp-rows__name">{s.sport}</span>
              <span className="pp-rows__count">
                {s.on}/{s.leagues.length}
              </span>
              <Switch state={s.state} />
            </button>
            {s.leagues.map((l) => (
              <button key={l.name} type="button" role="switch" aria-checked={l.on} className="pp-rows__row pp-rows__row--league" onClick={l.toggle}>
                <span className="pp-rows__name">{l.name}</span>
                <Switch state={l.on ? 'on' : 'off'} />
              </button>
            ))}
          </section>
        ))}
      </List>
    </div>
  )
}

// ─── D: Sport colors ─────────────────────────────────────────────────────────────────────────────
// Each sport wears its color: the one picked in Display Settings, else the accent (gold). A league
// that's on is tinted in it, with a filled dot; off, it's hollow. Ties Leagues to Display Settings.

function SportColors({ m }: { m: Model }) {
  return (
    <div className="pp-colors">
      <Scope m={m} prefix="pp-colors" />
      <List m={m} className="pp-colors__list">
        <button type="button" className="pp-colors__all" data-state={m.all} aria-pressed={m.all === 'on'} onClick={m.toggleAll}>
          {m.all === 'on' ? 'Hide all leagues' : 'Show all leagues'}
          <span className="pp-colors__count">
            {m.leaguesOn}/{m.total} on
          </span>
        </button>
        {m.sports.map((s) => (
          <section key={s.sport} className="pp-colors__sport" style={colorVar(s.color)}>
            <button type="button" className="pp-colors__sport-name" data-state={s.state} onClick={s.toggle}>
              <span className="pp-colors__bar" aria-hidden="true" />
              {s.sport}
              <span className="pp-colors__count">
                {s.on}/{s.leagues.length}
              </span>
            </button>
            <div className="pp-colors__chips">
              {s.leagues.map((l) => (
                <button key={l.name} type="button" className="pp-colors__chip" style={colorVar(l.color)} aria-pressed={l.on} onClick={l.toggle}>
                  <span className="pp-colors__dot" aria-hidden="true" />
                  {l.name}
                </button>
              ))}
            </div>
          </section>
        ))}
      </List>
    </div>
  )
}

// ─── E: Sport cards + checkboxes ─────────────────────────────────────────────────────────────────
// Each sport a card of its own on a deeper navy, its header a tri-state checkbox and a meter of how
// many of its leagues are on; leagues as checkboxes in two columns. Gold checks, not white fills.

function Check({ state }: { state: Tri }) {
  return (
    <span className="pp-check" data-state={state} aria-hidden="true">
      {state === 'on' ? '✓' : state === 'mixed' ? '–' : ''}
    </span>
  )
}

function SportCards({ m }: { m: Model }) {
  return (
    <div className="pp-cards">
      <Scope m={m} prefix="pp-cards" />
      <List m={m} className="pp-cards__list">
        <button type="button" role="checkbox" aria-checked={m.all === 'mixed' ? 'mixed' : m.all === 'on'} className="pp-cards__all" onClick={m.toggleAll}>
          <Check state={m.all} />
          All leagues
          <span className="pp-cards__count">
            {m.leaguesOn}/{m.total}
          </span>
        </button>
        {m.sports.map((s) => (
          <section key={s.sport} className="pp-cards__card" data-state={s.state}>
            <button type="button" role="checkbox" aria-checked={s.state === 'mixed' ? 'mixed' : s.state === 'on'} className="pp-cards__head" onClick={s.toggle}>
              <Check state={s.state} />
              <span className="pp-cards__sport">{s.sport}</span>
              <span className="pp-cards__meter" aria-hidden="true">
                {s.leagues.map((l) => (
                  <span key={l.name} className="pp-cards__segment" data-on={l.on} />
                ))}
              </span>
            </button>
            <div className="pp-cards__leagues">
              {s.leagues.map((l) => (
                <button key={l.name} type="button" role="checkbox" aria-checked={l.on} className="pp-cards__league" onClick={l.toggle}>
                  <Check state={l.on ? 'on' : 'off'} />
                  {l.name}
                </button>
              ))}
            </div>
          </section>
        ))}
      </List>
    </div>
  )
}

// ─── F: Sport tabs ───────────────────────────────────────────────────────────────────────────────
// Sports become the navigation: a column of sport tabs (a scrolling row on a phone), each with a
// ring showing all / some / none on; the chosen sport's leagues fill the rest as big tiles.

function SportTabs({ m }: { m: Model }) {
  const [chosen, setChosen] = useState(m.sports[0]?.sport)
  const sport = m.sports.find((s) => s.sport === chosen) ?? m.sports[0]
  return (
    <div className="pp-tabs">
      <Scope m={m} prefix="pp-tabs" />
      <List m={m} className="pp-tabs__list">
        <div className="pp-tabs__body">
          <div className="pp-tabs__sports" role="tablist" aria-label="Sports">
            {m.sports.map((s) => (
              <button
                key={s.sport}
                type="button"
                role="tab"
                aria-selected={s.sport === sport?.sport}
                className="pp-tabs__tab"
                onClick={() => setChosen(s.sport)}
              >
                <span className="pp-tabs__ring" data-state={s.state} aria-hidden="true" />
                <span className="pp-tabs__tab-name">{s.sport}</span>
                <span className="pp-tabs__count">
                  {s.on}/{s.leagues.length}
                </span>
              </button>
            ))}
            <button type="button" className="pp-tabs__all" onClick={m.toggleAll}>
              {m.all === 'on' ? 'All off' : 'All on'}
            </button>
          </div>
          {sport && (
            <div className="pp-tabs__panel" role="tabpanel" aria-label={sport.sport}>
              <button type="button" className="pp-tabs__sport-switch" onClick={sport.toggle}>
                {sport.state === 'on' ? `Hide all ${sport.sport}` : `Show all ${sport.sport}`}
              </button>
              {sport.leagues.map((l) => (
                <button key={l.name} type="button" aria-pressed={l.on} className="pp-tabs__tile" onClick={l.toggle}>
                  <span className="pp-tabs__tile-name">{l.name}</span>
                  <span className="pp-tabs__tile-state">{l.on ? 'Showing' : 'Hidden'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </List>
    </div>
  )
}
