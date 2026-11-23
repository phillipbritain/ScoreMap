import type { ReactNode } from 'react'

/** A rail icon's drawing, stroked in its text color on a 24-unit square. */
export function RailIcon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function ZoomInIcon() {
  return <path d="M12 5v14M5 12h14" />
}

export function ZoomOutIcon() {
  return <path d="M5 12h14" />
}

export function HomeIcon() {
  return <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
}

export function OrbitIcon() {
  return (
    <>
      <circle cx="12" cy="12" r="5" />
      <ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-40 12 12)" />
    </>
  )
}

/** Leagues: a ball with a basketball's seams, for sports in general. */
export function LeaguesIcon() {
  return (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20M2 12h20M5.6 4.8c3.2 3.4 3.2 11 0 14.4M18.4 4.8c-3.2 3.4-3.2 11 0 14.4" />
    </>
  )
}

/** Display Settings: three sliders, settings to adjust (Lucide's "sliders-horizontal"). */
export function DisplaySettingsIcon() {
  return <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
}

/** Events: a list (Feather's "list"). */
export function GamesIcon() {
  return <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
}

/** Scenario (local runs only): a play button in a circle (Feather's "play-circle"), for the scenario controls. */
export function ScenarioIcon() {
  return (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m10 8 6 4-6 4z" />
    </>
  )
}

/** More: three dots, more to come (Feather's "more-horizontal"). */
export function MoreIcon() {
  return (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>
  )
}

