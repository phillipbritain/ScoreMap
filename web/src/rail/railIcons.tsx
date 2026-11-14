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

/** Leagues: a trophy (Lucide's "trophy"). */
export function LeaguesIcon() {
  return (
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z" />
  )
}

/** Map Type: a stack of layers, a map's layers to pick between. */
export function MapTypeIcon() {
  return <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
}

/** Display Settings: three sliders, settings to adjust (Lucide's "sliders-horizontal"). */
export function DisplaySettingsIcon() {
  return <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
}

/** Games: a list (Feather's "list"). */
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

/** Hide controls: a cross, closing the rail's buttons up into it (Feather's "x"). */
export function HideControlsIcon() {
  return <path d="M18 6 6 18M6 6l12 12" />
}

/** Show controls: a menu, the rail's buttons folded into it (Feather's "menu"). */
export function ShowControlsIcon() {
  return <path d="M4 6h16M4 12h16M4 18h16" />
}
