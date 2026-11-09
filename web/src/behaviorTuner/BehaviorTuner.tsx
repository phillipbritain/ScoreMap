import { useEffect, useState } from 'react'
import { saveBehavior, type Behavior, type Overlays } from './behavior'
// The theme tuner's plain look, so the two tools read as one.
import '../themeTuner/themeTuner.css'
import { TunerHeader } from '../themeTuner/ThemeTuner'

/** A number the tuner can change, and where it lives in the app's settings files. */
interface NumberSetting {
  group: string
  name: string
  /** What it controls, shown on hovering its name. */
  description: string
  /** The settings file and key it's kept in, for copying the changes into. */
  file: string
  key: string
  range: { min: number; max: number; step: number }
  /** What can be drawn on the globe to show it at work, with a switch to show it, if anything. */
  overlay?: { key: keyof Overlays; label: string }
  get: (behavior: Behavior) => number
  set: (behavior: Behavior, value: number) => Behavior
}

const settings: readonly NumberSetting[] = [
  {
    group: 'City labels',
    name: 'Reach (km)',
    description:
      'How far a city may be from a game and still be the city it is labeled by. Each game gets the most ' +
      'populous Small city within this reach, unless a city label is already that close; a game with no listed ' +
      'city within reach gets none. Bigger: fewer Small city labels, and games named by cities further away. ' +
      'Big cities are labeled anyway (see docs/city-labels.md).',
    file: 'web/src/globe/cityLabelSettings.json',
    key: 'gameCityKm',
    range: { min: 10, max: 300, step: 5 },
    overlay: { key: 'gameCityReach', label: "Ring each game at its reach" },
    get: (behavior) => behavior.cityLabels.gameCityKm,
    set: (behavior, gameCityKm) => ({ ...behavior, cityLabels: { ...behavior.cityLabels, gameCityKm } }),
  },
  {
    group: 'Zoom',
    name: 'Furthest out',
    description:
      'The lowest zoom the globe goes to, measured at the equator: away from it the globe zooms a little further ' +
      'out and stays the same size on screen. Lower: a smaller globe with more space around it. Keep it below 3, ' +
      'where pins become score cards, for small pins and their clusters to show.',
    file: 'web/src/globe/zoomSettings.json',
    key: 'minZoom',
    range: { min: 0, max: 5, step: 0.1 },
    get: (behavior) => behavior.zoom.minZoom,
    set: (behavior, minZoom) => ({ ...behavior, zoom: { ...behavior.zoom, minZoom } }),
  },
  {
    group: 'Zoom',
    name: 'Start',
    description:
      'The zoom a first visit opens at, centered on the viewer\'s region, and Home flies back to. ' +
      'The globe goes there as it changes. Measured at the equator, as Furthest out is, and never further out than it. A returning viewer opens ' +
      'where they left the globe.',
    file: 'web/src/globe/zoomSettings.json',
    key: 'startZoom',
    range: { min: 0, max: 8, step: 0.1 },
    get: (behavior) => behavior.zoom.startZoom,
    set: (behavior, startZoom) => ({ ...behavior, zoom: { ...behavior.zoom, startZoom } }),
  },
  {
    group: 'Zoom',
    name: 'Furthest in',
    description: 'The highest zoom the plain map goes to. At 11 the view is a city some ten kilometers across; each step in halves that.',
    file: 'web/src/globe/zoomSettings.json',
    key: 'maxZoom',
    range: { min: 5, max: 22, step: 0.5 },
    get: (behavior) => behavior.zoom.maxZoom,
    set: (behavior, maxZoom) => ({ ...behavior, zoom: { ...behavior.zoom, maxZoom } }),
  },
  {
    group: 'Zoom',
    name: 'Furthest in (satellite)',
    description:
      'The highest zoom the satellite map goes to. Past about 14 its imagery only blurs, its pixels being 10 m. ' +
      'Switching back to the plain map zooms out to its own furthest in.',
    file: 'web/src/globe/zoomSettings.json',
    key: 'satelliteMaxZoom',
    range: { min: 5, max: 18, step: 0.5 },
    get: (behavior) => behavior.zoom.satelliteMaxZoom,
    set: (behavior, satelliteMaxZoom) => ({ ...behavior, zoom: { ...behavior.zoom, satelliteMaxZoom } }),
  },
  {
    group: 'Asleep',
    name: 'Idle timeout (min)',
    description:
      'How long the page can be hidden (its window minimized, another tab in front, the screen locked) before ' +
      'ScoreMap falls asleep: it stops getting games, so with nobody else watching the server stops fetching, ' +
      'and it wakes when the page is shown again. Lower: the server rests sooner, but a quick look elsewhere ' +
      'for longer than this comes back to "Waking up…". To try it, set 1 and minimize the window for a minute.',
    file: 'web/src/live/asleepSettings.json',
    key: 'idleTimeoutMinutes',
    range: { min: 1, max: 60, step: 1 },
    get: (behavior) => behavior.asleep.idleTimeoutMinutes,
    set: (behavior, idleTimeoutMinutes) => ({ ...behavior, asleep: { ...behavior.asleep, idleTimeoutMinutes } }),
  },
]

