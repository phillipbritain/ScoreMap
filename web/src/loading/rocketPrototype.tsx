// PROTOTYPE, throwaway: rocket-in-space variants for the loading screen, switched by `?rocketProto=`
// (see RocketProtoSwitcher.tsx). Round 2 (cycled by the switcher): today's rocket, then today's with the
// starfield's two-layer flame and a small step more each, then the starfield for reference. Round 1's
// other looks (orbit, warp, retro) still open by their key in the URL. Not for main.
/* oxlint-disable react/only-export-components -- a throwaway prototype, reloaded after each edit. */
import type { ReactNode } from 'react'

/** The variants the switcher cycles through. */
export const rocketProtoVariants = ['today', 'flame', 'flameGlow', 'flameStars', 'flameGold', 'starfield'] as const
const allVariants = [...rocketProtoVariants, 'orbit', 'warp', 'retro'] as const
export type RocketVariant = (typeof allVariants)[number]

export const rocketNames: Record<RocketVariant, string> = {
  today: 'Today’s rocket',
  flame: 'Today’s, with the starfield’s flame',
  flameGlow: 'Today’s, starfield flame glowing',
  flameStars: 'Today’s, starfield flame, stars for speed lines',
  flameGold: 'Today’s, starfield flame, gold nose, fins and window rim',
  starfield: 'Sleek rocket through a starfield',
  orbit: 'Rocket orbiting a little globe',
  warp: 'Side-on rocket at warp speed',
  retro: 'Retro rocket launching, puffs and sparkles',
}

const asked = new URLSearchParams(window.location.search).get('rocketProto')
/** Whether the URL asks for the prototype: then the loading screen is held on screen to look at. */
export const rocketProtoAsked = asked !== null
export const rocketProto: RocketVariant = (allVariants as readonly string[]).includes(asked ?? '')
  ? (asked as RocketVariant)
  : 'today'

/** The variant's rocket, or null for today's (the loading screen draws its own). */
export function ProtoRocket(): ReactNode {
  switch (rocketProto) {
    case 'flame':
      return <TodayWithFlame />
    case 'flameGlow':
      return <TodayWithFlame glow />
    case 'flameStars':
      return <TodayWithFlame stars />
    case 'flameGold':
      return <TodayWithFlame gold />
    case 'starfield':
      return <Starfield />
    case 'orbit':
      return <Orbit />
    case 'warp':
      return <Warp />
    case 'retro':
      return <Retro />
    default:
      return null
  }
}

/**
 * Today's rocket (as LoadingScreen's Rocket draws it, same classes, so the same bob, speed lines and
 * reduce motion), with the starfield's two-layer flame; optionally glowing, with streaming stars in
 * place of the speed lines, or with the starfield's gold nose, fins and window rim.
 */
function TodayWithFlame({ glow = false, stars = false, gold = false }: { glow?: boolean; stars?: boolean; gold?: boolean }) {
  const className = ['loading-screen__rocket', 'rp', 'rp-today', glow && 'rp-today--glow', gold && 'rp-today--gold']
    .filter(Boolean)
    .join(' ')
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      {stars && (
        <>
          <defs>
            <radialGradient id="rp-today-fade">
              <stop offset="0.5" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </radialGradient>
            <mask id="rp-today-mask">
              <circle cx="32" cy="32" r="46" fill="url(#rp-today-fade)" />
            </mask>
          </defs>
          <g mask="url(#rp-today-mask)">
            <g transform="rotate(45 32 32)">
              {todayStars.map(({ a, b, c }, at) => (
                <circle
                  key={at}
                  className="rp-star rp-star--stream rp-star--near"
                  cx={-14 + a * 92}
                  cy={-14 + b * 92}
                  r={0.5 + c * 0.9}
                  style={{ animationDuration: `${0.45 + (1 - c) * 0.8}s`, animationDelay: `${-b * 1.3}s` }}
                />
              ))}
            </g>
          </g>
        </>
      )}
      <g transform="rotate(45 32 32)">
        {!stars && (
          <g className="loading-screen__rocket-lines">
            <line x1="20" y1="44" x2="20" y2="56" />
            <line x1="32" y1="50" x2="32" y2="62" />
            <line x1="44" y1="44" x2="44" y2="56" />
          </g>
        )}
        <g className="loading-screen__rocket-ship">
          <path className="rp-flame-outer" d="M25.5 41 Q32 62 38.5 41 Z" />
          <path className="rp-flame-inner" d="M28.5 41 Q32 54 35.5 41 Z" />
          <path className="rp-fins" d="M24 29 L16 42 L25 39 Z M40 29 L48 42 L39 39 Z" />
          <path className="rp-body" d="M32 4 C41 12 43 26 40 41 H24 C21 26 23 12 32 4 Z" />
          {gold && <path className="rp-accent" d="M32 4 C35.6 7.2 38.2 11 39.8 15 H24.2 C25.8 11 28.4 7.2 32 4 Z" />}
          <circle className="loading-screen__rocket-window" cx="32" cy="21" r="4.5" />
        </g>
      </g>
    </svg>
  )
}

