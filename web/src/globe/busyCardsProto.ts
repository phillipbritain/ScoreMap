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
// Ranking (B to E): hot (clutch time included), then other Live games, then Upcoming, then Final (with
// `&busyCenter=second|first`, games near the middle of the screen a tier after hot games, or first);
// within each, games with more ranked teams (and higher-ranked) first. The selected game always keeps
// its card.
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

// Near the center: a venue within this share of the screen's shorter side from its middle.
const centerRadius = 0.3
type CenterTier = 'off' | 'second' | 'first'
const centerTiers: CenterTier[] = ['off', 'second', 'first']
const centerParam = new URLSearchParams(globalThis.location?.search ?? '').get('busyCenter') as CenterTier
const centerTier: CenterTier = centerTiers.includes(centerParam) ? centerParam : 'off'
const centerNames: Record<CenterTier, string> = { off: 'Center: off', second: 'Center: 2nd', first: 'Center: 1st' }

export interface BusyView {
  venueX: number
  venueY: number
  width: number
  height: number
}

function nearCenter({ venueX, venueY, width, height }: BusyView): boolean {
  return Math.hypot(venueX - width / 2, venueY - height / 2) <= centerRadius * Math.min(width, height)
}

/**
 * Lower comes first. Tiers 100 apart, the usual order (hot, Live, Upcoming, Final) 10 apart within a tier,
 * ranked teams (under 1) within that. With the center on, games near it are a tier of their own: after
 * hot games (2nd), or ahead of everything (1st, each side in the usual order).
 */
export function busyPriority(game: Game, view: BusyView): number {
  // A basketball game in clutch time is a hot game, so hot covers both.
  const hot = game.status === 'Live' && game.hot
  const usual = game.status === 'Live' ? (hot ? 0 : 1) : game.status === 'Upcoming' ? 2 : 3
  const center = centerTier !== 'off' && nearCenter(view)
  const tier = centerTier === 'first' ? (center ? 0 : 1) : centerTier === 'second' ? (hot ? 0 : center ? 1 : 2) : 0
  return tier * 100 + usual * 10 + rankBonus(game)
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
  if (busyVariant !== 'A') {
    const next = centerTiers[(centerTiers.indexOf(centerTier) + 1) % centerTiers.length]
    const centerButton = button(centerNames[centerTier], () => {
      const url = new URL(location.href)
      url.searchParams.set('busyCenter', next)
      location.href = url.toString()
    })
    centerButton.title = 'Rank games near the middle of the screen: off, after hot games, or first'
    bar.append(centerButton)
    if (centerTier !== 'off') {
      const ring = document.createElement('div')
      ring.className = 'busy-proto-center'
      document.body.append(ring)
    }
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
    .busy-proto-center { position: fixed; left: 50%; top: 50%; width: ${centerRadius * 200}vmin;
      height: ${centerRadius * 200}vmin; transform: translate(-50%, -50%); border-radius: 50%;
      border: 1px dashed #fff6; pointer-events: none; z-index: 9999; }
    .busy-proto-bar button { all: unset; cursor: pointer; padding: 2px 8px; border-radius: 6px; background: #fff2; }
    .busy-proto-compact .score-card__logo { display: none; }
    .busy-proto-compact .score-card__team { grid-template-columns: 1fr auto; gap: 4px; padding: 0 4px; }
    .busy-proto-compact .score-card { min-width: 0; font-size: 10px; padding-bottom: 2px; gap: 0; }
    .busy-proto-compact .score-card__header { font-size: 9px; padding: 1px 4px; }
  `
  document.head.append(style)
}
