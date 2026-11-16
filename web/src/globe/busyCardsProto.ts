// PROTOTYPE, throw away: fewer score cards where it's busy (`?busyCardsProto=A|B|C|D|E`, `[`/`]` to switch).
// Variants:
//   A  Today: every game near the center of the view gets a card if there's room for it.
//   B  Cap by screen: at most one card per ~55,000 px² of screen (about 19 at 1280x800, 6 at 390x844),
//      the best-ranked games first; the rest count in card clusters or show as small pins.
//   C  Spacing: a game gets a card only if its venue is a card's breadth from every better-ranked card's
//      venue, so each area shows its best game and counts the rest.
//   D  Close to home: a card may sit only a short way from its venue (its trail at most ~40 px); a crowd's
//      cards that can't find room that near count in card clusters.
//   E  Compact on phones: on a narrow screen, cards lose their logos and shrink, and the cap of B applies
//      (counted for the smaller card); wide screens get B.
// Ranking (B to E): hot, then clutch time, then close Live games, then other Live games, then Upcoming,
// then Final; within each, games with more ranked teams (and higher-ranked) first. The selected game always
// keeps its card.
import type { Game } from '../games/game'

export type BusyVariant = 'A' | 'B' | 'C' | 'D' | 'E'
const variants: BusyVariant[] = ['A', 'B', 'C', 'D', 'E']
const names: Record<BusyVariant, string> = {
  A: 'Today',
  B: 'Cap by screen',
  C: 'Spacing',
  D: 'Close to home',
  E: 'Compact on phones',
}

const param = new URLSearchParams(globalThis.location?.search ?? '').get('busyCardsProto')?.toUpperCase()
export const busyVariant: BusyVariant | null = variants.includes(param as BusyVariant) ? (param as BusyVariant) : null

const narrow = () => (globalThis.innerWidth ?? 1280) < 600

// B and E's cap, picked on the switcher (− / +, one card a step) and kept in the URL: `&busyCards=` for
// wide screens, `&busyPhoneCards=` for narrow ones. Unset, it's one card per 55,000 px² (40,000 for E's
// compact phone cards), at least 4.
const capParam = () => (narrow() ? 'busyPhoneCards' : 'busyCards')
const pickedCap = () => {
  const picked = Number(new URLSearchParams(globalThis.location?.search ?? '').get(capParam()))
  return Number.isInteger(picked) && picked >= 1 ? picked : undefined
}
const defaultCap = (width: number, height: number) =>
  Math.max(4, Math.round((width * height) / (busyVariant === 'E' && narrow() ? 40000 : 55000)))
const capFor = (width: number, height: number) => pickedCap() ?? defaultCap(width, height)

/** Lower comes first. */
export function busyPriority(game: Game): number {
  let band: number
  if (game.status === 'Live') {
    if (game.hot) band = 0
    else if (game.clutchTime) band = 1
    else if (isClose(game)) band = 2
    else band = 3
  } else band = game.status === 'Upcoming' ? 4 : 5
  return band + rankBonus(game)
}

function isClose(game: Game): boolean {
  if (game.contest.kind !== 'sides') return false
  const home = Number(game.contest.home.score)
  const away = Number(game.contest.away.score)
  if (!Number.isFinite(home) || !Number.isFinite(away)) return false
  const margin = Math.abs(home - away)
  const sport = game.sport.toLowerCase()
  return margin <= (sport.includes('basketball') ? 8 : sport.includes('football') ? 8 : 1)
}

/** Between 0 and -0.9: ranked teams pull a game forward within its band. */
function rankBonus(game: Game): number {
  if (game.contest.kind !== 'sides') return 0
  let bonus = 0
  for (const team of [game.contest.home, game.contest.away]) if (team.rank) bonus -= 0.2 + (26 - team.rank) * 0.01
  return Math.max(-0.9, bonus)
}

export interface BusyRules {
  /** Most cards with venues on screen; undefined for no cap. */
  cap?: number
  /** Least distance, px, between the venues of two cards. */
  spacing?: number
  /** Furthest a card's trail may reach, px. */
  reach?: number
}

export function busyRules(width: number, height: number): BusyRules {
  switch (busyVariant) {
    case 'B':
      return { cap: capFor(width, height) }
    case 'C':
      return { spacing: narrow() ? 95 : 120 }
    case 'D':
      return { reach: 40 }
    case 'E':
      return { cap: capFor(width, height) }
    default:
      return {}
  }
}

export function busyCompact(): boolean {
  return busyVariant === 'E' && narrow()
}

/** The floating switcher; call once. */
export function mountBusySwitcher(): void {
  if (!busyVariant) return
  document.documentElement.classList.toggle('busy-proto-compact', busyCompact())
  // Cards are measured as they're drawn, so crossing into or out of phone width starts afresh.
  const wasNarrow = narrow()
  if (busyVariant === 'E') window.addEventListener('resize', () => narrow() !== wasNarrow && location.reload())
  const go = (step: number) => {
    const next = variants[(variants.indexOf(busyVariant) + step + variants.length) % variants.length]
    const url = new URL(location.href)
    url.searchParams.set('busyCardsProto', next)
    location.href = url.toString()
  }
  const capped = busyVariant === 'B' || busyVariant === 'E'
  // Steps show at once; the page reloads with the new cap once the clicks stop.
  let cap = capFor(innerWidth, innerHeight)
  let reload: ReturnType<typeof setTimeout> | undefined
  const more = (step: number) => {
    cap = Math.max(1, cap + step)
    capLabel.textContent = capText()
    clearTimeout(reload)
    reload = setTimeout(() => {
      const url = new URL(location.href)
      url.searchParams.set(capParam(), String(cap))
      location.href = url.toString()
    }, 700)
  }
  const capText = () => `${cap} cards on ${narrow() ? 'phones' : 'wide screens'}`
  const capLabel = document.createElement('span')
  const bar = document.createElement('div')
  bar.className = 'busy-proto-bar'
  const button = (text: string, act: () => void) => {
    const b = document.createElement('button')
    b.textContent = text
    b.onclick = act
    return b
  }
  const label = document.createElement('span')
  label.textContent = `${busyVariant} ${names[busyVariant]}`
  bar.append(button('[', () => go(-1)), label, button(']', () => go(1)))
  if (capped) {
    capLabel.textContent = capText()
    capLabel.title = '− / + or the - / = keys: one card fewer or more'
    bar.append(button('−', () => more(-1)), capLabel, button('+', () => more(1)))
  }
  document.body.append(bar)
  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    if (event.key === '[') go(-1)
    if (event.key === ']') go(1)
    if (capped && event.key === '-') more(-1)
    if (capped && (event.key === '=' || event.key === '+')) more(1)
  })
  const style = document.createElement('style')
  style.textContent = `
    .busy-proto-bar { position: fixed; top: 8px; left: 50%; transform: translateX(-50%); z-index: 10000;
      display: flex; gap: 8px; align-items: center; padding: 4px 8px; border-radius: 999px;
      background: #000c; color: #fff; font: 600 13px system-ui; white-space: nowrap; }
    .busy-proto-bar button { all: unset; cursor: pointer; padding: 2px 8px; border-radius: 6px; background: #fff2; }
    .busy-proto-compact .score-card__logo { display: none; }
    .busy-proto-compact .score-card__team { grid-template-columns: 1fr auto; gap: 4px; padding: 0 4px; }
    .busy-proto-compact .score-card { min-width: 0; font-size: 10px; padding-bottom: 2px; gap: 0; }
    .busy-proto-compact .score-card__header { font-size: 9px; padding: 1px 4px; }
  `
  document.head.append(style)
}