// A steady pseudo-random spread, so the stars land in the same places each time.
const spread = (count: number, seed: number) =>
  Array.from({ length: count }, (_, at) => {
    const r = (n: number) => {
      const x = Math.sin((at + 1) * 12.9898 * n + seed * 78.233) * 43758.5453
      return x - Math.floor(x)
    }
    return { a: r(1), b: r(2), c: r(3) }
  })

const todayStars = spread(22, 4)

/** The sleek rocket, nose up in a 64 box: gold nose and fins, a ringed window, a two-layer flame. */
function SleekRocket() {
  return (
    <g className="rp-ship">
      <path className="rp-flame-outer" d="M25 43 Q32 66 39 43 Z" />
      <path className="rp-flame-inner" d="M28 43 Q32 57 36 43 Z" />
      <path className="rp-accent" d="M23 29 L12 47 L24 42 Z M41 29 L52 47 L40 42 Z" />
      <path className="rp-body" d="M32 2 C42 10 45 26 41 44 H23 C19 26 22 10 32 2 Z" />
      <path className="rp-accent" d="M32 2 C36.5 5.6 39.5 10 41.2 15 H22.8 C24.5 10 27.5 5.6 32 2 Z" />
      <circle className="rp-window" cx="32" cy="24" r="5" />
    </g>
  )
}

const starfield = spread(34, 1)

/** The sleek rocket flying up and to the right, stars streaming past it, fading at the edges. */
function Starfield() {
  return (
    <svg className="loading-screen__rocket rp rp-starfield" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="rp-starfield-fade">
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="rp-starfield-mask">
          <circle cx="60" cy="60" r="60" fill="url(#rp-starfield-fade)" />
        </mask>
      </defs>
      <g mask="url(#rp-starfield-mask)">
        <g transform="rotate(45 60 60)">
          {starfield.map(({ a, b, c }, at) => (
            <circle
              key={at}
              className="rp-star rp-star--stream"
              cx={-10 + a * 140}
              cy={b * 120}
              r={0.7 + c * 1.3}
              style={{ animationDuration: `${0.5 + (1 - c) * 0.9}s`, animationDelay: `${-b * 1.4}s` }}
            />
          ))}
        </g>
      </g>
      <g transform="rotate(45 60 60) translate(60 58) scale(1.3) translate(-32 -32)">
        <SleekRocket />
      </g>
    </svg>
  )
}

const orbitStars = spread(7, 2)
const orbitTrail = [22, 32, 42, 52, 62, 72]

/** A little globe with a pin on it, the rocket circling it, a dotted trail behind like a score card's. */
function Orbit() {
  const at = (degrees: number, r = 50) => {
    const radians = (degrees * Math.PI) / 180
    return { x: 70 + r * Math.sin(radians), y: 70 - r * Math.cos(radians) }
  }
  return (
    <svg className="loading-screen__rocket rp rp-orbit" viewBox="0 0 140 140" aria-hidden="true">
      {orbitStars.map(({ a, b, c }, i) => (
        <circle
          key={i}
          className="rp-star rp-star--twinkle"
          cx={6 + a * 128}
          cy={6 + b * 128}
          r={0.8 + c}
          style={{ animationDelay: `${-c * 2}s` }}
        />
      ))}
      <circle className="rp-orbit-path" cx="70" cy="70" r="50" />
      <g className="rp-planet">
        <circle className="rp-planet-body" cx="70" cy="70" r="24" />
        <ellipse className="rp-planet-line" cx="70" cy="70" rx="10" ry="24" />
        <path className="rp-planet-line" d="M47 62 H93 M47 78 H93" />
        <circle className="rp-pin" cx="78" cy="64" r="3" />
      </g>
      <g className="rp-orbiter">
        {orbitTrail.map((degrees, i) => {
          const { x, y } = at(-degrees)
          return <circle key={degrees} className="rp-trail-dot" cx={x} cy={y} r={3 - i * 0.35} opacity={0.9 - i * 0.14} />
        })}
        <g transform="translate(70 20) rotate(90) scale(0.62) translate(-32 -28)">
          <SleekRocket />
        </g>
      </g>
    </svg>
  )
}

