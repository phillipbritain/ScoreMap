// PROTOTYPE, throwaway: three variants of a "quick settings" rail in place of the gear's settings
// menu, switchable by ?variant=A|B|C and the bar at the top (or the ← → keys). Not for main.
//   A: everything on the rail: zoom, Live only and Show Disrupted toggles, a Leagues popover and a
//      separate Colours popover.
//   B: zoom, the two toggles, and one Leagues & colours popover (today's Leagues tab).
//   C: zoom, and one settings button opening today's tabbed menu unchanged.
import { useEffect, useState, type ReactNode } from 'react'
import { SettingsMenu } from './SettingsMenu'
import type { League, ViewerSettings } from './viewerSettings'
import './quickSettingsPrototype.css'

type Variant = 'A' | 'B' | 'C'
const variants: readonly { key: Variant; name: string }[] = [
  { key: 'A', name: 'Everything on the rail' },
  { key: 'B', name: 'Toggles + one panel' },
  { key: 'C', name: 'Map controls + settings button' },
]

interface Props {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  accent: string
  zoom: (step: 1 | -1) => void
  home: () => void
}

export function QuickSettingsPrototype(props: Props) {
  const [variant, setVariant] = useState<Variant>(readVariant)
  const go = (step: number) => {
    const index = variants.findIndex(({ key }) => key === variant)
    const next = variants[(index + step + variants.length) % variants.length].key
    const url = new URL(window.location.href)
    url.searchParams.set('variant', next)
    window.history.replaceState(null, '', url)
    setVariant(next)
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const name = variants.find(({ key }) => key === variant)!.name
  return (
    <>
      <Rail key={variant} variant={variant} {...props} />
      {import.meta.env.DEV && (
        <div className="qs-switcher">
          <button type="button" onClick={() => go(-1)}>
            ←
          </button>
          <span>
            {variant} ({name})
          </span>
          <button type="button" onClick={() => go(1)}>
            →
          </button>
        </div>
      )}
    </>
  )
}

function readVariant(): Variant {
  const value = new URLSearchParams(window.location.search).get('variant')
  return value === 'B' || value === 'C' ? value : 'A'
}

function Rail({ variant, leagues, settings, onChange, accent, zoom, home }: Props & { variant: Variant }) {
  const menu = { leagues, settings, onChange, accent }
  const toggle = (key: 'liveOnly' | 'showDisrupted') => onChange({ ...settings, [key]: !settings[key] })
  return (
    <div className="qs-rail">
      <div className="qs-group">
        <RailButton label="Zoom in" onClick={() => zoom(1)}>
          <PlusIcon />
        </RailButton>
        <RailButton label="Zoom out" onClick={() => zoom(-1)}>
          <MinusIcon />
        </RailButton>
        <RailButton label="Home" onClick={home}>
          <HomeIcon />
        </RailButton>
      </div>
      {variant !== 'C' && (
        <div className="qs-group">
          <RailButton label="Live only" pressed={settings.liveOnly} onClick={() => toggle('liveOnly')}>
            <LiveIcon />
          </RailButton>
          <RailButton
            label="Show Disrupted games"
            pressed={settings.showDisrupted}
            onClick={() => toggle('showDisrupted')}
          >
            <DisruptedIcon />
          </RailButton>
        </div>
      )}
      <div className="qs-group">
        {variant === 'A' && (
          <>
            <SettingsMenu
              {...menu}
              only="leagues"
              className="qs-popover qs-popover--switches"
              summary={<RailSummary label="Leagues"><LayersIcon /></RailSummary>}
            />
            <SettingsMenu
              {...menu}
              only="leagues"
              className="qs-popover qs-popover--colours"
              summary={<RailSummary label="Colours"><PaletteIcon /></RailSummary>}
            />
          </>
        )}
        {variant === 'B' && (
          <SettingsMenu
            {...menu}
            only="leagues"
            className="qs-popover"
            summary={<RailSummary label="Leagues & colours"><LayersIcon /></RailSummary>}
          />
        )}
        {variant === 'C' && (
          <SettingsMenu
            {...menu}
            className="qs-popover"
            summary={<RailSummary label="Settings"><SlidersIcon /></RailSummary>}
          />
        )}
      </div>
    </div>
  )
}

function RailButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="qs-button"
      aria-label={label}
      title={pressed === undefined ? label : `${label}: ${pressed ? 'on' : 'off'}`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function RailSummary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <summary className="qs-button" aria-label={label} title={label}>
      {children}
    </summary>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="qs-icon"
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

const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
)
const HomeIcon = () => (
  <Icon>
    <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
)
const LiveIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
  </Icon>
)
const DisruptedIcon = () => (
  <Icon>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
  </Icon>
)
const LayersIcon = () => (
  <Icon>
    <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </Icon>
)
const PaletteIcon = () => (
  <Icon>
    <circle cx="13.5" cy="6.5" r="1" />
    <circle cx="17.5" cy="10.5" r="1" />
    <circle cx="8.5" cy="7.5" r="1" />
    <circle cx="6.5" cy="12.5" r="1" />
    <path d="M12 2a10 10 0 0 0 0 20c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6h1.9A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9z" />
  </Icon>
)
const SlidersIcon = () => (
  <Icon>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </Icon>
)
