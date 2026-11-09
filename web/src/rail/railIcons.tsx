import type { ReactNode } from 'react'

/** A rail icon's drawing, stroked in its text colour on a 24-unit square. */
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

/** Satellite map: a stack of layers, a map's layers to switch between. */
export function MapTypeIcon() {
  return <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
}

/** Display Settings: a painter's palette. */
export function PaletteIcon() {
  return (
    <>
      <circle cx="13.5" cy="6.5" r="1" />
      <circle cx="17.5" cy="10.5" r="1" />
      <circle cx="8.5" cy="7.5" r="1" />
      <circle cx="6.5" cy="12.5" r="1" />
      <path d="M12 2a10 10 0 0 0 0 20c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6h1.9A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9z" />
    </>
  )
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

/** Tuners (local runs only): three sliders (Feather's "sliders"), for the theme and behaviour tuners. */
export function TunersIcon() {
  return <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
}