const warpStreaks = spread(11, 3)

/** The rocket side-on, flying right at warp speed: long streaks rushing past, a long flickering plume. */
function Warp() {
  return (
    <svg className="loading-screen__rocket rp rp-warp" viewBox="0 0 200 80" aria-hidden="true">
      <defs>
        <linearGradient id="rp-warp-fade">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.25" stopColor="#fff" />
          <stop offset="0.75" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="rp-warp-mask">
          <rect width="200" height="80" fill="url(#rp-warp-fade)" />
        </mask>
      </defs>
      <g mask="url(#rp-warp-mask)">
        {warpStreaks.map(({ a, b, c }, at) => (
          <line
            key={at}
            className="rp-streak"
            x1={a * 200}
            x2={a * 200 + 14 + c * 26}
            y1={6 + b * 68}
            y2={6 + b * 68}
            style={{ animationDuration: `${0.35 + (1 - c) * 0.4}s`, animationDelay: `${-a}s` }}
          />
        ))}
      </g>
      <g className="rp-ship">
        <path className="rp-flame-outer rp-flame--side" d="M86 33 Q46 40 86 47 Z" />
        <path className="rp-flame-inner rp-flame--side" d="M86 36 Q64 40 86 44 Z" />
        <path className="rp-accent" d="M98 31 L88 18 L83 18 L86 31 Z M98 49 L88 62 L83 62 L86 49 Z" />
        <path className="rp-body" d="M136 40 C128 31 113 29.5 98 30.5 L86 31 L86 49 L98 49.5 C113 50.5 128 49 136 40 Z" />
        <path className="rp-accent" d="M136 40 C132.5 36 128 33.3 123 32 L123 48 C128 46.7 132.5 44 136 40 Z" />
        <circle className="rp-window" cx="111" cy="40" r="4.5" />
      </g>
    </svg>
  )
}

const retroSparkles = [
  { x: 18, y: 22, s: 1 },
  { x: 100, y: 16, s: 0.8 },
  { x: 104, y: 70, s: 0.6 },
  { x: 14, y: 76, s: 0.7 },
]
const retroPuffs = [
  { dx: -16, delay: 0 },
  { dx: 14, delay: -0.3 },
  { dx: -6, delay: -0.6 },
  { dx: 8, delay: -0.9 },
]

/** A chunky 1950s rocket climbing straight up, portholes and red fins, puffs of exhaust, sparkles. */
function Retro() {
  return (
    <svg className="loading-screen__rocket rp rp-retro" viewBox="0 0 120 120" aria-hidden="true">
      {retroSparkles.map(({ x, y, s }, at) => (
        <path
          key={at}
          className="rp-sparkle"
          transform={`translate(${x} ${y}) scale(${s})`}
          d="M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7 Z"
          style={{ animationDelay: `${-at * 0.45}s` }}
        />
      ))}
      {retroPuffs.map(({ dx, delay }, at) => (
        <circle
          key={at}
          className="rp-puff"
          cx="60"
          cy={92 + at * 3}
          r="6"
          style={{ ['--dx' as string]: `${dx}px`, animationDelay: `${delay}s` }}
        />
      ))}
      <g className="rp-ship">
        <path className="rp-flame-outer" d="M52 78 Q60 106 68 78 Z" />
        <path className="rp-flame-inner" d="M55 78 Q60 96 65 78 Z" />
        <path className="rp-hot" d="M50 56 C38 62 34 74 36 88 L50 78 Z M70 56 C82 62 86 74 84 88 L70 78 Z" />
        <path className="rp-body" d="M60 10 C74 22 78 46 72 76 H48 C42 46 46 22 60 10 Z" />
        <path className="rp-hot" d="M60 10 C65 14.5 68.6 20.5 70.8 27 H49.2 C51.4 20.5 55 14.5 60 10 Z" />
        <path className="rp-hot" d="M58 62 H62 V90 H58 Z" />
        <circle className="rp-window rp-window--ringed" cx="60" cy="40" r="6" />
        <circle className="rp-window rp-window--ringed" cx="60" cy="56" r="3.5" />
        <path className="rp-nozzle" d="M50 76 H70 L67 80 H53 Z" />
      </g>
    </svg>
  )
}