interface BehaviorTunerProps {
  /** The app's own behavior, which the draft is compared with and reset to. */
  builtIn: Behavior
  /** The behavior the app is in now. */
  behavior: Behavior
  /** Called with the draft each time it changes: the app's one way to change its behavior. */
  onChange: (behavior: Behavior) => void
  /** What's drawn on the globe to show settings at work, and the way to change it. */
  overlays: Overlays
  onOverlays: (overlays: Overlays) => void
  /** The globe's zoom where its camera last settled, shown with the zoom settings. */
  zoomNow: number
  /** Whether its panel shows: opened and closed from the rail's Tuners popover. */
  open: boolean
  /** Told how many settings the draft changes, for the Tuners popover's count. */
  onChangeCount: (count: number) => void
  /** Closes its panel, from the close button in its header. */
  onClose: () => void
}

/**
 * The behavior tuner (local runs only): a panel for trying settings that change how the app behaves
 * rather than how it looks, on the running app. Changes show at once. The draft is kept in this
 * browser, and its changes can be copied to put into the settings files.
 */
export function BehaviorTuner(props: BehaviorTunerProps) {
  const { builtIn, behavior, onChange, open, onChangeCount, onClose } = props
  const [copied, setCopied] = useState(false)
  const changed = settings.filter((setting) => setting.get(behavior) !== setting.get(builtIn))
  useEffect(() => onChangeCount(changed.length), [changed.length, onChangeCount])

  useEffect(() => saveBehavior(window.localStorage, behavior, builtIn), [behavior, builtIn])

  const copy = () => {
    const text = changed.map((setting) => `${setting.file}: "${setting.key}": ${setting.get(behavior)}`).join('\n')
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="theme-tuner theme-tuner--behavior">
      {open && (
        <div className="theme-tuner__panel" role="dialog" aria-label="Behavior">
          <TunerHeader name="Behavior" onClose={onClose} />
          <div className="theme-tuner__body">
            {[...new Set(settings.map((setting) => setting.group))].map((group) => (
              <div key={group} className="theme-tuner__group theme-tuner__group--top">
                <div className="theme-tuner__heading">
                  {group}
                  {group === 'Zoom' && <span className="behavior-tuner__now">now {props.zoomNow.toFixed(2)}</span>}
                </div>
                {settings
                  .filter((setting) => setting.group === group)
                  .map((setting) => (
                    <SettingRow key={setting.key} setting={setting} {...props} />
                  ))}
              </div>
            ))}
          </div>
          <div className="theme-tuner__footer">
            <span>{changed.length === 0 ? 'No changes' : `${changed.length} changed`}</span>
            <button type="button" disabled={changed.length === 0} onClick={copy}>
              {copied ? 'Copied' : 'Copy changes'}
            </button>
            <button type="button" disabled={changed.length === 0} onClick={() => onChange(builtIn)}>
              Reset all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingRow({ setting, behavior, builtIn, onChange, overlays, onOverlays }: { setting: NumberSetting } & BehaviorTunerProps) {
  const value = setting.get(behavior)
  const original = setting.get(builtIn)
  const changed = value !== original
  const set = (next: number) => onChange(setting.set(behavior, next))
  return (
    <div className={changed ? 'theme-tuner__row theme-tuner__row--changed' : 'theme-tuner__row'}>
      <span className="theme-tuner__name behavior-tuner__name" title={`${setting.description}\n\n${setting.file}: ${setting.key}`}>
        {setting.overlay && (
          <button
            type="button"
            role="switch"
            className="behavior-tuner__switch"
            title={setting.overlay.label}
            aria-label={setting.overlay.label}
            aria-checked={overlays[setting.overlay.key]}
            onClick={() => onOverlays({ ...overlays, [setting.overlay!.key]: !overlays[setting.overlay!.key] })}
          />
        )}
        {setting.name}
      </span>
      <span className="theme-tuner__number">
        <input type="range" {...setting.range} value={value} onChange={(event) => set(Number(event.target.value))} />
        <input type="number" step={setting.range.step} value={value} onChange={(event) => event.target.value !== '' && set(Number(event.target.value))} />
      </span>
      <button
        type="button"
        className="theme-tuner__reset"
        title={`Back to ${original}`}
        style={{ visibility: changed ? 'visible' : 'hidden' }}
        onClick={() => set(original)}
      >
        ↺
      </button>
    </div>
  )
}
